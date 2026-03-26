import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

type RawResult = {
  id?: string;
  itemId: string;
  candidateId: string;
  checked: boolean;
  checkedById: string | null;
  checkedAt: string | null;
};

async function enrichResult(row: RawResult) {
  if (!row.checkedById) return { ...row, checkedBy: null };
  const { data } = await supabaseAdmin
    .from('User').select('id, name').eq('id', row.checkedById).maybeSingle();
  return { ...row, checkedBy: data ?? null };
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
    .from('InterviewChecklistResult')
    .select('id, itemId, candidateId, checked, checkedById, checkedAt')
    .eq('candidateId', candidateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as RawResult[];
  if (!rows.length) return NextResponse.json({ data: [] });

  const userIds = [...new Set(rows.map(r => r.checkedById).filter(Boolean))] as string[];
  const { data: users } = userIds.length
    ? await supabaseAdmin.from('User').select('id, name').in('id', userIds)
    : { data: [] };
  const usersMap = Object.fromEntries(((users ?? []) as { id: string; name: string }[]).map(u => [u.id, u]));

  return NextResponse.json({
    data: rows.map(r => ({ ...r, checkedBy: r.checkedById ? (usersMap[r.checkedById] ?? null) : null })),
  });
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
    .select('id, itemId, candidateId, checked, checkedById, checkedAt')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const enriched = await enrichResult(data as RawResult);
  return NextResponse.json({ data: enriched });
}
