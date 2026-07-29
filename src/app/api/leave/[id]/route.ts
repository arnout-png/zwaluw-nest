import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail, isEmailConfigured } from '@/lib/email';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json(
      { error: 'Alleen beheerders en planners kunnen verlof goedkeuren of afwijzen.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json(
      { error: 'Status moet APPROVED of REJECTED zijn.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('LeaveRequest')
    .update({
      status,
      approvedById: session.userId,
      respondedAt: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, employeeProfileId, type, startDate, endDate, totalDays, status')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Kan verlofaanvraag niet bijwerken.' }, { status: 500 });
  }

  // Enrich with employee user info
  let employeeProfile: { userId: string; user: { id: string; name: string; email: string } } | null = null;
  if (data.employeeProfileId) {
    const { data: ep } = await supabaseAdmin.from('EmployeeProfile').select('userId').eq('id', data.employeeProfileId).maybeSingle();
    if (ep) {
      const { data: usr } = await supabaseAdmin.from('User').select('id, name, email').eq('id', (ep as { userId: string }).userId).maybeSingle();
      employeeProfile = { userId: (ep as { userId: string }).userId, user: (usr as { id: string; name: string; email: string }) ?? { id: '', name: 'Onbekend', email: '' } };
    }
  }
  (data as Record<string, unknown>).employeeProfile = employeeProfile;

  // Send email notification to the employee (best-effort)
  if (isEmailConfigured()) {
    try {
      const profileRaw = (data as Record<string, unknown>).employeeProfile;
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
      const userRaw = (profile as Record<string, unknown> | undefined)?.user;
      const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;

      if ((user as { email?: string } | undefined)?.email) {
        const u = user as { name: string; email: string };
        const startNL = new Date(data.startDate).toLocaleDateString('nl-NL', {
          day: 'numeric', month: 'long', year: 'numeric',
        });
        const endNL = new Date(data.endDate ?? data.startDate).toLocaleDateString('nl-NL', {
          day: 'numeric', month: 'long', year: 'numeric',
        });

        if (status === 'APPROVED') {
          await sendLeaveApprovedEmail({
            to: u.email,
            name: u.name,
            type: data.type,
            startDate: startNL,
            endDate: endNL,
            days: data.totalDays ?? 0,
          });
        } else {
          await sendLeaveRejectedEmail({
            to: u.email,
            name: u.name,
            type: data.type,
            startDate: startNL,
            endDate: endNL,
            days: data.totalDays ?? 0,
          });
        }
      }
    } catch (emailErr) {
      console.error('Leave email notification failed (non-fatal):', emailErr);
    }
  }

  return NextResponse.json({ data });
}
