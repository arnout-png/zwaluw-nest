import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDashboardStats, getRecentCandidates, getTodayCallbacks, getRecruitmentSummary } from '@/lib/data';
import { StatCard } from '@/components/dashboard/stat-card';
import type { CandidateStatus } from '@/types';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

const STATUS_LABELS: Record<CandidateStatus, string> = {
  NEW_LEAD: 'Nieuw',
  PRE_SCREENING: 'Pre-screening',
  SCREENING_DONE: 'Screening klaar',
  INTERVIEW: 'Interview',
  RESERVE_BANK: 'Reserve Bank',
  HIRED: 'Aangenomen',
  REJECTED: 'Afgewezen',
};

const STATUS_COLORS: Record<CandidateStatus, string> = {
  NEW_LEAD: 'bg-blue-500/10 text-blue-400',
  PRE_SCREENING: 'bg-yellow-500/10 text-yellow-400',
  SCREENING_DONE: 'bg-yellow-500/10 text-yellow-300',
  INTERVIEW: 'bg-purple-500/10 text-purple-400',
  RESERVE_BANK: 'bg-[#68b0a6]/10 text-[#68b0a6]',
  HIRED: 'bg-green-500/10 text-green-400',
  REJECTED: 'bg-red-500/10 text-red-400',
};

const LEAD_SOURCE_LABEL: Record<string, string> = {
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  REFERRAL: 'Referral',
  MANUAL: 'Handmatig',
  GOOGLE: 'Google',
  OTHER: 'Overig',
};

function daysAgo(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const greeting = getGreeting();
  const isAdmin = session.role === 'ADMIN';
  const isPlanner = session.role === 'PLANNER';
  const isRecruitmentUser = isAdmin || isPlanner;

  const [stats, recentCandidates, todayCallbacks, recruitment] = await Promise.all([
    isRecruitmentUser ? getDashboardStats() : Promise.resolve(null),
    isRecruitmentUser ? getRecentCandidates(5) : Promise.resolve([]),
    isRecruitmentUser ? getTodayCallbacks() : Promise.resolve([]),
    isRecruitmentUser ? getRecruitmentSummary() : Promise.resolve(null),
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

      {/* Recruitment stats */}
      {isRecruitmentUser && stats && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            title="Open kandidaten"
            value={stats.openCandidates}
            subtitle="In pipeline"
            variant="default"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            }
          />
          <StatCard
            title="Nieuw deze week"
            value={stats.newLeadsThisWeek}
            subtitle="Afgelopen 7 dagen"
            variant="default"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          />
          <StatCard
            title="Gesprekken deze week"
            value={stats.interviewsThisWeek}
            subtitle="Status INTERVIEW"
            variant="default"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
          />
          <StatCard
            title="Terugbellen vandaag"
            value={stats.todayCallbackCount}
            subtitle="Gepland voor vandaag"
            variant={stats.todayCallbackCount > 0 ? 'warning' : 'default'}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Pipeline flow widget */}
      {recruitment && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-sm font-semibold text-white">Werving pipeline</h2>
            </div>
            <div className="flex items-center gap-3">
              {recruitment.staleCount > 0 && (
                <span className="rounded-full bg-[#f7a247]/10 px-2 py-0.5 text-xs font-medium text-[#f7a247]">
                  {recruitment.staleCount} te lang in fase
                </span>
              )}
              <Link href="/dashboard/werving" className="text-xs text-[#68b0a6] hover:underline">
                Bekijk Kanban →
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'NEW_LEAD', label: 'Nieuw' },
              { key: 'PRE_SCREENING', label: 'Pre-screening' },
              { key: 'SCREENING_DONE', label: 'Screening klaar' },
              { key: 'INTERVIEW', label: 'Interview' },
              { key: 'RESERVE_BANK', label: 'Reserve Bank' },
            ] as { key: string; label: string }[]).map((stage, i, arr) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div className="flex flex-col items-center rounded-lg bg-[#1e2028] px-3 py-2 min-w-[72px]">
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

      {/* Lower grid: recent candidates + today callbacks */}
      {isRecruitmentUser && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recente kandidaten */}
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Recente kandidaten</h2>
              <Link href="/dashboard/werving" className="text-xs text-[#68b0a6] hover:underline">
                Alle kandidaten →
              </Link>
            </div>
            {recentCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="h-10 w-10 text-[#363848] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-[#9ca3af]">Geen kandidaten</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCandidates.map((c) => {
                  const stageDays = daysAgo(c.stageUpdatedAt ?? c.createdAt);
                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/werving/${c.id}`}
                      className="flex items-center justify-between rounded-lg bg-[#1e2028] px-3 py-2.5 hover:bg-[#2a2d3a] transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#e8e9ed] truncate group-hover:text-[#68b0a6] transition-colors">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[c.status]}`}>
                            {STATUS_LABELS[c.status]}
                          </span>
                          {c.leadSource && (
                            <span className="text-[10px] text-[#9ca3af]">
                              {LEAD_SOURCE_LABEL[c.leadSource] ?? c.leadSource}
                            </span>
                          )}
                        </div>
                      </div>
                      {stageDays !== null && (
                        <span className={`text-xs shrink-0 ml-2 ${stageDays >= 5 ? 'text-[#f7a247]' : 'text-[#9ca3af]'}`}>
                          {stageDays}d
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vandaag bellen */}
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Vandaag bellen</h2>
              {todayCallbacks.length > 0 && (
                <span className="rounded-full bg-[#f7a247]/10 px-2 py-0.5 text-xs font-medium text-[#f7a247]">
                  {todayCallbacks.length}
                </span>
              )}
            </div>
            {todayCallbacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="h-10 w-10 text-[#363848] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-[#9ca3af]">Geen terugbelafspraken vandaag</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayCallbacks.map((cb, i) => (
                  <Link
                    key={`${cb.candidateId}-${i}`}
                    href={`/dashboard/werving/${cb.candidateId}`}
                    className="flex items-center justify-between rounded-lg bg-[#1e2028] px-3 py-2.5 hover:bg-[#2a2d3a] transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#e8e9ed] truncate group-hover:text-[#68b0a6] transition-colors">
                        {cb.candidateName}
                      </div>
                      {cb.phone && (
                        <div className="text-xs text-[#9ca3af] mt-0.5">{cb.phone}</div>
                      )}
                    </div>
                    <span className="text-xs text-[#f7a247] shrink-0 ml-2">
                      {new Date(cb.callbackAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Welcome card for limited roles */}
      {!isRecruitmentUser && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-2">Welkom bij ZwaluwNest</h2>
          <p className="text-sm text-[#9ca3af]">
            Gebruik het navigatiemenu om je werk- en verlofoverzicht te bekijken.
          </p>
        </div>
      )}
    </div>
  );
}
