'use client';

import { useState, useEffect, useCallback } from 'react';

interface PhaseMetric {
  phase: string;
  label: string;
  median: number;
  average: number;
  p90: number;
  count: number;
}

function formatHours(h: number): string {
  if (h === 0) return '—';
  if (h < 24) return `${Math.round(h)} uur`;
  const days = Math.round(h / 24 * 10) / 10;
  return `${days} dag${days !== 1 ? 'en' : ''}`;
}

const PHASE_COLORS: Record<string, string> = {
  entry_to_contact: 'bg-blue-500',
  contact_to_prescreening: 'bg-yellow-500',
  prescreening_to_done: 'bg-purple-500',
  done_to_interview: 'bg-[#68b0a6]',
  interview_to_outcome: 'bg-green-500',
  total: 'bg-[#f7a247]',
};

export function PipelineMetrics() {
  const [phases, setPhases] = useState<PhaseMetric[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pipeline-metrics?days=${days}`);
      const json = await res.json();
      setPhases(json.phases ?? []);
      setTotalCandidates(json.totalCandidates ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const totalPhase = phases.find(p => p.phase === 'total');
  const stepPhases = phases.filter(p => p.phase !== 'total');
  const maxAvg = Math.max(...stepPhases.map(p => p.average), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-1 rounded-lg bg-[#1e2028] p-1 w-fit">
        {[30, 60, 90].map((d) => (
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
        <div className="flex items-center justify-center py-12 text-sm text-[#9ca3af]">Laden...</div>
      ) : totalCandidates === 0 ? (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-8 text-center text-sm text-[#9ca3af]">
          Geen kandidaten in de afgelopen {days} dagen.
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
              <p className="text-xs text-[#9ca3af] uppercase tracking-wider">Kandidaten</p>
              <p className="mt-1 text-2xl font-bold text-white">{totalCandidates}</p>
              <p className="text-xs text-[#6b7280]">Afgelopen {days} dagen</p>
            </div>
            <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
              <p className="text-xs text-[#9ca3af] uppercase tracking-wider">Gem. doorlooptijd</p>
              <p className="mt-1 text-2xl font-bold text-white">{totalPhase ? formatHours(totalPhase.average) : '—'}</p>
              <p className="text-xs text-[#6b7280]">Entry → uitkomst</p>
            </div>
            <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
              <p className="text-xs text-[#9ca3af] uppercase tracking-wider">Mediaan doorlooptijd</p>
              <p className="mt-1 text-2xl font-bold text-white">{totalPhase ? formatHours(totalPhase.median) : '—'}</p>
              <p className="text-xs text-[#6b7280]">{totalPhase?.count ?? 0} met uitkomst</p>
            </div>
          </div>

          {/* Funnel bars */}
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Doorlooptijd per fase</h2>
            <div className="space-y-3">
              {stepPhases.map((p) => (
                <div key={p.phase}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#e8e9ed]">{p.label}</span>
                    <span className="text-xs font-medium text-white">{formatHours(p.average)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-[#1e2028] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${PHASE_COLORS[p.phase] ?? 'bg-[#68b0a6]'}`}
                      style={{ width: `${Math.max(2, (p.average / maxAvg) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed table */}
          <div className="rounded-xl border border-[#363848] bg-[#252732] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#363848] text-left text-xs font-medium text-[#9ca3af] uppercase tracking-wider">
                  <th className="px-4 py-3">Fase</th>
                  <th className="px-4 py-3 text-right">Mediaan</th>
                  <th className="px-4 py-3 text-right">Gemiddeld</th>
                  <th className="px-4 py-3 text-right">P90</th>
                  <th className="px-4 py-3 text-right">Kandidaten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#363848]/50">
                {phases.map((p) => (
                  <tr key={p.phase} className={`${p.phase === 'total' ? 'bg-[#1e2028] font-medium' : ''}`}>
                    <td className="px-4 py-2.5 text-[#e8e9ed]">{p.label}</td>
                    <td className="px-4 py-2.5 text-right text-[#9ca3af] font-mono text-xs">{formatHours(p.median)}</td>
                    <td className="px-4 py-2.5 text-right text-white font-mono text-xs">{formatHours(p.average)}</td>
                    <td className="px-4 py-2.5 text-right text-[#f7a247] font-mono text-xs">{formatHours(p.p90)}</td>
                    <td className="px-4 py-2.5 text-right text-[#9ca3af]">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
