import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAppointmentConfirmationCandidate, sendAppointmentNotificationInternal } from '@/lib/email';
import { sendAppointmentSMS } from '@/lib/sms';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id: candidateId } = await params;
  const body = await request.json() as { date?: string; time?: string; location?: string };
  const { date, time, location = 'Kantoor Zwaluw, Oss' } = body;

  if (!date || !time) {
    return NextResponse.json({ error: 'Datum en tijd zijn verplicht.' }, { status: 400 });
  }

  // Fetch candidate
  const { data: candidateData } = await supabaseAdmin
    .from('Candidate')
    .select('name, email, phone')
    .eq('id', candidateId)
    .single();

  if (!candidateData) {
    return NextResponse.json({ error: 'Kandidaat niet gevonden.' }, { status: 404 });
  }

  const candidate = candidateData as { name: string; email: string; phone: string | null };

  // 1. Update status to INTERVIEW
  await supabaseAdmin
    .from('Candidate')
    .update({ status: 'INTERVIEW', stageUpdatedAt: new Date().toISOString() })
    .eq('id', candidateId);

  // Format date/time for Dutch locale
  const dateObj = new Date(`${date}T${time}:00`);
  const datumNL = dateObj.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const firstName = candidate.name.split(' ')[0];

  // 2. Email to candidate (graceful — no crash if Resend not configured)
  try {
    await sendAppointmentConfirmationCandidate({
      to: candidate.email,
      candidateName: firstName,
      date: datumNL,
      time,
      location,
    });
  } catch (e) {
    console.error('Afspraak e-mail kandidaat mislukt:', e);
  }

  // 3. Internal notification email to recruiter
  try {
    await sendAppointmentNotificationInternal({
      to: session.email,
      candidateName: candidate.name,
      candidatePhone: candidate.phone,
      date: datumNL,
      time,
    });
  } catch (e) {
    console.error('Interne afspraak e-mail mislukt:', e);
  }

  // 4. SMS to candidate (graceful — only if phone + Twilio configured)
  if (candidate.phone) {
    try {
      await sendAppointmentSMS({
        to: candidate.phone,
        candidateName: firstName,
        date: datumNL,
        time,
        location,
      });
    } catch (e) {
      console.error('SMS mislukt:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
