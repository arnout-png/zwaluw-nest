import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Beheerder', PLANNER: 'Planner', ADVISEUR: 'Adviseur',
  MONTEUR: 'Monteur', CALLCENTER: 'Callcenter', BACKOFFICE: 'Backoffice', WAREHOUSE: 'Magazijn',
};

const CANDIDATE_LABELS: Record<string, string> = {
  NEW_LEAD: 'Nieuwe lead', PRE_SCREENING: 'Pre-screening', SCREENING_DONE: 'Gescreend',
  INTERVIEW: 'Gesprek', RESERVE_BANK: 'Reservebank', HIRED: 'Aangenomen', REJECTED: 'Afgewezen',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vakantie', SICK: 'Ziek', PERSONAL: 'Persoonlijk', UNPAID: 'Onbetaald', SPECIAL: 'Bijzonder',
};

export default async function RapportagePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') redirect('/dashboard');

  // ── Fetch all data in parallel ──────────────────────────────────────────────
  const [
    employeesRes,
    contractsRes,
    leaveRes,
    candidatesRes,
    sickRes,
    appointmentsRes,
  ] = await Promise.all([
    // Employees with profile
    supabaseAdmin
      .from('User')
      .select(`id, role, isActive, employeeProfile:EmployeeProfile!EmployeeProfile_userId_fkey(id, department, leaveBalanceDays, leaveUsedDays, startDate)`)
      .eq('isActive', true),

    // All active contracts + expiring
    supabaseAdmin
      .from('Contract')
      .select('id, status, endDate, contractType, contractSequence, employeeProfileId'),

    // Leave requests (last 90 days)
    supabaseAdmin
      .from('LeaveRequest')
      .select('id, type, status, totalDays, startDate, createdAt')
      .gte('createdAt', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),

    // Candidates
    supabaseAdmin
      .from('Candidate')
      .select('id, status, createdAt'),

    // Active sick trackers
    supabaseAdmin
      .from('SickTracker')
      .select('id, sicknessStartDate, sicknessEndDate, week6ProblemAnalysis, week8ActionPlan, week42UwvNotification')
      .is('sicknessEndDate', null),

    // Appointments this month
    supabaseAdmin
      .from('Appointment')
      .select('id, status, date')
      .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
      .lte('date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]),
  ]);

  type EmpRow = {
    id: string; role: string; isActive: boolean;
    employeeProfile?: { id: string; department?: string; leaveBalanceDays: number; leaveUsedDays: number; startDate?: string } | null;
  };
  const employees = (employeesRes.data as unknown as EmpRow[]) ?? [];
  const contracts = (contractsRes.data ?? []) as { id: string; status: string; endDate?: string; contractType: string; contractSequence: number; employeeProfileId: string }[];
  const leaveRequests = (leaveRes.data ?? []) as { id: string; type: string; status: string; totalDays?: number; startDate: string; createdAt: string }[];
  const candidates = (candidatesRes.data ?? []) as { id: string; status: string; createdAt: string }[];
  const sickTrackers = (sickRes.data ?? []) as { id: string; sicknessStartDate: string; sicknessEndDate?: string; week6ProblemAnalysis: boolean; week8ActionPlan: boolean; week42UwvNotification: boolean }[];
  const appointments = (appointmentsRes.data ?? []) as { id: string; status: string; date: string }[];

  // ── Derived stats ────────────────────────────────────────────────────────────
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Headcount by role
  const roleCount: Record<string, number> = {};
  for (const e of employees) {
    roleCount[e.role] = (roleCount[e.role] ?? 0) + 1;
  }

  // Headcount by department
  const deptCount: Record<string, number> = {};
  for (const e of employees) {
    const dept = e.employeeProfile?.department || 'Onbekend';
    deptCount[dept] = (deptCount[dept] ?? 0) + 1;
  }
  const deptEntries = Object.entries(deptCount).sort((a, b) => b[1] - a[1]);
  const maxDept = Math.max(...deptEntries.map(([, v]) => v), 1);

  // Contract stats
  const activeContracts = contracts.filter((c) => c.status === 'ACTIVE');
  const expiringIn30 = activeContracts.filter((c) => c.endDate && c.endDate >= todayStr && c.endDate <= in30);
  const expiringIn60 = activeContracts.filter((c) => c.endDate && c.endDate >= todayStr && c.endDate <= in60);
  const permanentContracts = activeContracts.filter((c) => !c.endDate);
  const contractTypeCount: Record<string, number> = {};
  for (const c of activeContracts) {
    contractTypeCount[c.contractType] = (contractTypeCount[c.contractType] ?? 0) + 1;
  }

  // Leave stats
  const leaveByType: Record<string, number> = {};
  const leaveByStatus: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
  let totalLeaveDays = 0;
  for (const lr of leaveRequests) {
    leaveByType[lr.type] = (leaveByType[lr.type] ?? 0) + 1;
    leaveByStatus[lr.status] = (leaveByStatus[lr.status] ?? 0) + 1;
    if (lr.status === 'APPROVED') totalLeaveDays += lr.totalDays ?? 0;
  }

  // Leave balance aggregated
  const totalBalance = employees.reduce((s, e) => s + (e.employeeProfile?.leaveBalanceDays ?? 0), 0);
  const totalUsed = employees.reduce((s, e) => s + (e.employeeProfile?.leaveUsedDays ?? 0), 0);
  const avgUsedPct = employees.length > 0 ? Math.round((totalUsed / Math.max(totalBalance, 1)) * 100) : 0;

  // Candidate pipeline
  const pipelineOrder = ['NEW_LEAD', 'PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW', 'RESERVE_BANK', 'HIRED', 'REJECTED'];
  const candidateByStatus: Record<string, number> = {};
  for (const c of candidates) {
    candidateByStatus[c.status] = (candidateByStatus[c.status] ?? 0) + 1;
  }
  const activeCandidates = candidates.filter((c) => !['HIRED', 'REJECTED'].includes(c.status)).length;

  // Sick leave milestones
  const sick6Due = sickTrackers.filter((s) => !s.week6ProblemAnalysis).length;
  const sick8Due = sickTrackers.filter((s) => !s.week8ActionPlan).length;
  const sick42Due = sickTrackers.filter((s) => !s.week42UwvNotification).length;

  // Appointments this month
  const apptCompleted = appointments.filter((a) => a.status === 'COMPLETED').length;
  const apptPlanned = appointments.filter((a) => ['SCHEDULED', 'CONFIRMED'].length > 0 && ['SCHEDULED', 'CONFIRMED'].includes(a.status)).length;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Rapportage</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">Overzicht van personeel, verzuim, werving en planning</p>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Actieve medewerkers', value: employees.length, sub: `${Object.keys(roleCount).length} rollen`, color: 'text-[#68b0a6]' },
          { label: 'Actieve contracten', value: activeContracts.length, sub: `${expiringIn60.length} verlopen binnenkort`, color: expiringIn30.length > 0 ? 'text-red-400' : 'text-[#f7a247]' },
          { label: 'Verlofaanvragen (90d)', value: leaveRequests.length, sub: `${leaveByStatus.PENDING} openstaand`, color: leaveByStatus.PENDING > 0 ? 'text-[#f7a247]' : 'text-[#68b0a6]' },
          { label: 'Actieve kandidaten', value: activeCandidates, sub: `${candidates.length} totaal`, color: 'text-blue-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[#363848] bg-[#252732] p-4">
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-sm font-medium text-white mt-0.5">{kpi.label}</div>
            <div className="text-xs text-[#9ca3af] mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Headcount by role */}
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Medewerkers per rol</h2>
          <div className="space-y-2.5">
            {Object.entries(roleCount)
              .sort((a, b) => b[1] - a[1])
              .map(([role, count]) => {
                const pct = Math.round((count / employees.length) * 100);
                return (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#9ca3af]">{ROLE_LABELS[role] ?? role}</span>
                      <span className="text-xs font-medium text-white">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#363848] overflow-hidden">
                      <div className="h-full rounded-full bg-[#68b0a6] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Headcount by department */}
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Medewerkers per afdeling</h2>
          {deptEntries.length === 0 ? (
            <p className="text-sm text-[#9ca3af] py-4 text-center">Geen afdelingsdata beschikbaar.</p>
          ) : (
            <div className="space-y-2.5">
              {deptEntries.map(([dept, count]) => {
                const pct = Math.round((count / maxDept) * 100);
                return (
                  <div key={dept}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#9ca3af] truncate max-w-[70%]">{dept}</span>
                      <span className="text-xs font-medium text-white">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#363848] overflow-hidden">
                      <div className="h-full rounded-full bg-[#f7a247] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contract overview */}
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Contractoverzicht</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Vast (onbepaald)', value: permanentContracts.length, color: 'text-[#4ade80]' },
              { label: 'Tijdelijk', value: activeContracts.length - permanentContracts.length, color: 'text-[#68b0a6]' },
              { label: 'Verloopt ≤ 30d', value: expiringIn30.length, color: expiringIn30.length > 0 ? 'text-red-400' : 'text-[#9ca3af]' },
              { label: 'Verloopt ≤ 60d', value: expiringIn60.length, color: expiringIn60.length > 0 ? 'text-[#f7a247]' : 'text-[#9ca3af]' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-[#1e2028] p-3">
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          {Object.keys(contractTypeCount).length > 0 && (
            <div>
              <div className="text-xs font-medium text-[#9ca3af] mb-2">Per contracttype</div>
              <div className="space-y-1.5">
                {Object.entries(contractTypeCount).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs text-[#9ca3af]">{type}</span>
                    <span className="text-xs font-medium text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Leave stats */}
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Verlof (afgelopen 90 dagen)</h2>
          <p className="text-xs text-[#9ca3af] mb-4">{totalLeaveDays} goedgekeurde verlofdagen · gemiddeld {avgUsedPct}% balans gebruikt</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Goedgekeurd', value: leaveByStatus.APPROVED, color: 'text-[#4ade80]' },
              { label: 'Openstaand', value: leaveByStatus.PENDING, color: 'text-[#f7a247]' },
              { label: 'Afgewezen', value: leaveByStatus.REJECTED, color: 'text-red-400' },
              { label: 'Geannuleerd', value: leaveByStatus.CANCELLED, color: 'text-[#9ca3af]' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-[#1e2028] p-3">
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="text-xs font-medium text-[#9ca3af] mb-2">Per type</div>
          <div className="space-y-1.5">
            {Object.entries(leaveByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-xs text-[#9ca3af]">{LEAVE_TYPE_LABELS[type] ?? type}</span>
                <span className="text-xs font-medium text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Candidate pipeline */}
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Werving pipeline</h2>
          {candidates.length === 0 ? (
            <p className="text-sm text-[#9ca3af] py-4 text-center">Geen kandidaten.</p>
          ) : (
            <div className="space-y-2">
              {pipelineOrder.filter((s) => (candidateByStatus[s] ?? 0) > 0).map((status) => {
                const count = candidateByStatus[status] ?? 0;
                const total = Math.max(candidates.length, 1);
                const pct = Math.round((count / total) * 100);
                const isEnd = status === 'HIRED' || status === 'REJECTED';
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#9ca3af]">{CANDIDATE_LABELS[status] ?? status}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{count}</span>
                        {!isEnd && <span className="text-[10px] text-[#9ca3af]">{pct}%</span>}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#363848] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          status === 'HIRED' ? 'bg-[#4ade80]' :
                          status === 'REJECTED' ? 'bg-red-500/60' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sick leave milestones + Appointments */}
        <div className="space-y-4">
          {/* Sick leave milestones */}
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Actieve verzuimtrajecten</h2>
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-[#1e2028] p-3 flex-1">
                <div className="text-xl font-bold text-[#f7a247]">{sickTrackers.length}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">Lopend verzuim</div>
              </div>
            </div>
            {sickTrackers.length > 0 && (
              <div className="space-y-2">
                {sick6Due > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-[#f7a247]/10 border border-[#f7a247]/20 px-3 py-2">
                    <svg className="h-3.5 w-3.5 text-[#f7a247] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-xs text-[#f7a247]">{sick6Due}× week-6 probleemanalyse vereist</span>
                  </div>
                )}
                {sick8Due > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-[#f7a247]/10 border border-[#f7a247]/20 px-3 py-2">
                    <svg className="h-3.5 w-3.5 text-[#f7a247] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-xs text-[#f7a247]">{sick8Due}× week-8 plan van aanpak vereist</span>
                  </div>
                )}
                {sick42Due > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                    <svg className="h-3.5 w-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-xs text-red-400">{sick42Due}× week-42 UWV-melding vereist</span>
                  </div>
                )}
                {sick6Due === 0 && sick8Due === 0 && sick42Due === 0 && (
                  <div className="flex items-center gap-2 text-[#4ade80] text-xs">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Alle milestones zijn bijgewerkt
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Appointments this month */}
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <h2 className="text-sm font-semibold text-white mb-3">
              Afspraken — {new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-[#1e2028] p-3">
                <div className="text-xl font-bold text-white">{appointments.length}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">Totaal</div>
              </div>
              <div className="rounded-lg bg-[#1e2028] p-3">
                <div className="text-xl font-bold text-[#4ade80]">{apptCompleted}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">Afgerond</div>
              </div>
              <div className="rounded-lg bg-[#1e2028] p-3">
                <div className="text-xl font-bold text-[#68b0a6]">{apptPlanned}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">Gepland</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
