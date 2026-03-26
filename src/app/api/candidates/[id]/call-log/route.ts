import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import type { CallStatus } from '@/types';

const VALID_STATUSES: CallStatus[] = ['GEEN_GEHOOR', 'VOICEMAIL', 'BEREIKT', 'TERUGBELLEN'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });

  const { id: candidateId } = await params;

  const { data, error } = await supabaseAdmin
    .from('CallLog')
    .select('id, candidateId, userId, status, notes, callbackAt, createdAt')
    .eq('candidateId', candidateId)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('GET call-log error:', error.message);
    return NextResponse.json({ data: [] });
  }

  const rows = (data ?? []) as { id: string; candidateId: string; userId: string; status: string; notes: string | null; callbackAt: string | null; createdAt: string }[];
  if (!rows.length) return NextResponse.json({ data: [] });

  const userIds = [...new Set(rows.map(r => r.userId))];
  const { data: users } = await supabaseAdmin.from('User').select('id, name').in('id', userIds);
  const usersMap = Object.fromEntries(((users ?? []) as { id: string; name: string }[]).map(u => [u.id, u]));

  return NextResponse.json({
    data: rows.map(r => ({ ...r, user: r.userId ? (usersMap[r.userId] ?? null) : null })),
  });
}

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
  const status = body.status as CallStatus;
  const notes = (body.notes ?? '').trim() || null;
  const callbackAt = body.callbackAt ? new Date(body.callbackAt).toISOString() : null;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Ongeldige belstatus.' }, { status: 400 });
  }

  // Insert call log (id must be provided — no DB default)
  const { data: log, error } = await supabaseAdmin
    .from('CallLog')
    .insert({
      id: crypto.randomUUID(),
      candidateId,
      userId: session.userId,
      status,
      notes,
      callbackAt,
      createdAt: new Date().toISOString(),
    })
    .select('id, candidateId, userId, status, notes, callbackAt, createdAt')
    .single();

  if (error) {
    console.error('POST call-log error:', error.message);
    return NextResponse.json({ error: 'Kan bel poging niet opslaan.' }, { status: 500 });
  }

  // If BEREIKT and candidate still NEW_LEAD → advance to PRE_SCREENING
  if (status === 'BEREIKT') {
    const { data: candidate } = await supabaseAdmin
      .from('Candidate')
      .select('status')
      .eq('id', candidateId)
      .single();

    if ((candidate as { status: string } | null)?.status === 'NEW_LEAD') {
      await supabaseAdmin
        .from('Candidate')
        .update({
          status: 'PRE_SCREENING',
          stageUpdatedAt: new Date().toISOString(),
        })
        .eq('id', candidateId);
    }
  }

  const userData = { id: session.userId, name: session.name };
  return NextResponse.json({ data: { ...log, user: userData } }, { status: 201 });
}
