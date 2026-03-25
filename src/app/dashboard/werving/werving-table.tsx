'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Candidate, CandidateStatus } from '@/types';

interface WervingTableProps {
  candidates: Candidate[];
}

const ALL_STATUSES: CandidateStatus[] = [
  'NEW_LEAD', 'PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW', 'RESERVE_BANK', 'HIRED', 'REJECTED',
];

const STATUS_LABELS: Record<CandidateStatus, string> = {
  NEW_LEAD: 'Nieuw',
  PRE_SCREENING: 'Pre-screening',
  SCREENING_DONE: 'Screening klaar',
  INTERVIEW: 'Gesprek',
  RESERVE_BANK: 'Reservebank',
  HIRED: 'Aangenomen',
  REJECTED: 'Afgewezen',
};

const STATUS_COLORS: Record<CandidateStatus, string> = {
  NEW_LEAD: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  PRE_SCREENING: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  SCREENING_DONE: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  INTERVIEW: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  RESERVE_BANK: 'bg-teal-500/15 text-teal-300 border-teal-500/20',
  HIRED: 'bg-green-500/15 text-green-300 border-green-500/20',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-500/20',
};

const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  MANUAL: 'Handmatig',
};

type SortCol = 'name' | 'status' | 'phone' | 'email' | 'location' | 'age' | 'salaryExpectation' | 'vacature' | 'leadSource' | 'assignedTo' | 'createdAt' | 'stageUpdatedAt';

interface ColDef {
  key: SortCol;
  label: string;
  defaultOn: boolean;
}

const COLUMN_DEFS: ColDef[] = [
  { key: 'name', label: 'Naam', defaultOn: true },
  { key: 'status', label: 'Status', defaultOn: true },
  { key: 'phone', label: 'Telefoon', defaultOn: true },
  { key: 'email', label: 'E-mail', defaultOn: false },
  { key: 'location', label: 'Locatie', defaultOn: true },
  { key: 'age', label: 'Leeftijd', defaultOn: false },
  { key: 'salaryExpectation', label: 'Salarisverwachting', defaultOn: true },
  { key: 'vacature', label: 'Vacature', defaultOn: true },
  { key: 'leadSource', label: 'Bron', defaultOn: false },
  { key: 'assignedTo', label: 'Toegewezen aan', defaultOn: true },
  { key: 'createdAt', label: 'Aangemeld', defaultOn: true },
  { key: 'stageUpdatedAt', label: 'Fase gewijzigd', defaultOn: false },
];

const DEFAULT_COLS = new Set<SortCol>(
  COLUMN_DEFS.filter((c) => c.defaultOn).map((c) => c.key)
);

const LS_KEY = 'werving-table-cols';
const PAGE_SIZE = 25;

function relativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Vandaag';
  if (days === 1) return 'Gisteren';
  if (days < 7) return `${days} dagen geleden`;
  if (days < 30) return `${Math.floor(days / 7)} wk geleden`;
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' });
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return (
    <svg className="h-3 w-3 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
  return dir === 'asc' ? (
    <svg className="h-3 w-3 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="h-3 w-3 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function WervingTable({ candidates }: WervingTableProps) {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CandidateStatus[]>([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [vacatureFilter, setVacatureFilter] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [visibleCols, setVisibleCols] = useState<Set<SortCol>>(DEFAULT_COLS);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Load column config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed: SortCol[] = JSON.parse(saved);
        setVisibleCols(new Set(parsed));
      }
    } catch { /* ignore */ }
  }, []);

  // Close column menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    }
    if (colMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colMenuOpen]);

  function toggleCol(key: SortCol) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev; // Always keep at least 1
        next.delete(key);
      } else {
        next.add(key);
      }
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function toggleStatus(s: CandidateStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    setPage(0);
  }

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(0);
  }

  // Derive filter options from actual data
  const sources = useMemo(() => {
    const s = new Set<string>();
    for (const c of candidates) if (c.leadSource) s.add(c.leadSource);
    return [...s].sort();
  }, [candidates]);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of candidates) {
      if (c.assignedTo) map.set(c.assignedTo.id, c.assignedTo.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [candidates]);

  const vacatures = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of candidates) {
      if (c.jobOpening) map.set(c.jobOpening.id, c.jobOpening.title);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [candidates]);

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return candidates.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q) && !(c.phone ?? '').includes(q)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(c.status)) return false;
      if (sourceFilter && c.leadSource !== sourceFilter) return false;
      if (assignedFilter && c.assignedTo?.id !== assignedFilter) return false;
      if (vacatureFilter && c.jobOpening?.id !== vacatureFilter) return false;
      return true;
    });
  }, [candidates, search, statusFilter, sourceFilter, assignedFilter, vacatureFilter]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: string | number | null = null;
      let valB: string | number | null = null;
      switch (sortCol) {
        case 'name': valA = a.name; valB = b.name; break;
        case 'status': valA = STATUS_LABELS[a.status]; valB = STATUS_LABELS[b.status]; break;
        case 'phone': valA = a.phone ?? ''; valB = b.phone ?? ''; break;
        case 'email': valA = a.email; valB = b.email; break;
        case 'location': valA = a.location ?? ''; valB = b.location ?? ''; break;
        case 'age': valA = a.age ?? -1; valB = b.age ?? -1; break;
        case 'salaryExpectation': valA = Number(a.salaryExpectation) || 0; valB = Number(b.salaryExpectation) || 0; break;
        case 'vacature': valA = a.jobOpening?.title ?? ''; valB = b.jobOpening?.title ?? ''; break;
        case 'leadSource': valA = a.leadSource ?? ''; valB = b.leadSource ?? ''; break;
        case 'assignedTo': valA = a.assignedTo?.name ?? ''; valB = b.assignedTo?.name ?? ''; break;
        case 'createdAt': valA = a.createdAt; valB = b.createdAt; break;
        case 'stageUpdatedAt': valA = a.stageUpdatedAt ?? a.createdAt; valB = b.stageUpdatedAt ?? b.createdAt; break;
      }
      const cmp = typeof valA === 'number'
        ? valA - (valB as number)
        : String(valA).localeCompare(String(valB), 'nl');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  // Paginate
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const hasFilters = search || statusFilter.length > 0 || sourceFilter || assignedFilter || vacatureFilter;

  function clearFilters() {
    setSearch('');
    setStatusFilter([]);
    setSourceFilter('');
    setAssignedFilter('');
    setVacatureFilter('');
    setPage(0);
  }

  return (
    <div className="space-y-3">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Zoeken op naam, e-mail, telefoon…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 pr-3 py-1.5 rounded-lg border border-[#363848] bg-[#1e2028] text-sm text-white placeholder-[#6b7280] focus:border-[#68b0a6] focus:outline-none w-64"
          />
        </div>

        {/* Source filter */}
        {sources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#363848] bg-[#1e2028] px-2.5 py-1.5 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
          >
            <option value="">Alle bronnen</option>
            {sources.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>
            ))}
          </select>
        )}

        {/* Assignee filter */}
        {assignees.length > 0 && (
          <select
            value={assignedFilter}
            onChange={(e) => { setAssignedFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#363848] bg-[#1e2028] px-2.5 py-1.5 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
          >
            <option value="">Alle recruiters</option>
            {assignees.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}

        {/* Vacature filter */}
        {vacatures.length > 0 && (
          <select
            value={vacatureFilter}
            onChange={(e) => { setVacatureFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#363848] bg-[#1e2028] px-2.5 py-1.5 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
          >
            <option value="">Alle vacatures</option>
            {vacatures.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
        )}

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[#9ca3af] hover:text-white transition-colors"
          >
            Filters wissen
          </button>
        )}

        {/* Column configurator */}
        <div className="relative ml-auto" ref={colMenuRef}>
          <button
            onClick={() => setColMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-[#9ca3af] hover:text-white hover:border-[#68b0a6] transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Kolommen
          </button>
          {colMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-[#363848] bg-[#252732] shadow-xl py-1">
              {COLUMN_DEFS.map((col) => (
                <button
                  key={col.key}
                  onClick={() => toggleCol(col.key)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-[#363848] transition-colors"
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${visibleCols.has(col.key) ? 'bg-[#68b0a6] border-[#68b0a6]' : 'border-[#4b5563]'}`}>
                    {visibleCols.has(col.key) && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={visibleCols.has(col.key) ? 'text-white' : 'text-[#9ca3af]'}>{col.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_STATUSES.map((s) => {
          const count = candidates.filter((c) => c.status === s).length;
          if (count === 0) return null;
          const active = statusFilter.includes(s);
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                active
                  ? STATUS_COLORS[s]
                  : 'border-[#363848] text-[#9ca3af] hover:border-[#68b0a6] hover:text-white'
              }`}
            >
              {STATUS_LABELS[s]} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
        {statusFilter.length > 0 && (
          <button onClick={() => setStatusFilter([])} className="text-xs text-[#9ca3af] hover:text-white px-1 transition-colors">
            ✕
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-[#9ca3af]">
        {filtered.length} {filtered.length === 1 ? 'kandidaat' : 'kandidaten'}
        {hasFilters && candidates.length !== filtered.length && ` (van ${candidates.length})`}
      </p>

      {/* Table */}
      <div className="rounded-xl border border-[#363848] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#363848] bg-[#1e2028]">
                {COLUMN_DEFS.filter((c) => visibleCols.has(c.key)).map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-left text-xs font-medium text-[#9ca3af] whitespace-nowrap cursor-pointer hover:text-white select-none group"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <SortIcon active={sortCol === col.key} dir={sortDir} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.size} className="px-3 py-12 text-center text-sm text-[#9ca3af]">
                    Geen kandidaten gevonden
                  </td>
                </tr>
              ) : (
                pageRows.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/dashboard/werving/${c.id}`)}
                    className={`border-b border-[#363848] cursor-pointer transition-colors hover:bg-[#252732] ${i % 2 === 0 ? 'bg-[#1e2028]' : 'bg-[#1a1c27]'}`}
                  >
                    {visibleCols.has('name') && (
                      <td className="px-3 py-2.5 font-medium text-white whitespace-nowrap">{c.name}</td>
                    )}
                    {visibleCols.has('status') && (
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                    )}
                    {visibleCols.has('phone') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] whitespace-nowrap">{c.phone ?? '—'}</td>
                    )}
                    {visibleCols.has('email') && (
                      <td className="px-3 py-2.5 text-[#9ca3af]">{c.email}</td>
                    )}
                    {visibleCols.has('location') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] whitespace-nowrap">{c.location ?? '—'}</td>
                    )}
                    {visibleCols.has('age') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] text-center">{c.age ?? '—'}</td>
                    )}
                    {visibleCols.has('salaryExpectation') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] whitespace-nowrap">
                        {c.salaryExpectation ? `€${Number(c.salaryExpectation).toLocaleString('nl-NL')}` : '—'}
                      </td>
                    )}
                    {visibleCols.has('vacature') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] whitespace-nowrap">{c.jobOpening?.title ?? '—'}</td>
                    )}
                    {visibleCols.has('leadSource') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] whitespace-nowrap">
                        {c.leadSource ? (SOURCE_LABELS[c.leadSource] ?? c.leadSource) : '—'}
                      </td>
                    )}
                    {visibleCols.has('assignedTo') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] whitespace-nowrap">{c.assignedTo?.name ?? '—'}</td>
                    )}
                    {visibleCols.has('createdAt') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] whitespace-nowrap">{shortDate(c.createdAt)}</td>
                    )}
                    {visibleCols.has('stageUpdatedAt') && (
                      <td className="px-3 py-2.5 text-[#9ca3af] whitespace-nowrap">{relativeDate(c.stageUpdatedAt)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#9ca3af]">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} van {sorted.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white hover:border-[#68b0a6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Vorige
            </button>
            {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  i === page
                    ? 'border-[#68b0a6] bg-[#68b0a6]/10 text-[#68b0a6]'
                    : 'border-[#363848] text-[#9ca3af] hover:text-white hover:border-[#68b0a6]'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white hover:border-[#68b0a6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Volgende
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
