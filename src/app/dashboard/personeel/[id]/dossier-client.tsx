'use client';

import { useState } from 'react';
import type { DossierEntry } from '@/types';

const DOSSIER_COLORS: Record<string, string> = {
  NOTE: 'bg-blue-500/10 text-blue-400', WARNING: 'bg-[#f7a247]/10 text-[#f7a247]',
  COMPLIMENT: 'bg-[#4ade80]/10 text-[#4ade80]', INCIDENT: 'bg-red-500/10 text-red-400',
  PERFORMANCE: 'bg-purple-500/10 text-purple-400', OTHER: 'bg-[#9ca3af]/10 text-[#9ca3af]',
};
const DOSSIER_LABELS: Record<string, string> = {
  NOTE: 'Notitie', WARNING: 'Waarschuwing', COMPLIMENT: 'Compliment',
  INCIDENT: 'Incident', PERFORMANCE: 'Prestatie', OTHER: 'Overig',
};
const DOSSIER_TYPES = Object.entries(DOSSIER_LABELS);

interface DossierClientProps {
  employeeId: string;
  initialEntries: DossierEntry[];
}

export function DossierClient({ employeeId, initialEntries }: DossierClientProps) {
  const [entries, setEntries] = useState<DossierEntry[]>(initialEntries);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ type: 'NOTE', title: '', content: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: employeeId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Fout bij opslaan.');
        return;
      }
      setEntries((prev) => [data.data, ...prev]);
      setShowForm(false);
      setForm({ type: 'NOTE', title: '', content: '' });
    } catch {
      setError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Dossier</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-[#68b0a6]/10 px-3 py-1.5 text-xs font-medium text-[#68b0a6] hover:bg-[#68b0a6]/20 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Notitie toevoegen
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-4 rounded-lg bg-[#1e2028] p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                >
                  {DOSSIER_TYPES.map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Titel *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Inhoud *</label>
              <textarea
                required
                rows={3}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Beschrijving..."
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#68b0a6] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(''); }}
                className="rounded-lg border border-[#363848] px-4 py-1.5 text-xs text-[#9ca3af] hover:text-white transition-colors"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg className="h-10 w-10 text-[#363848] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-[#9ca3af]">Geen dossierentries gevonden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg bg-[#1e2028] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOSSIER_COLORS[entry.type] ?? ''}`}>
                    {DOSSIER_LABELS[entry.type] ?? entry.type}
                  </span>
                  <span className="text-sm font-medium text-white">{entry.title}</span>
                </div>
                <span className="text-xs text-[#9ca3af] shrink-0">
                  {new Date(entry.date ?? entry.createdAt).toLocaleDateString('nl-NL')}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#9ca3af] leading-relaxed">{entry.description}</p>
              {entry.loggedBy && (
                <p className="mt-1.5 text-xs text-[#9ca3af]">
                  Door: {(entry.loggedBy as { name?: string }).name ?? 'Onbekend'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
