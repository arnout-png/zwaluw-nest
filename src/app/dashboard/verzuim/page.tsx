import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getLeaveRequests } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase';
import { VerzuimClient } from './verzuim-client';

export default async function VerzuimPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const isManager = session.role === 'ADMIN' || session.role === 'PLANNER';

  // Resolve EmployeeProfile.id for the current user
  const { data: profileRow } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', session.userId)
    .single();
  const employeeProfileId = profileRow?.id as string | undefined;

  const leaveRequests = await getLeaveRequests(
    isManager ? undefined : employeeProfileId
  );

  return (
    <VerzuimClient
      leaveRequests={leaveRequests}
      role={session.role}
      userId={session.userId}
      employeeProfileId={employeeProfileId}
    />
  );
}
