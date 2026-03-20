import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('Candidate')
    .select(
      `id, status, name, email, phone, age, location, livingSituation,
       partnerEmployment, currentJob, reasonForLeaving, salaryExpectation,
       consentGiven, consentDate, consentExpiresAt, leadSource, leadCampaignId,
       prescreeningToken, prescreeningExpiresAt, createdAt, updatedAt,
       candidateNotes:CandidateNote (
         id, candidateId, content, authorId, createdAt,
         author:User!CandidateNote_authorId_fkey (id, name, role)
       ),
       interviewScores:InterviewScore (
         id, candidateId, technicalSkills, communication, cultureFit,
         reliability, motivation, overallImpression, notes, recommendation,
         interviewerId, interviewDate, createdAt,
         interviewer:User!InterviewScore_interviewerId_fkey (id, name, role)
       )`
    )
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Kandidaat niet gevonden.' }, { status: 404 });
  }

  const parts = (data.name ?? '').trim().split(' ');
  const enriched = {
    ...data,
    firstName: parts[0] ?? '',
    lastName: (parts.slice(1).join(' ') || parts[0]) ?? '',
  };

  return NextResponse.json({ data: enriched });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // Build updates using real column names
  const updates: Record<string, unknown> = {};

  if ('status' in body) updates.status = body.status;
  if ('email' in body) updates.email = body.email;
  if ('phone' in body) updates.phone = body.phone;
  if ('location' in body) updates.location = body.location;
  if ('salaryExpectation' in body) updates.salaryExpectation = body.salaryExpectation ? String(body.salaryExpectation) : null;
  if ('leadSource' in body) updates.leadSource = body.leadSource ?? null;
  if ('assignedToId' in body) updates.assignedToId = body.assignedToId ?? null;

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

  const parts = (data.name ?? '').trim().split(' ');
  return NextResponse.json({
    data: { ...data, firstName: parts[0] ?? '', lastName: (parts.slice(1).join(' ') || parts[0]) ?? '' },
  });
}
