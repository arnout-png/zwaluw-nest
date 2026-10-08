import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getLeaveRequests, getVacationDaysUsed } from '@/lib/data';
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
    .maybeSingle();

  const employeeProfileId = profileRow?.id as string | undefined;
  const leaveBalance = (profileRow as { leaveBalanceDays?: number } | null)?.leaveBalanceDays ?? 25;
  const manualUsed = (profileRow as { leaveUsedDays?: number } | null)?.leaveUsedDays ?? 0;

  // Zonder profiel géén aanvragen tonen: getLeaveRequests(undefined) geeft die
  // van álle medewerkers terug (incl. ziekmeldingen).
  const [leaveRequests, used] = employeeProfileId
    ? await Promise.all([getLeaveRequests(employeeProfileId), getVacationDaysUsed([employeeProfileId])])
    : [[], {} as Record<string, number>];

  return (
    <MijnVerlofClient
      leaveRequests={leaveRequests}
      leaveBalance={leaveBalance}
      leaveUsed={manualUsed + (employeeProfileId ? used[employeeProfileId] ?? 0 : 0)}
      hasProfile={!!employeeProfileId}
    />
  );
}
