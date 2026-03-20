import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getLeaveRequests } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase';
import { MijnVerlofClient } from './mijn-verlof-client';

export default async function MijnVerlofPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Resolve EmployeeProfile for the current user
  const { data: profileRow } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id, leaveBalanceDays, leaveUsedDays')
    .eq('userId', session.userId)
    .single();

  const employeeProfileId = profileRow?.id as string | undefined;
  const leaveBalance = (profileRow as { leaveBalanceDays?: number } | null)?.leaveBalanceDays ?? 25;
  const leaveUsed = (profileRow as { leaveUsedDays?: number } | null)?.leaveUsedDays ?? 0;

  const leaveRequests = await getLeaveRequests(employeeProfileId);

  return (
    <MijnVerlofClient
      leaveRequests={leaveRequests}
      leaveBalance={leaveBalance}
      leaveUsed={leaveUsed}
    />
  );
}
