import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import type { CallStatus } from '@/types';
import { logAudit, getIp } from '@/lib/audit';

const VALID_STATUSES: CallStatus[] = ['GEEN_GEHOOR', 'VOICEMAIL', 'BEREIKT', 'TERUGBELLEN', 'FOUTIEF_NUMMER'];

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
  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
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

  // Auto-advance logic based on call status
  if (['BEREIKT', 'VOICEMAIL', 'GEEN_GEHOOR', 'TERUGBELLEN', 'FOUTIEF_NUMMER'].includes(status)) {
    const { data: candidate } = await supabaseAdmin
      .from('Candidate')
      .select('status')
      .eq('id', candidateId)
      .single();

    const currentStatus = (candidate as { status: string } | null)?.status;

    // BEREIKT = kandidaat daadwerkelijk gesproken → screening starten
    if (status === 'BEREIKT' && (currentStatus === 'NEW_LEAD' || currentStatus === 'CONTACTED')) {
      await supabaseAdmin
        .from('Candidate')
        .update({
          status: 'PRE_SCREENING',
          stageUpdatedAt: new Date().toISOString(),
        })
        .eq('id', candidateId);
    }
    // Andere belpogingen (geen gehoor, voicemail, terugbellen, foutief nr) → CONTACTED
    else if (currentStatus === 'NEW_LEAD') {
      await supabaseAdmin
        .from('Candidate')
        .update({
          status: 'CONTACTED',
          stageUpdatedAt: new Date().toISOString(),
        })
        .eq('id', candidateId);
    }
  }

  logAudit({ userId: session.userId, action: 'CALL', entity: 'Candidate', entityId: candidateId, details: { callStatus: status, notes, callbackAt }, ipAddress: getIp(request) });

  // Auto-notification for GEEN_GEHOOR / VOICEMAIL → remind assigned recruiter
  if (status === 'GEEN_GEHOOR' || status === 'VOICEMAIL') {
    const { data: cand } = await supabaseAdmin
      .from('Candidate')
      .select('name, assignedToId')
      .eq('id', candidateId)
      .single();

    const candData = cand as { name: string; assignedToId?: string | null } | null;
    const candName = candData?.name ?? 'Onbekend';
    const message = status === 'GEEN_GEHOOR'
      ? `Geen gehoor bij ${candName}. Probeer morgen opnieuw.`
      : `Voicemail achtergelaten bij ${candName}. Volg op.`;

    // Notify assigned recruiter, or all ADMIN/MANAGER if unassigned
    let targetUserIds: string[] = [];
    if (candData?.assignedToId && candData.assignedToId !== session.userId) {
      targetUserIds = [candData.assignedToId];
    } else if (!candData?.assignedToId) {
      const { data: admins } = await supabaseAdmin.from('User').select('id').in('role', ['ADMIN', 'MANAGER']).eq('isActive', true);
      targetUserIds = ((admins ?? []) as { id: string }[]).map(u => u.id).filter(id => id !== session.userId);
    }

    if (targetUserIds.length > 0) {
      const notifications = targetUserIds.map(uid => ({
        id: crypto.randomUUID(),
        userId: uid,
        type: 'SYSTEM' as const,
        title: `Opnieuw bellen: ${candName}`,
        message,
        linkUrl: `/dashboard/werving/${candidateId}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      }));
      try { await supabaseAdmin.from('Notification').insert(notifications); } catch { /* silent */ }
    }
  }

  const userData = { id: session.userId, name: session.name };
  return NextResponse.json({ data: { ...log, user: userData } }, { status: 201 });
}
