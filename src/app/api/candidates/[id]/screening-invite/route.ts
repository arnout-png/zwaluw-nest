import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPrescreeningEmail, isEmailConfigured } from '@/lib/email';
import { getAutomationConfig } from '@/lib/email-automations';
import { sendScreeningInviteSMS } from '@/lib/sms';
import { logAudit, getIp } from '@/lib/audit';
import { externalBaseUrl } from '@/lib/site-url';
import { isDeliverableEmail } from '@/lib/recruitment';
import { randomUUID } from 'crypto';

/** Alleen kandidaten die nog vóór/in de pre-screening zitten krijgen een link. */
const INVITABLE = ['NEW_LEAD', 'CONTACTED', 'PRE_SCREENING'];

/**
 * POST /api/candidates/[id]/screening-invite
 * Maakt een persoonlijke pre-screeninglink (7 dagen geldig), zet de kandidaat
 * op PRE_SCREENING en stuurt de link per e-mail en (als er een nummer is) sms.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER'].includes(session.role)) return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const { id } = await params;

  const { data: candidate, error: fetchError } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, email, phone, status, deletedAt')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !candidate || candidate.deletedAt) {
    return NextResponse.json({ error: 'Kandidaat niet gevonden.' }, { status: 404 });
  }

  if (!INVITABLE.includes(candidate.status as string)) {
    return NextResponse.json(
      { error: 'Deze kandidaat is al verder dan de pre-screening; een nieuwe link zou de status terugzetten.' },
      { status: 409 }
    );
  }

  const email = isDeliverableEmail(candidate.email as string | null) ? (candidate.email as string) : null;
  const phone = (candidate.phone as string | null)?.trim() || null;
  if (!email && !phone) {
    return NextResponse.json({ error: 'Kandidaat heeft geen bruikbaar e-mailadres of telefoonnummer.' }, { status: 400 });
  }

  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('Candidate')
    .update({
      prescreeningToken: token,
      prescreeningExpiresAt: expiresAt,
      status: 'PRE_SCREENING',
      ...(candidate.status !== 'PRE_SCREENING' ? { stageUpdatedAt: now.toISOString() } : {}),
      updatedAt: now.toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Screening invite update error:', updateError);
    return NextResponse.json({ error: 'Kan uitnodiging niet aanmaken.' }, { status: 500 });
  }

  logAudit({ userId: session.userId, action: 'STATUS_CHANGE', entity: 'Candidate', entityId: id, details: { from: candidate.status, to: 'PRE_SCREENING', trigger: 'screening_invite' }, ipAddress: getIp(request) });

  const baseUrl = externalBaseUrl();
  const screeningUrl = `${baseUrl}/screening/${token}`;
  const firstName = ((candidate.name as string) ?? '').split(' ')[0] || 'Kandidaat';

  let emailSent = false;
  let warning: string | undefined;
  if (email && isEmailConfigured() && (await getAutomationConfig('prescreening_invite')).enabled) {
    try {
      await sendPrescreeningEmail({ to: email, name: firstName, token, baseUrl });
      emailSent = true;
    } catch (err) {
      console.error('Screening invite email failed:', err);
      warning = 'Link aangemaakt, maar de e-mail kon niet worden verstuurd. Stuur de link zelf door.';
    }
  } else if (!email) {
    warning = 'Geen bruikbaar e-mailadres — stuur de link zelf door (bijv. via WhatsApp).';
  }

  let smsSent = false;
  if (phone && process.env.TELNYX_API_KEY && process.env.TELNYX_PHONE_NUMBER) {
    try {
      await sendScreeningInviteSMS({ to: phone, candidateName: (candidate.name as string) ?? 'Kandidaat', url: screeningUrl });
      smsSent = (await getAutomationConfig('sms_screening_invite')).enabled;
    } catch (err) {
      console.error('Screening invite SMS failed:', err);
    }
  }

  return NextResponse.json({ ok: true, screeningUrl, emailSent, smsSent, warning, expiresAt });
}
