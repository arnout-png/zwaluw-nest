import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAppointmentConfirmationCandidate, sendAppointmentNotificationInternal } from '@/lib/email';
import { sendAppointmentSMS } from '@/lib/sms';
import { logAudit, getIp } from '@/lib/audit';

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
  const body = await request.json() as { date?: string; time?: string; location?: string; interviewerId?: string };
  const { date, time, location = 'Kantoor Zwaluw, Oss', interviewerId } = body;

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

  // 1. Update status to INTERVIEW + optionally assign to interviewer
  const candidateUpdate: Record<string, unknown> = {
    status: 'INTERVIEW',
    stageUpdatedAt: new Date().toISOString(),
  };
  if (interviewerId) {
    candidateUpdate.assignedToId = interviewerId;
  }
  await supabaseAdmin
    .from('Candidate')
    .update(candidateUpdate)
    .eq('id', candidateId);

  // Resolve who the interviewer is (for notifications)
  let interviewerEmail = session.email;
  let interviewerName = session.name;
  if (interviewerId && interviewerId !== session.userId) {
    const { data: interviewer } = await supabaseAdmin
      .from('User')
      .select('name, email')
      .eq('id', interviewerId)
      .single();
    if (interviewer) {
      interviewerEmail = (interviewer as { name: string; email: string }).email;
      interviewerName = (interviewer as { name: string; email: string }).name;
    }
  }

  // 1b. Create Appointment record so it shows in the agenda
  const interviewUserId = interviewerId || session.userId;
  let epId: string | null = null;
  // Get or create EmployeeProfile for the interviewer
  const { data: epData } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', interviewUserId)
    .maybeSingle();
  if (epData) {
    epId = (epData as { id: string }).id;
  } else {
    // Auto-create minimal EmployeeProfile
    const { data: newEp } = await supabaseAdmin
      .from('EmployeeProfile')
      .insert({ userId: interviewUserId, startDate: new Date().toISOString().split('T')[0] })
      .select('id')
      .single();
    if (newEp) epId = (newEp as { id: string }).id;
  }

  if (epId) {
    const startTime = new Date(`${date}T${time}:00`).toISOString();
    const endTime = new Date(new Date(`${date}T${time}:00`).getTime() + 60 * 60 * 1000).toISOString(); // 1 hour default
    try {
      await supabaseAdmin.from('Appointment').insert({
        id: crypto.randomUUID(),
        employeeProfileId: epId,
        title: `Sollicitatiegesprek: ${candidate.name}`,
        description: `Kandidaat: ${candidate.name}${candidate.phone ? ` · Tel: ${candidate.phone}` : ''}`,
        date,
        startTime,
        endTime,
        location,
        status: 'SCHEDULED',
        createdById: session.userId,
      });
    } catch (e) {
      console.error('Appointment record creation failed:', e);
    }
  }

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

  // 3. Internal notification email to interviewer
  try {
    await sendAppointmentNotificationInternal({
      to: interviewerEmail,
      candidateName: candidate.name,
      candidatePhone: candidate.phone,
      date: datumNL,
      time,
    });
  } catch (e) {
    console.error('Interne afspraak e-mail mislukt:', e);
  }

  // 4. Notification to interviewer (if different from current user)
  if (interviewerId && interviewerId !== session.userId) {
    try {
      await supabaseAdmin.from('Notification').insert({
        id: crypto.randomUUID(),
        userId: interviewerId,
        type: 'SYSTEM',
        title: `Gesprek ingepland: ${candidate.name}`,
        message: `${session.name} heeft een gesprek ingepland met ${candidate.name} op ${datumNL} om ${time} uur op ${location}`,
        linkUrl: `/dashboard/werving/${candidateId}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch { /* silent */ }
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

  logAudit({ userId: session.userId, action: 'STATUS_CHANGE', entity: 'Candidate', entityId: candidateId, details: { to: 'INTERVIEW', trigger: 'appointment_book', date, time, location }, ipAddress: getIp(request) });

  return NextResponse.json({ ok: true });
}
