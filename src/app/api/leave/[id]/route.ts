import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail, isEmailConfigured } from '@/lib/email';
import { canManageLeave } from '@/lib/permissions';
import { logAudit, getIp } from '@/lib/audit';

type LeaveRow = {
  id: string;
  employeeProfileId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string | null;
  totalDays: number | null;
};

const LEAVE_COLUMNS = 'id, employeeProfileId, type, status, startDate, endDate, totalDays';

function formatNL(date: string): string {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
  });
}

/**
 * PATCH /api/leave/[id]
 * - Beoordelaar (ADMIN/MANAGER/PLANNER of recht canManageLeave): { status: 'APPROVED' | 'REJECTED', notes? }
 * - Aanvrager zelf: { status: 'CANCELLED' } zolang de aanvraag nog openstaat.
 *
 * Alleen openstaande (PENDING) aanvragen kunnen worden beoordeeld of ingetrokken,
 * en niemand beoordeelt zijn eigen aanvraag.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as string | undefined;
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : undefined;

  if (!status || !['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
    return NextResponse.json(
      { error: 'Status moet APPROVED, REJECTED of CANCELLED zijn.' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('LeaveRequest')
    .select(LEAVE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Verlofaanvraag niet gevonden.' }, { status: 404 });
  }
  const leave = existing as LeaveRow;

  const { data: ep } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('userId')
    .eq('id', leave.employeeProfileId)
    .maybeSingle();
  const ownerUserId = (ep as { userId: string } | null)?.userId ?? null;
  const isOwner = ownerUserId === session.userId;

  if (status === 'CANCELLED') {
    if (!isOwner) {
      return NextResponse.json({ error: 'Alleen de aanvrager kan een aanvraag intrekken.' }, { status: 403 });
    }
  } else {
    if (!(await canManageLeave(session))) {
      return NextResponse.json(
        { error: 'Alleen beheerders en planners kunnen verlof goedkeuren of afwijzen.' },
        { status: 403 }
      );
    }
    if (isOwner) {
      return NextResponse.json({ error: 'Je kunt je eigen verlofaanvraag niet beoordelen.' }, { status: 403 });
    }
  }

  if (leave.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Deze aanvraag is al afgehandeld.' },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> =
    status === 'CANCELLED'
      ? { status }
      : { status, approvedById: session.userId, respondedAt: new Date().toISOString() };
  if (notes !== undefined && status !== 'CANCELLED') update.notes = notes || null;

  const { data, error } = await supabaseAdmin
    .from('LeaveRequest')
    .update(update)
    .eq('id', id)
    .eq('status', 'PENDING') // geen race met een gelijktijdige beoordeling
    .select(LEAVE_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Kan verlofaanvraag niet bijwerken.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Deze aanvraag is al afgehandeld.' }, { status: 409 });
  }
  const updated = data as LeaveRow;

  await logAudit({
    userId: session.userId,
    action: status === 'CANCELLED' ? 'CANCEL' : status === 'APPROVED' ? 'APPROVE' : 'REJECT',
    entity: 'LeaveRequest',
    entityId: id,
    details: { from: 'PENDING', to: status, type: updated.type },
    ipAddress: getIp(request),
  });

  // Enrich with employee user info
  let employeeProfile: { userId: string; user: { id: string; name: string; email: string } } | null = null;
  if (ownerUserId) {
    const { data: usr } = await supabaseAdmin.from('User').select('id, name, email').eq('id', ownerUserId).maybeSingle();
    if (usr) employeeProfile = { userId: ownerUserId, user: usr as { id: string; name: string; email: string } };
  }

  // In-app melding + e-mail naar de medewerker (best-effort)
  if (status !== 'CANCELLED' && employeeProfile) {
    const startNL = formatNL(updated.startDate);
    const endNL = formatNL(updated.endDate ?? updated.startDate);

    const { error: notifError } = await supabaseAdmin.from('Notification').insert({
      userId: employeeProfile.userId,
      type: status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      title: status === 'APPROVED' ? 'Verlof goedgekeurd' : 'Verlofaanvraag afgewezen',
      message: `Je aanvraag voor ${startNL} – ${endNL} is ${status === 'APPROVED' ? 'goedgekeurd' : 'afgewezen'} door ${session.name}.`,
      isRead: false,
      linkUrl: '/dashboard/mijn-verlof',
    });
    if (notifError) console.error('Leave notification failed (non-fatal):', notifError.message);

    if (isEmailConfigured() && employeeProfile.user.email) {
      try {
        const opts = {
          to: employeeProfile.user.email,
          name: employeeProfile.user.name,
          type: updated.type,
          startDate: startNL,
          endDate: endNL,
          days: updated.totalDays ?? 0,
        };
        if (status === 'APPROVED') await sendLeaveApprovedEmail(opts);
        else await sendLeaveRejectedEmail(opts);
      } catch (emailErr) {
        console.error('Leave email notification failed (non-fatal):', emailErr);
      }
    }
  }

  return NextResponse.json({ data: { ...updated, employeeProfile } });
}
