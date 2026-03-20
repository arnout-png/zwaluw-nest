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
    .from('InterviewChecklistResult')
    .select(
      `id, itemId, candidateId, checked, checkedById, checkedAt,
       checkedBy:User!InterviewChecklistResult_checkedById_fkey (id, name)`
    )
    .eq('candidateId', candidateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

/**
 * PATCH body: { itemId, checked }
 * Upserts a single checklist item result.
 */
export async function PATCH(
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
  const { itemId, checked } = body;

  if (!itemId) return NextResponse.json({ error: 'itemId is verplicht.' }, { status: 400 });

  const now = new Date().toISOString();
  const row = {
    itemId,
    candidateId,
    checked: checked ?? true,
    checkedById: session.userId,
    checkedAt: checked ? now : null,
  };

  const { data, error } = await supabaseAdmin
    .from('InterviewChecklistResult')
    .upsert(row, { onConflict: 'itemId,candidateId' })
    .select(
      `id, itemId, candidateId, checked, checkedById, checkedAt,
       checkedBy:User!InterviewChecklistResult_checkedById_fkey (id, name)`
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
