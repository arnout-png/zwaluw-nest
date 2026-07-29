import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPhoneCorrectEmail } from '@/lib/email';
import { logAudit, getIp } from '@/lib/audit';
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

  if (!candidate.email) {
    return NextResponse.json({ error: 'Kandidaat heeft geen e-mailadres.' }, { status: 400 });
  }

  // Generate token + expiry (7 days)
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from('Candidate')
    .update({ phoneCorrectToken: token, phoneCorrectExpiresAt: expiresAt })
    .eq('id', candidateId);

  // Send email
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.werkenbijzwaluwcomfortsanitair.nl';
  const firstName = candidate.name.split(' ')[0];

  try {
    console.log('[PhoneCorrect] Sending to:', candidate.email, 'name:', firstName, 'baseUrl:', baseUrl);
    await sendPhoneCorrectEmail({
      to: candidate.email,
      name: firstName,
      token,
      baseUrl,
    });
    console.log('[PhoneCorrect] Email sent successfully');
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error('[PhoneCorrect] Email failed:', msg);
    return NextResponse.json({ error: 'E-mail verzenden mislukt.', detail: msg }, { status: 500 });
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
