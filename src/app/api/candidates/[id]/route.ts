import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendInterviewInviteEmail, isEmailConfigured } from '@/lib/email';
import { notifyStageChange } from '@/lib/recruitment';
import { logAudit, getIp } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('Candidate')
    .select(
      `id, status, name, email, phone, age, location, livingSituation,
       partnerEmployment, currentJob, reasonForLeaving, salaryExpectation,
       consentGiven, consentDate, consentExpiresAt, leadSource, leadCampaignId,
       prescreeningToken, prescreeningExpiresAt, createdAt, updatedAt`
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('GET /api/candidates/[id] error:', error.message);
    return NextResponse.json({ error: 'Kandidaat niet gevonden.' }, { status: 404 });
  }

  // Fetch notes and scores separately (avoid FK join issues)
  const [notesRes, scoresRes] = await Promise.all([
    supabaseAdmin.from('CandidateNote').select('id, candidateId, content, authorId, createdAt').eq('candidateId', id).order('createdAt', { ascending: false }),
    supabaseAdmin.from('InterviewScore').select('id, candidateId, technicalSkills, communication, cultureFit, reliability, motivation, overallImpression, notes, recommendation, interviewerId, interviewDate, createdAt').eq('candidateId', id).order('createdAt', { ascending: false }),
  ]);

  const notes = (notesRes.data ?? []) as Record<string, unknown>[];
  const scores = (scoresRes.data ?? []) as Record<string, unknown>[];

  // Enrich with user names
  const userIds = new Set<string>();
  for (const n of notes) if (n.authorId) userIds.add(n.authorId as string);
  for (const s of scores) if (s.interviewerId) userIds.add(s.interviewerId as string);

  let usersMap: Record<string, { id: string; name: string; role: string }> = {};
  if (userIds.size > 0) {
    const { data: users } = await supabaseAdmin.from('User').select('id, name, role').in('id', [...userIds]);
    usersMap = Object.fromEntries(((users ?? []) as { id: string; name: string; role: string }[]).map(u => [u.id, u]));
  }

  const enrichedData = {
    ...data,
    candidateNotes: notes.map(n => ({ ...n, author: n.authorId ? usersMap[n.authorId as string] ?? null : null })),
    interviewScores: scores.map(s => ({ ...s, interviewer: s.interviewerId ? usersMap[s.interviewerId as string] ?? null : null })),
  };

  const parts = (data.name ?? '').trim().split(' ');
  const finalData = {
    ...enrichedData,
    firstName: parts[0] ?? '',
    lastName: (parts.slice(1).join(' ') || parts[0]) ?? '',
  };

  return NextResponse.json({ data: finalData });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // Build updates using real column names
  const updates: Record<string, unknown> = {};

  if ('status' in body) {
    updates.status = body.status;
    updates.stageUpdatedAt = new Date().toISOString();
  }
  if ('email' in body) updates.email = body.email;
  if ('phone' in body) updates.phone = body.phone ?? null;
  if ('age' in body) updates.age = body.age ? Number(body.age) : null;
  if ('location' in body) updates.location = body.location ?? null;
  if ('livingSituation' in body) updates.livingSituation = body.livingSituation ?? null;
  if ('partnerEmployment' in body) updates.partnerEmployment = body.partnerEmployment ?? null;
  if ('currentJob' in body) updates.currentJob = body.currentJob ?? null;
  if ('reasonForLeaving' in body) updates.reasonForLeaving = body.reasonForLeaving ?? null;
  if ('salaryExpectation' in body) updates.salaryExpectation = body.salaryExpectation ? String(body.salaryExpectation) : null;
  if ('leadSource' in body) updates.leadSource = body.leadSource ?? null;
  if ('leadCampaignId' in body) updates.leadCampaignId = body.leadCampaignId ?? null;
  if ('assignedToId' in body) updates.assignedToId = body.assignedToId ?? null;
  if ('interviewOutcome' in body) updates.interviewOutcome = body.interviewOutcome ?? null;
  if ('interviewOutcomeAt' in body) updates.interviewOutcomeAt = body.interviewOutcomeAt ?? null;

  // Handle name: accept either combined or split
  if ('firstName' in body || 'lastName' in body) {
    const first = body.firstName ?? '';
    const last = body.lastName ?? '';
    updates.name = `${first} ${last}`.trim();
  } else if ('name' in body) {
    updates.name = body.name;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Geen geldige velden om bij te werken.' }, { status: 400 });
  }

  // Fetch current candidate before update (for email trigger + notifications + audit)
  let currentCandidate: { email: string; name: string; assignedToId: string | null; status?: string } | null = null;
  if (body.status || Object.keys(updates).length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('Candidate')
      .select('email, name, assignedToId, status')
      .eq('id', id)
      .single();
    currentCandidate = existing ?? null;
  }

  updates.updatedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('Candidate')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Kan kandidaat niet bijwerken.' }, { status: 500 });
  }

  // Notify on stage change
  if (body.status && currentCandidate) {
    const assignedId = (body.assignedToId !== undefined ? body.assignedToId : currentCandidate.assignedToId) ?? null;
    await notifyStageChange(id, currentCandidate.name, body.status, assignedId).catch(() => {});
  }

  // Send interview invite email when status moves to INTERVIEW
  if (body.status === 'INTERVIEW' && currentCandidate?.email && isEmailConfigured()) {
    let recruiterName: string | undefined;
    if (currentCandidate.assignedToId) {
      const { data: recruiter } = await supabaseAdmin
        .from('User')
        .select('name')
        .eq('id', currentCandidate.assignedToId)
        .single();
      recruiterName = recruiter?.name;
    }
    try {
      await sendInterviewInviteEmail({
        to: currentCandidate.email,
        candidateName: currentCandidate.name,
        recruiterName,
      });
    } catch (err) {
      console.error('Interview invite email failed:', err);
    }
  }

  // Audit log
  const action = body.status && currentCandidate?.status !== body.status ? 'STATUS_CHANGE' : 'UPDATE';
  logAudit({
    userId: session.userId, action, entity: 'Candidate', entityId: id,
    details: { ...updates, ...(action === 'STATUS_CHANGE' ? { from: currentCandidate?.status, to: body.status } : {}) },
    ipAddress: getIp(request),
  });

  const parts = (data.name ?? '').trim().split(' ');
  return NextResponse.json({
    data: { ...data, firstName: parts[0] ?? '', lastName: (parts.slice(1).join(' ') || parts[0]) ?? '' },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('Candidate')
    .update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .eq('id', id)
    .is('deletedAt', null);

  if (error) {
    return NextResponse.json({ error: 'Kan kandidaat niet verwijderen.' }, { status: 500 });
  }

  logAudit({ userId: session.userId, action: 'DELETE', entity: 'Candidate', entityId: id, ipAddress: getIp(_request) });

  return NextResponse.json({ success: true });
}

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Restore from trash
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('Candidate')
    .update({ deletedAt: null, updatedAt: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Kan kandidaat niet herstellen.' }, { status: 500 });
  }

  logAudit({ userId: session.userId, action: 'RESTORE', entity: 'Candidate', entityId: id, ipAddress: getIp(_request) });

  return NextResponse.json({ success: true });
}
