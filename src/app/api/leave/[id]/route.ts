import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail } from '@/lib/email';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
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
    .select(
      `id, employeeProfileId, type, startDate, endDate, totalDays, status,
       employeeProfile:EmployeeProfile!LeaveRequest_employeeProfileId_fkey (
         userId,
         user:User!EmployeeProfile_userId_fkey (id, name, email)
       )`
    )
    .single();

  if (error) {
    return NextResponse.json({ error: 'Kan verlofaanvraag niet bijwerken.' }, { status: 500 });
  }

  // Send email notification to the employee (best-effort)
  if (process.env.RESEND_API_KEY) {
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
