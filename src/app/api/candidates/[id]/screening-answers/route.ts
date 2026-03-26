import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

type RawAnswer = {
  id?: string;
  questionId: string;
  candidateId: string;
  answer: string;
  answeredById: string | null;
  createdAt: string;
  updatedAt: string;
};

async function enrichAnswers(rows: RawAnswer[]) {
  if (!rows.length) return rows;
  const userIds = [...new Set(rows.map(r => r.answeredById).filter(Boolean))] as string[];
  const { data: users } = userIds.length
    ? await supabaseAdmin.from('User').select('id, name').in('id', userIds)
    : { data: [] };
  const usersMap = Object.fromEntries(
    ((users ?? []) as { id: string; name: string }[]).map(u => [u.id, u])
  );
  return rows.map(r => ({
    ...r,
    answeredBy: r.answeredById ? (usersMap[r.answeredById] ?? null) : null,
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id: candidateId } = await params;

  const { data, error } = await supabaseAdmin
    .from('ScreeningAnswer')
    .select('id, questionId, candidateId, answer, answeredById, createdAt, updatedAt')
    .eq('candidateId', candidateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const enriched = await enrichAnswers((data ?? []) as RawAnswer[]);
  return NextResponse.json({ data: enriched });
}

/**
 * POST body: { answers: [{ questionId, answer }] }
 * Upserts answers (one per question per candidate), logs who answered.
 */
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
  const body = await request.json();
  const answers: { questionId: string; answer: string }[] = body.answers ?? [];

  if (!answers.length) return NextResponse.json({ error: 'Geen antwoorden opgegeven.' }, { status: 400 });

  const now = new Date().toISOString();
  const rows = answers.map(a => ({
    questionId: a.questionId,
    candidateId,
    answer: a.answer,
    answeredById: session.userId,
    createdAt: now,
    updatedAt: now,
  }));

  // Upsert on (questionId, candidateId) — no FK join in select
  const { data, error } = await supabaseAdmin
    .from('ScreeningAnswer')
    .upsert(rows, { onConflict: 'questionId,candidateId' })
    .select('id, questionId, candidateId, answer, answeredById, createdAt, updatedAt');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const enriched = await enrichAnswers((data ?? []) as RawAnswer[]);
  return NextResponse.json({ data: enriched }, { status: 201 });
}
