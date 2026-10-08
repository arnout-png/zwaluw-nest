import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { canManageLeave, LEAVE_MANAGER_ROLES } from '@/lib/permissions';
import { amsterdamDateString, countWorkdays, datePart, isIsoDate } from '@/lib/dates';
import { logAudit, getIp } from '@/lib/audit';
import { parsePermissions } from '@/types';

/**
 * POST /api/leave/[id]/herstel   Body: { lastSickDay?: 'YYYY-MM-DD' } (standaard vandaag)
 *
 * Hersteldmelding voor een ziekmelding: legt de laatste ziektedag vast op de
 * verlofregel én op het poortwachter-dossier (SickTracker). Zonder deze stap
 * bleef een ziekmelding eeuwig "lopend" en kwamen er onterecht poortwachter-
 * herinneringen. Toegestaan voor de medewerker zelf en voor wie verlof beheert.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const today = amsterdamDateString();
  const lastSickDay = body.lastSickDay ?? today;
  if (!isIsoDate(lastSickDay) || lastSickDay > today) {
    return NextResponse.json({ error: 'Ongeldige laatste ziektedag.' }, { status: 400 });
  }

  const { data: leave } = await supabaseAdmin
    .from('LeaveRequest')
    .select('id, employeeProfileId, type, startDate, endDate')
    .eq('id', id)
    .maybeSingle();
  if (!leave || leave.type !== 'SICK') {
    return NextResponse.json({ error: 'Ziekmelding niet gevonden.' }, { status: 404 });
  }

  const { data: ep } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('userId')
    .eq('id', leave.employeeProfileId)
    .maybeSingle();
  const isOwner = (ep as { userId: string } | null)?.userId === session.userId;
  if (!isOwner && !(await canManageLeave(session))) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const start = datePart(leave.startDate as string)!;
  if (lastSickDay < start) {
    return NextResponse.json({ error: 'De laatste ziektedag ligt vóór de eerste ziektedag.' }, { status: 400 });
  }

  const { error: leaveError } = await supabaseAdmin
    .from('LeaveRequest')
    .update({ endDate: lastSickDay, totalDays: countWorkdays(start, lastSickDay), updatedAt: new Date().toISOString() })
    .eq('id', id);
  if (leaveError) {
    console.error('Herstel leave update error:', leaveError.message);
    return NextResponse.json({ error: 'Hersteldmelding opslaan mislukt.' }, { status: 500 });
  }

  // Bijbehorend poortwachter-dossier: zelfde medewerker en eerste ziektedag.
  const { error: trackerError } = await supabaseAdmin
    .from('SickTracker')
    .update({ sicknessEndDate: lastSickDay, updatedAt: new Date().toISOString() })
    .eq('employeeProfileId', leave.employeeProfileId)
    .gte('sicknessStartDate', start)
    .lt('sicknessStartDate', `${start}T23:59:59.999`);
  if (trackerError) console.error('Herstel tracker update error:', trackerError.message);

  await logAudit({
    userId: session.userId,
    action: 'SICK_RECOVERED',
    entity: 'LeaveRequest',
    entityId: id,
    details: { lastSickDay, byOwner: isOwner },
    ipAddress: getIp(request),
  });

  // Beheerders/planners op de hoogte brengen
  const { data: staff } = await supabaseAdmin.from('User').select('id, role, permissions').eq('isActive', true);
  const { data: owner } = await supabaseAdmin
    .from('User')
    .select('name')
    .eq('id', (ep as { userId: string } | null)?.userId ?? '')
    .maybeSingle();
  const recipients = ((staff ?? []) as { id: string; role: string; permissions: string | null }[])
    .filter((u) => u.id !== session.userId)
    .filter((u) => LEAVE_MANAGER_ROLES.includes(u.role) || parsePermissions(u.permissions).canManageLeave)
    .map((u) => u.id);
  if (recipients.length > 0) {
    await supabaseAdmin.from('Notification').insert(
      recipients.map((uid) => ({
        userId: uid,
        type: 'SICK_REPORT',
        title: `Hersteldmelding: ${(owner as { name?: string } | null)?.name ?? 'medewerker'}`,
        message: `Hersteld gemeld; laatste ziektedag ${lastSickDay}.`,
        isRead: false,
        linkUrl: '/dashboard/verzuim',
      }))
    );
  }

  return NextResponse.json({ ok: true, lastSickDay });
}
