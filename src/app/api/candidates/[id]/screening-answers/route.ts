import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

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
    .select(
      `id, questionId, candidateId, answer, answeredById, createdAt, updatedAt,
       answeredBy:User!ScreeningAnswer_answeredById_fkey (id, name),
       question:ScreeningQuestion!ScreeningAnswer_questionId_fkey (id, question, order)`
    )
    .eq('candidateId', candidateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
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

  // Upsert on (questionId, candidateId)
  const { data, error } = await supabaseAdmin
    .from('ScreeningAnswer')
    .upsert(rows, { onConflict: 'questionId,candidateId' })
    .select(
      `id, questionId, candidateId, answer, answeredById, createdAt, updatedAt,
       answeredBy:User!ScreeningAnswer_answeredById_fkey (id, name)`
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 201 });
}
