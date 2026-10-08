import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { canManageLeave, LEAVE_MANAGER_ROLES } from '@/lib/permissions';
import { countWorkdays, isIsoDate } from '@/lib/dates';
import { logAudit, getIp } from '@/lib/audit';
import { parsePermissions } from '@/types';

const LEAVE_TYPES = ['VACATION', 'SICK', 'PERSONAL', 'UNPAID', 'SPECIAL'] as const;
type LeaveTypeValue = (typeof LEAVE_TYPES)[number];

const TYPE_LABELS: Record<LeaveTypeValue, string> = {
  VACATION: 'vakantie', SICK: 'ziekmelding', PERSONAL: 'persoonlijk verlof',
  UNPAID: 'onbetaald verlof', SPECIAL: 'bijzonder verlof',
};

// Helper: get employeeProfileId for the current user
async function getEmployeeProfileId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', userId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Actieve gebruikers die verlof beoordelen: ADMIN/MANAGER/PLANNER of met het recht canManageLeave. */
async function getLeaveManagerIds(excludeUserId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('User')
    .select('id, role, permissions')
    .eq('isActive', true);
  return ((data ?? []) as { id: string; role: string; permissions: string | null }[])
    .filter((u) => u.id !== excludeUserId)
    .filter((u) => LEAVE_MANAGER_ROLES.includes(u.role) || parsePermissions(u.permissions).canManageLeave)
    .map((u) => u.id);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const isManager = await canManageLeave(session);

  let query = supabaseAdmin
    .from('LeaveRequest')
    .select(
      `id, employeeProfileId, type, status, startDate, endDate,
       totalDays, reason, approvedById, respondedAt, createdAt`
    )
    .order('createdAt', { ascending: false });

  if (!isManager) {
    // Filter by current user's employeeProfile
    const employeeProfileId = await getEmployeeProfileId(session.userId);
    if (!employeeProfileId) {
      return NextResponse.json({ data: [] });
    }
    query = query.eq('employeeProfileId', employeeProfileId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('GET /api/leave error:', error.message);
    return NextResponse.json({ error: 'Kan verlofaanvragen niet ophalen.' }, { status: 500 });
  }

  // Enrich with employee + approver names
  const rows = (data ?? []) as Record<string, unknown>[];
  const epIds = [...new Set(rows.map(r => r.employeeProfileId as string).filter(Boolean))];
  const approverIds = [...new Set(rows.map(r => r.approvedById as string).filter(Boolean))];

  const epUserMap: Record<string, { userId: string; user: { id: string; name: string; email: string; role: string } }> = {};
  if (epIds.length) {
    const { data: eps } = await supabaseAdmin.from('EmployeeProfile').select('id, userId').in('id', epIds);
    if (eps?.length) {
      const uIds = (eps as { userId: string }[]).map(e => e.userId);
      const { data: users } = await supabaseAdmin.from('User').select('id, name, email, role').in('id', uIds);
      const uMap = Object.fromEntries(((users ?? []) as { id: string; name: string; email: string; role: string }[]).map(u => [u.id, u]));
      for (const ep of eps as { id: string; userId: string }[]) {
        epUserMap[ep.id] = { userId: ep.userId, user: uMap[ep.userId] ?? { id: ep.userId, name: 'Onbekend', email: '', role: '' } };
      }
    }
  }

  let approverMap: Record<string, { id: string; name: string }> = {};
  if (approverIds.length) {
    const { data: approvers } = await supabaseAdmin.from('User').select('id, name').in('id', approverIds);
    approverMap = Object.fromEntries(((approvers ?? []) as { id: string; name: string }[]).map(u => [u.id, u]));
  }

  const enriched = rows.map(r => ({
    ...r,
    employeeProfile: r.employeeProfileId ? epUserMap[r.employeeProfileId as string] ?? null : null,
    approvedBy: r.approvedById ? approverMap[r.approvedById as string] ?? null : null,
  }));

  return NextResponse.json({ data: enriched });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { type, startDate, endDate } = body as { type?: string; startDate?: unknown; endDate?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';

  if (!type || !LEAVE_TYPES.includes(type as LeaveTypeValue)) {
    return NextResponse.json({ error: 'Ongeldig verloftype.' }, { status: 400 });
  }
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return NextResponse.json(
      { error: 'Start- en einddatum zijn verplicht (JJJJ-MM-DD).' },
      { status: 400 }
    );
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: 'De einddatum ligt vóór de startdatum.' }, { status: 400 });
  }

  // Werkdagen altijd op de server berekenen; het getal uit de browser werd
  // voorheen ongecontroleerd opgeslagen.
  const totalDays = countWorkdays(startDate, endDate);
  if (totalDays === 0) {
    return NextResponse.json({ error: 'De gekozen periode bevat geen werkdagen.' }, { status: 400 });
  }
  if (totalDays > 260) {
    return NextResponse.json({ error: 'De periode is te lang (maximaal één jaar).' }, { status: 400 });
  }

  const employeeProfileId = await getEmployeeProfileId(session.userId);
  if (!employeeProfileId) {
    return NextResponse.json(
      { error: 'Geen medewerkersprofiel gevonden. Neem contact op met de beheerder.' },
      { status: 404 }
    );
  }

  const isSick = type === 'SICK';

  const { data, error } = await supabaseAdmin
    .from('LeaveRequest')
    .insert({
      employeeProfileId,
      type,
      startDate,
      endDate,
      totalDays,
      status: isSick ? 'APPROVED' : 'PENDING',
      reason: reason || null,
    })
    .select()
    .single();

  if (error) {
    console.error('POST /api/leave error:', error.message);
    return NextResponse.json({ error: 'Kan verlofaanvraag niet aanmaken.' }, { status: 500 });
  }

  // Ziekmelding → poortwachter-dossier. De opgegeven einddatum is de verwachte
  // hersteldatum; zonder die datum bleef elke ziekmelding (ook van één dag)
  // voor altijd "lopend" en kwamen er poortwachter-alarmen voor mensen die
  // allang beter waren.
  if (isSick) {
    const { error: trackerError } = await supabaseAdmin.from('SickTracker').insert({
      employeeProfileId,
      sicknessStartDate: startDate,
      sicknessEndDate: endDate,
      week6ProblemAnalysis: false,
      week8ActionPlan: false,
      week42UwvNotification: false,
    });
    if (trackerError) console.error('POST /api/leave SickTracker error:', trackerError.message);
  }

  // In-app melding voor wie het moet beoordelen / weten.
  const recipients = await getLeaveManagerIds(session.userId);
  if (recipients.length > 0) {
    const label = TYPE_LABELS[type as LeaveTypeValue];
    const { error: notifError } = await supabaseAdmin.from('Notification').insert(
      recipients.map((uid) => ({
        userId: uid,
        type: isSick ? 'SICK_REPORT' : 'LEAVE_REQUEST',
        title: isSick ? `Ziekmelding: ${session.name}` : `Verlofaanvraag: ${session.name}`,
        message: isSick
          ? `${session.name} heeft zich ziek gemeld vanaf ${startDate} (verwacht t/m ${endDate}).`
          : `${session.name} vraagt ${totalDays} dag(en) ${label} aan (${startDate} t/m ${endDate}).`,
        isRead: false,
        linkUrl: '/dashboard/verzuim',
      }))
    );
    if (notifError) console.error('POST /api/leave notification error:', notifError.message);
  }

  await logAudit({
    userId: session.userId,
    action: 'CREATE',
    entity: 'LeaveRequest',
    entityId: (data as { id: string }).id,
    details: { type, startDate, endDate, totalDays },
    ipAddress: getIp(request),
  });

  return NextResponse.json({ data }, { status: 201 });
}
