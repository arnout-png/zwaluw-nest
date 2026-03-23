import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDashboardStats, getContractsExpiringSoon, getPendingLeaveRequests, getRecruitmentSummary } from '@/lib/data';
import { StatCard } from '@/components/dashboard/stat-card';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function LeaveTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    VACATION: 'Vakantie',
    SICK: 'Ziek',
    PERSONAL: 'Persoonlijk',
    UNPAID: 'Onbetaald',
    SPECIAL: 'Bijzonder',
  };
  const colors: Record<string, string> = {
    VACATION: 'bg-blue-500/10 text-blue-400',
    SICK: 'bg-red-500/10 text-red-400',
    PERSONAL: 'bg-purple-500/10 text-purple-400',
    UNPAID: 'bg-[#9ca3af]/10 text-[#9ca3af]',
    SPECIAL: 'bg-[#f7a247]/10 text-[#f7a247]',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] ?? 'bg-[#9ca3af]/10 text-[#9ca3af]'}`}>
      {labels[type] ?? type}
    </span>
  );
}

function daysUntil(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const greeting = getGreeting();
  const isAdmin = session.role === 'ADMIN';
  const isPlanner = session.role === 'PLANNER';

  const [stats, expiringContracts, pendingLeave, recruitment] = await Promise.all([
    getDashboardStats(),
    getContractsExpiringSoon(),
    getPendingLeaveRequests(),
    (isAdmin || isPlanner) ? getRecruitmentSummary() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6 fade-in">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-white">
          {greeting}, {session.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          {new Date().toLocaleDateString('nl-NL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Stats (admin/planner only) */}
      {(isAdmin || isPlanner) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Actieve medewerkers"
            value={stats.activeEmployees}
            subtitle="In dienst"
            variant="default"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            title="Contracten verlopen binnenkort"
            value={stats.expiringContracts}
            subtitle="Binnen 60 dagen"
            variant={stats.expiringContracts > 0 ? 'warning' : 'default'}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <StatCard
            title="Openstaande verlofaanvragen"
            value={stats.pendingLeave}
            subtitle="Wachten op goedkeuring"
            variant={stats.pendingLeave > 0 ? 'warning' : 'default'}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            title="Open kandidaten"
            value={stats.openCandidates}
            subtitle="In werving pipeline"
            variant="default"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Recruitment pipeline widget (admin/planner) */}
      {recruitment && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <h2 className="text-sm font-semibold text-white">Werving pipeline</h2>
            </div>
            <div className="flex items-center gap-3">
              {recruitment.staleCount > 0 && (
                <span className="rounded-full bg-[#f7a247]/10 px-2 py-0.5 text-xs font-medium text-[#f7a247]">
                  {recruitment.staleCount} te lang in fase
                </span>
              )}
              <Link
                href="/dashboard/werving"
                className="text-xs text-[#68b0a6] hover:underline"
              >
                Bekijk Kanban →
              </Link>
            </div>
          </div>

          {/* Pipeline flow */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'NEW_LEAD', label: 'Nieuw' },
              { key: 'PRE_SCREENING', label: 'Pre-screening' },
              { key: 'SCREENING_DONE', label: 'Screening klaar' },
              { key: 'INTERVIEW', label: 'Interview' },
              { key: 'RESERVE_BANK', label: 'Reserve Bank' },
            ] as { key: string; label: string }[]).map((stage, i, arr) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div className="flex flex-col items-center rounded-lg bg-[#1e2028] px-3 py-2 min-w-[80px]">
                  <span className="text-lg font-bold text-white">{recruitment.pipelineCounts[stage.key] ?? 0}</span>
                  <span className="text-xs text-[#9ca3af] mt-0.5 text-center leading-tight">{stage.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-[#363848] text-sm">→</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-4 text-xs text-[#9ca3af]">
            <span><span className="text-white font-medium">{recruitment.totalActive}</span> actief totaal</span>
            {recruitment.interviewsThisWeek > 0 && (
              <span><span className="text-[#68b0a6] font-medium">{recruitment.interviewsThisWeek}</span> interviews deze week</span>
            )}
          </div>
        </div>
      )}

      {/* Lower grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Expiring contracts */}
        {isAdmin && expiringContracts.length > 0 && (
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-4 w-4 text-[#f7a247]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h2 className="text-sm font-semibold text-white">Contracten verlopen binnenkort</h2>
            </div>
            <div className="space-y-2">
              {expiringContracts.slice(0, 6).map((contract) => {
                const days = daysUntil(contract.endDate!);
                const userId = contract.employeeProfile?.userId;
                const employeeName = contract.employeeProfile?.user?.name ?? `Contract #${contract.id.slice(-6)}`;
                const inner = (
                  <>
                    <div className="text-sm text-[#e8e9ed]">{employeeName}</div>
                    <div className={`text-xs font-medium ${days <= 30 ? 'text-red-400' : 'text-[#f7a247]'}`}>
                      {days <= 0 ? 'Verlopen' : `${days} dagen`}
                    </div>
                  </>
                );
                return userId ? (
                  <Link
                    key={contract.id}
                    href={`/dashboard/personeel/${userId}`}
                    className="flex items-center justify-between rounded-lg bg-[#1e2028] px-3 py-2 hover:bg-[#2a2d3a] transition-colors"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={contract.id} className="flex items-center justify-between rounded-lg bg-[#1e2028] px-3 py-2">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending leave requests */}
        {(isAdmin || isPlanner) && (
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Openstaande verlofaanvragen</h2>
              {pendingLeave.length > 0 && (
                <span className="rounded-full bg-[#f7a247]/10 px-2 py-0.5 text-xs font-medium text-[#f7a247]">
                  {pendingLeave.length}
                </span>
              )}
            </div>
            {pendingLeave.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="h-10 w-10 text-[#363848] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-[#9ca3af]">Geen openstaande aanvragen</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingLeave.slice(0, 5).map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg bg-[#1e2028] px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-[#e8e9ed]">
                        {req.employeeProfile?.user?.name ?? 'Onbekend'}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <LeaveTypeBadge type={req.type} />
                        <span className="text-xs text-[#9ca3af]">
                          {new Date(req.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          {req.endDate ? ` – ${new Date(req.endDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-[#9ca3af]">{req.totalDays ?? 0} dag{(req.totalDays ?? 0) !== 1 ? 'en' : ''}</span>
                  </div>
                ))}
                {pendingLeave.length > 5 && (
                  <p className="text-xs text-center text-[#9ca3af] pt-1">
                    +{pendingLeave.length - 5} meer — zie Verzuim module
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Welcome card for limited roles */}
        {!isAdmin && !isPlanner && (
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white mb-2">Welkom bij ZwaluwNest</h2>
            <p className="text-sm text-[#9ca3af]">
              Gebruik het navigatiemenu om je werk- en verlofoverzicht te bekijken.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
