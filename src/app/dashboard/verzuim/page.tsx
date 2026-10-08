import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getLeaveRequests } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase';
import { canManageLeave } from '@/lib/permissions';
import { VerzuimClient } from './verzuim-client';

export default async function VerzuimPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const isManager = await canManageLeave(session);

  // Resolve EmployeeProfile.id for the current user
  const { data: profileRow } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', session.userId)
    .maybeSingle();
  const employeeProfileId = profileRow?.id as string | undefined;

  // Medewerkers zonder profiel krijgen niets te zien (getLeaveRequests(undefined)
  // geeft de aanvragen van iedereen terug, inclusief ziekmeldingen).
  const leaveRequests = isManager
    ? await getLeaveRequests()
    : employeeProfileId
      ? await getLeaveRequests(employeeProfileId)
      : [];

  return (
    <VerzuimClient
      leaveRequests={leaveRequests}
      isManager={isManager}
      userId={session.userId}
      employeeProfileId={employeeProfileId}
    />
  );
}
