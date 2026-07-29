'use client';

import { useState, useEffect, useCallback } from 'react';
import { PipelineMetrics } from './pipeline-metrics';
import { UserActivity } from './user-activity';

interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface Props {
  users: { id: string; name: string; email: string; role: string }[];
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Aangemaakt',
  UPDATE: 'Bijgewerkt',
  DELETE: 'Verwijderd',
  RESTORE: 'Hersteld',
  STATUS_CHANGE: 'Status gewijzigd',
  LOGIN: 'Ingelogd',
  CALL: 'Gebeld',
  NOTE: 'Notitie',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-500/10 text-green-400',
  UPDATE: 'bg-blue-500/10 text-blue-400',
  DELETE: 'bg-red-500/10 text-red-400',
  RESTORE: 'bg-cyan-500/10 text-cyan-400',
  STATUS_CHANGE: 'bg-purple-500/10 text-purple-400',
  LOGIN: 'bg-[#363848] text-[#9ca3af]',
  CALL: 'bg-yellow-500/10 text-yellow-400',
  NOTE: 'bg-[#68b0a6]/10 text-[#68b0a6]',
};

const ENTITY_LABELS: Record<string, string> = {
  Candidate: 'Kandidaat',
  User: 'Gebruiker',
  LeaveRequest: 'Verlofaanvraag',
  Contract: 'Contract',
  Settings: 'Instellingen',
  EmailAutomation: 'E-mail automatie',
};

const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'STATUS_CHANGE', 'LOGIN', 'CALL', 'NOTE'];

export function ActiviteitenClient({ users }: Props) {
  const [tab, setTab] = useState<'logboek' | 'metrics' | 'users'>('logboek');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(LIMIT));
      params.set('offset', String(page * LIMIT));
      if (filterUser) params.set('userId', filterUser);
      if (filterAction) params.set('action', filterAction);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      const json = await res.json();
      setEntries(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, filterAction, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  function formatDetails(details: string | null, action: string): string {
    if (!details) return '';
    try {
      const d = JSON.parse(details);
      if (action === 'STATUS_CHANGE' && d.from && d.to) {
        return `${d.from} → ${d.to}`;
      }
      if (action === 'CALL' && d.callStatus) {
        const labels: Record<string, string> = { BEREIKT: 'Bereikt', GEEN_GEHOOR: 'Geen gehoor', VOICEMAIL: 'Voicemail', TERUGBELLEN: 'Terugbellen' };
        return labels[d.callStatus] ?? d.callStatus;
      }
      if (action === 'CREATE' && d.name) {
        return d.name;
      }
      // Generic: show keys
      const keys = Object.keys(d).filter(k => !['updatedAt', 'stageUpdatedAt', 'ipAddress'].includes(k));
      if (keys.length <= 3) return keys.join(', ');
      return `${keys.length} velden gewijzigd`;
    } catch {
      return '';
    }
  }

  function entityLink(entity: string, entityId: string | null): string | null {
    if (!entityId) return null;
    if (entity === 'Candidate') return `/dashboard/werving/${entityId}`;
    return null;
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Activiteiten</h1>
        <p className="mt-0.5 text-sm text-[#9ca3af]">Logboek en verwerkingstijden — alleen voor admins.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[#1e2028] p-1 w-fit">
        <button
          onClick={() => setTab('logboek')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'logboek' ? 'bg-[#252732] text-white' : 'text-[#9ca3af] hover:text-white'}`}
        >
          Logboek
        </button>
        <button
          onClick={() => setTab('metrics')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'metrics' ? 'bg-[#252732] text-white' : 'text-[#9ca3af] hover:text-white'}`}
        >
          Verwerkingstijden
        </button>
        <button
          onClick={() => setTab('users')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'users' ? 'bg-[#252732] text-white' : 'text-[#9ca3af] hover:text-white'}`}
        >
          Gebruikersactiviteit
        </button>
      </div>

      {tab === 'users' ? (
        <UserActivity />
      ) : tab === 'logboek' ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-[#9ca3af] mb-1">Gebruiker</label>
              <select
                value={filterUser}
                onChange={(e) => { setFilterUser(e.target.value); setPage(0); }}
                className="rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-white"
              >
                <option value="">Alle</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9ca3af] mb-1">Actie</label>
              <select
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
                className="rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-white"
              >
                <option value="">Alle</option>
                {ACTIONS.filter(Boolean).map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9ca3af] mb-1">Van</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => { setFilterFrom(e.target.value); setPage(0); }}
                className="rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9ca3af] mb-1">Tot</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => { setFilterTo(e.target.value); setPage(0); }}
                className="rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-white"
              />
            </div>
            <button
              onClick={() => { setFilterUser(''); setFilterAction(''); setFilterFrom(''); setFilterTo(''); setPage(0); }}
              className="rounded-lg border border-[#363848] px-3 py-1.5 text-sm text-[#9ca3af] hover:text-white transition-colors"
            >
              Reset
            </button>
            <button
              onClick={load}
              className="rounded-lg bg-[#68b0a6] px-3 py-1.5 text-sm font-medium text-[#14151b] hover:bg-[#5a9e94] transition-colors"
            >
              Vernieuwen
            </button>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-[#363848] bg-[#252732] overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#9ca3af]">Laden...</div>
            ) : entries.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#9ca3af]">Geen activiteiten gevonden.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#363848] text-left text-xs font-medium text-[#9ca3af] uppercase tracking-wider">
                      <th className="px-4 py-3">Tijdstip</th>
                      <th className="px-4 py-3">Gebruiker</th>
                      <th className="px-4 py-3">Actie</th>
                      <th className="px-4 py-3">Entity</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#363848]/50">
                    {entries.map((e) => {
                      const link = entityLink(e.entity, e.entityId);
                      return (
                        <tr key={e.id} className="hover:bg-[#1e2028]/50 transition-colors">
                          <td className="px-4 py-2.5 text-[#9ca3af] whitespace-nowrap font-mono text-xs">
                            {new Date(e.createdAt).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-2.5 text-white whitespace-nowrap">
                            {e.user?.name ?? <span className="text-[#6b7280]">Systeem</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[e.action] ?? 'bg-[#363848] text-[#9ca3af]'}`}>
                              {ACTION_LABELS[e.action] ?? e.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[#e8e9ed] whitespace-nowrap">
                            {link ? (
                              <a href={link} className="text-[#68b0a6] hover:underline">
                                {ENTITY_LABELS[e.entity] ?? e.entity}
                              </a>
                            ) : (
                              ENTITY_LABELS[e.entity] ?? e.entity
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[#9ca3af] max-w-[300px] truncate">
                            {formatDetails(e.details, e.action)}
                          </td>
                          <td className="px-4 py-2.5 text-[#6b7280] font-mono text-xs whitespace-nowrap">
                            {e.ipAddress && e.ipAddress !== 'unknown' ? e.ipAddress.slice(0, 15) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#363848] px-4 py-3">
                <span className="text-xs text-[#9ca3af]">
                  {total} resultaten — pagina {page + 1} van {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="rounded-lg border border-[#363848] px-3 py-1 text-xs text-[#9ca3af] hover:text-white disabled:opacity-30 transition-colors"
                  >
                    Vorige
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="rounded-lg border border-[#363848] px-3 py-1 text-xs text-[#9ca3af] hover:text-white disabled:opacity-30 transition-colors"
                  >
                    Volgende
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <PipelineMetrics />
      )}
    </div>
  );
}
