import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPhoneCorrectEmail } from '@/lib/email';
import { logAudit, getIp } from '@/lib/audit';
import { isDeliverableEmail } from '@/lib/recruitment';
import { externalBaseUrl } from '@/lib/site-url';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id: candidateId } = await params;

  // Fetch candidate
  const { data: candidate } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, email')
    .eq('id', candidateId)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: 'Kandidaat niet gevonden.' }, { status: 404 });
  }

  if (!isDeliverableEmail(candidate.email)) {
    return NextResponse.json({ error: 'Kandidaat heeft geen bruikbaar e-mailadres.' }, { status: 400 });
  }

  // Generate token + expiry (7 days)
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from('Candidate')
    .update({ phoneCorrectToken: token, phoneCorrectExpiresAt: expiresAt })
    .eq('id', candidateId);

  // Send email
  const baseUrl = externalBaseUrl();
  const firstName = candidate.name.split(' ')[0];

  try {
    await sendPhoneCorrectEmail({
      to: candidate.email,
      name: firstName,
      token,
      baseUrl,
    });
  } catch (err) {
    console.error('[PhoneCorrect] Email failed:', err);
    return NextResponse.json({ error: 'E-mail verzenden mislukt.' }, { status: 500 });
  }

  logAudit({
    userId: session.userId,
    action: 'PHONE_CORRECT_SENT',
    entity: 'Candidate',
    entityId: candidateId,
    details: { email: candidate.email },
    ipAddress: getIp(request),
  });

  return NextResponse.json({ ok: true });
}
