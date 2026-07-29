'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserActivity {
  userId: string;
  name: string;
  email: string;
  role: string;
  loginCount: number;
  totalActions: number;
  actionBreakdown: Record<string, number>;
  activeDays: number;
  totalActiveMinutes: number;
  avgSessionMinutes: number;
  lastSeen: string | null;
  dailyActivity: { date: string; actions: number; minutes: number }[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Manager', PLANNER: 'Planner',
  ADVISEUR: 'Adviseur', MONTEUR: 'Monteur', CALLCENTER: 'Callcenter',
  BACKOFFICE: 'Backoffice', WAREHOUSE: 'Magazijn',
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inloggen', CREATE: 'Aanmaken', UPDATE: 'Bijwerken',
  DELETE: 'Verwijderen', STATUS_CHANGE: 'Status wijzigen',
  CALL: 'Bellen', NOTE: 'Notitie', RESTORE: 'Herstellen',
  PHONE_CORRECT_SENT: 'Nr. correctie', PHONE_CORRECT: 'Nr. gecorrigeerd',
};

function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest > 0 ? `${h}u ${rest}m` : `${h}u`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}

export function UserActivity() {
  const [data, setData] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/user-activity?days=${days}`);
      const json = await res.json();
      setData(json.data ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  // Totals
  const totalLogins = data.reduce((s, u) => s + u.loginCount, 0);
  const totalActions = data.reduce((s, u) => s + u.totalActions, 0);
  const totalMinutes = data.reduce((s, u) => s + u.totalActiveMinutes, 0);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-1 rounded-lg bg-[#1e2028] p-1 w-fit">
        {[7, 14, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${days === d ? 'bg-[#252732] text-white' : 'text-[#9ca3af] hover:text-white'}`}
          >
            {d} dagen
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-[#9ca3af] text-center py-12">Laden...</div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-8 text-center text-sm text-[#9ca3af]">
          Geen activiteit in de afgelopen {days} dagen.
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
              <p className="text-xs text-[#9ca3af] uppercase tracking-wider">Actieve gebruikers</p>
              <p className="mt-1 text-2xl font-bold text-white">{data.length}</p>
            </div>
            <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
              <p className="text-xs text-[#9ca3af] uppercase tracking-wider">Totaal logins</p>
              <p className="mt-1 text-2xl font-bold text-white">{totalLogins}</p>
            </div>
            <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
              <p className="text-xs text-[#9ca3af] uppercase tracking-wider">Totaal acties</p>
              <p className="mt-1 text-2xl font-bold text-white">{totalActions}</p>
            </div>
            <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
              <p className="text-xs text-[#9ca3af] uppercase tracking-wider">Totaal actieve tijd</p>
              <p className="mt-1 text-2xl font-bold text-white">{formatMinutes(totalMinutes)}</p>
            </div>
          </div>

          {/* User cards */}
          <div className="space-y-3">
            {data.map(user => {
              const isExpanded = expanded === user.userId;
              const maxActions = Math.max(...data.map(u => u.totalActions), 1);
              const barPct = Math.round((user.totalActions / maxActions) * 100);

              return (
                <div key={user.userId} className="rounded-xl border border-[#363848] bg-[#252732] overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : user.userId)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[#1e2028]/50 transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#68b0a6]/20 text-sm font-bold text-[#68b0a6]">
                      {user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    {/* Name + role */}
                    <div className="min-w-0 w-40">
                      <p className="text-sm font-medium text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-[#6b7280]">{ROLE_LABELS[user.role] ?? user.role}</p>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 flex-1">
                      <div className="text-center w-16">
                        <p className="text-sm font-semibold text-white">{user.loginCount}</p>
                        <p className="text-[10px] text-[#6b7280]">Logins</p>
                      </div>
                      <div className="text-center w-16">
                        <p className="text-sm font-semibold text-white">{user.totalActions}</p>
                        <p className="text-[10px] text-[#6b7280]">Acties</p>
                      </div>
                      <div className="text-center w-16">
                        <p className="text-sm font-semibold text-white">{user.activeDays}</p>
                        <p className="text-[10px] text-[#6b7280]">Dagen</p>
                      </div>
                      <div className="text-center w-20">
                        <p className="text-sm font-semibold text-white">{formatMinutes(user.totalActiveMinutes)}</p>
                        <p className="text-[10px] text-[#6b7280]">Actief</p>
                      </div>

                      {/* Activity bar */}
                      <div className="flex-1 hidden lg:block">
                        <div className="h-2 rounded-full bg-[#1e2028] overflow-hidden">
                          <div className="h-full rounded-full bg-[#68b0a6] transition-all" style={{ width: `${Math.max(barPct, 3)}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Last seen */}
                    <div className="text-right shrink-0 w-24">
                      <p className="text-xs text-[#9ca3af]">
                        {user.lastSeen ? timeAgo(user.lastSeen) : '—'}
                      </p>
                    </div>

                    {/* Chevron */}
                    <svg className={`h-4 w-4 text-[#9ca3af] shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-[#363848] px-5 py-4 bg-[#1e2028]/30">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Action breakdown */}
                        <div>
                          <h3 className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide mb-3">Acties per type</h3>
                          <div className="space-y-2">
                            {Object.entries(user.actionBreakdown)
                              .sort((a, b) => b[1] - a[1])
                              .map(([action, count]) => {
                                const pct = Math.round((count / user.totalActions) * 100);
                                return (
                                  <div key={action} className="flex items-center gap-3">
                                    <span className="text-xs text-[#e8e9ed] w-28 truncate">{ACTION_LABELS[action] ?? action}</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-[#252732] overflow-hidden">
                                      <div className="h-full rounded-full bg-[#68b0a6]" style={{ width: `${Math.max(pct, 2)}%` }} />
                                    </div>
                                    <span className="text-xs text-[#9ca3af] w-8 text-right">{count}</span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* Daily activity */}
                        <div>
                          <h3 className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide mb-3">Activiteit per dag</h3>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {user.dailyActivity.map(day => (
                              <div key={day.date} className="flex items-center justify-between rounded-lg bg-[#252732] px-3 py-1.5">
                                <span className="text-xs text-[#e8e9ed] font-mono">
                                  {new Date(day.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </span>
                                <div className="flex items-center gap-4">
                                  <span className="text-xs text-[#9ca3af]">{day.actions} acties</span>
                                  <span className="text-xs text-[#68b0a6] font-medium w-16 text-right">{formatMinutes(day.minutes)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Session info */}
                      <div className="mt-4 flex gap-6 text-xs text-[#6b7280]">
                        <span>Gem. sessie: <span className="text-[#e8e9ed] font-medium">{formatMinutes(user.avgSessionMinutes)}</span></span>
                        <span>E-mail: <span className="text-[#9ca3af]">{user.email}</span></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
