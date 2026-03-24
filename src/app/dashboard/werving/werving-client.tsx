'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { KanbanColumn } from '@/components/recruitment/kanban-column';
import { CandidateCard } from '@/components/recruitment/candidate-card';
import type { Candidate, CandidateStatus, VacatureRol } from '@/types';
import { VACATURE_ROL_LABELS } from '@/types';

interface WervingClientProps {
  initialCandidates: Candidate[];
}

interface NewCandidateForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  salaryExpectation: string;
  source: string;
}

const COLUMNS: { title: string; statuses: CandidateStatus[]; color: string }[] = [
  { title: 'Nieuw', statuses: ['NEW_LEAD'], color: 'bg-blue-600' },
  { title: 'Pre-screening', statuses: ['PRE_SCREENING', 'SCREENING_DONE'], color: 'bg-yellow-600' },
  { title: 'Interview', statuses: ['INTERVIEW'], color: 'bg-purple-600' },
  { title: 'Reserve Bank', statuses: ['RESERVE_BANK'], color: 'bg-[#4a8f85]' },
  { title: 'Aangenomen', statuses: ['HIRED'], color: 'bg-green-700' },
];

// Map each status to its primary column status (for drop target resolution)
const STATUS_TO_COLUMN: Record<CandidateStatus, CandidateStatus> = {
  NEW_LEAD: 'NEW_LEAD',
  PRE_SCREENING: 'PRE_SCREENING',
  SCREENING_DONE: 'PRE_SCREENING',
  INTERVIEW: 'INTERVIEW',
  RESERVE_BANK: 'RESERVE_BANK',
  HIRED: 'HIRED',
  REJECTED: 'REJECTED',
};

export function WervingClient({ initialCandidates }: WervingClientProps) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [roleFilter, setRoleFilter] = useState<VacatureRol | 'ALL'>('ALL');
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewCandidateForm>({
    firstName: '', lastName: '', email: '', phone: '', salaryExpectation: '', source: '',
  });
  const [error, setError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (prevents accidental drags on clicks)
      },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const candidate = candidates.find((c) => c.id === event.active.id);
    setActiveCandidate(candidate ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCandidate(null);
    const { active, over } = event;
    if (!over) return;

    const candidateId = active.id as string;
    const targetStatus = over.id as CandidateStatus;
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    // Map column primary status → the correct status to assign
    // For "PRE_SCREENING" column, keep current status if already in that column,
    // otherwise move to PRE_SCREENING
    let newStatus: CandidateStatus = targetStatus;
    if (targetStatus === STATUS_TO_COLUMN[candidate.status] && candidate.status !== targetStatus) {
      // Already in this logical column, keep current status
      return;
    }

    if (newStatus === candidate.status) return; // No change

    // Optimistic update
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, status: newStatus } : c))
    );

    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setCandidates(initialCandidates); // Revert on failure
      }
    } catch {
      setCandidates(initialCandidates);
    }
  }

  async function handleMove(id: string, newStatus: CandidateStatus) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    );
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setCandidates(initialCandidates);
      }
    } catch {
      setCandidates(initialCandidates);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          salaryExpectation: form.salaryExpectation ? Number(form.salaryExpectation) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Fout bij aanmaken kandidaat.');
        return;
      }
      setCandidates((prev) => [data.data, ...prev]);
      setShowForm(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', salaryExpectation: '', source: '' });
    } catch {
      setError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

  const visibleCandidates = roleFilter === 'ALL'
    ? candidates
    : candidates.filter(c => c.jobOpening?.roleType === roleFilter);

  // Collect roles that actually have candidates
  const activeRoles = [...new Set(
    candidates.map(c => c.jobOpening?.roleType).filter((r): r is VacatureRol => !!r)
  )] as VacatureRol[];

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Werving</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">{visibleCandidates.length} kandidaten{roleFilter !== 'ALL' ? ` · ${VACATURE_ROL_LABELS[roleFilter]}` : ' in pipeline'}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nieuwe kandidaat
        </button>
      </div>

      {/* Role filter */}
      {activeRoles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRoleFilter('ALL')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              roleFilter === 'ALL'
                ? 'bg-[#68b0a6] text-white'
                : 'border border-[#363848] text-[#9ca3af] hover:text-white hover:border-[#68b0a6]'
            }`}
          >
            Alle functies
          </button>
          {activeRoles.map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role === roleFilter ? 'ALL' : role)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                roleFilter === role
                  ? 'bg-[#68b0a6] text-white'
                  : 'border border-[#363848] text-[#9ca3af] hover:text-white hover:border-[#68b0a6]'
              }`}
            >
              {VACATURE_ROL_LABELS[role]}
            </button>
          ))}
        </div>
      )}

      {/* New candidate form */}
      {showForm && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Nieuwe kandidaat toevoegen</h2>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: 'firstName', label: 'Voornaam', required: true },
              { key: 'lastName', label: 'Achternaam', required: true },
              { key: 'email', label: 'E-mail', required: true, type: 'email' },
              { key: 'phone', label: 'Telefoon', required: false },
              { key: 'salaryExpectation', label: 'Salarisverwachting (€)', required: false, type: 'number' },
              { key: 'source', label: 'Bron', required: false },
            ].map(({ key, label, required, type }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-[#9ca3af]">{label}</label>
                <input
                  type={type ?? 'text'}
                  required={required}
                  value={form[key as keyof NewCandidateForm]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Opslaan...' : 'Kandidaat toevoegen'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban board with DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((col) => {
              const colCandidates = visibleCandidates.filter((c) =>
                (col.statuses as string[]).includes(c.status)
              );
              return (
                <KanbanColumn
                  key={col.title}
                  title={col.title}
                  status={col.statuses[0]}
                  candidates={colCandidates}
                  color={col.color}
                  onMove={handleMove}
                />
              );
            })}
          </div>
        </div>

        {/* Floating drag overlay */}
        <DragOverlay>
          {activeCandidate ? (
            <CandidateCard
              candidate={activeCandidate}
              onMove={handleMove}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
