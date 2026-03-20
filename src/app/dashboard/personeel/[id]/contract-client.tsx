'use client';

import { useState } from 'react';
import type { Contract } from '@/types';

const CONTRACT_TYPES = [
  'Bepaalde tijd', 'Onbepaalde tijd', 'Oproepcontract', 'Tijdelijk', 'Uitzendcontract',
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-[#4ade80]/10 text-[#4ade80]',
  EXPIRED: 'bg-red-500/10 text-red-400',
  PENDING: 'bg-[#f7a247]/10 text-[#f7a247]',
  TERMINATED: 'bg-[#9ca3af]/10 text-[#9ca3af]',
};

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface ContractClientProps {
  employeeProfileId: string;
  initialContracts: Contract[];
}

export function ContractClient({ employeeProfileId, initialContracts }: ContractClientProps) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    contractType: 'Bepaalde tijd',
    startDate: '',
    endDate: '',
    hoursPerWeek: '40',
    salaryGross: '',
    probationEndDate: '',
    contractSequence: String(Math.min(initialContracts.length + 1, 3)),
  });

  function resetForm() {
    setForm({
      contractType: 'Bepaalde tijd',
      startDate: '',
      endDate: '',
      hoursPerWeek: '40',
      salaryGross: '',
      probationEndDate: '',
      contractSequence: String(Math.min(contracts.length + 1, 3)),
    });
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeProfileId,
          contractType: form.contractType,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          hoursPerWeek: form.hoursPerWeek ? Number(form.hoursPerWeek) : undefined,
          salaryGross: form.salaryGross ? Number(form.salaryGross) : undefined,
          probationEndDate: form.probationEndDate || undefined,
          contractSequence: Number(form.contractSequence),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fout bij aanmaken contract.'); return; }
      setContracts((prev) => [data.data, ...prev]);
      setShowForm(false);
      resetForm();
    } catch {
      setError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

  const chainCount = contracts.filter((c) => c.status === 'ACTIVE').length || contracts.length;

  return (
    <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-white">Contracten</h2>
          {/* Chain indicator */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#9ca3af]">Keten:</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-2 w-5 rounded-full ${i <= Math.min(chainCount, 3) ? 'bg-[#68b0a6]' : 'bg-[#363848]'}`}
                />
              ))}
            </div>
            <span className="text-xs text-[#9ca3af]">{Math.min(chainCount, 3)}/3</span>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
          className="flex items-center gap-1.5 rounded-lg bg-[#68b0a6]/10 px-3 py-1.5 text-xs font-medium text-[#68b0a6] hover:bg-[#68b0a6]/20 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nieuw contract
        </button>
      </div>

      {/* Contract form */}
      {showForm && (
        <div className="mb-4 rounded-lg bg-[#1e2028] p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Contracttype *</label>
              <select
                required
                value={form.contractType}
                onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-xs text-white focus:border-[#68b0a6] focus:outline-none"
              >
                {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Ketenpositie</label>
              <select
                value={form.contractSequence}
                onChange={(e) => setForm((f) => ({ ...f, contractSequence: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-xs text-white focus:border-[#68b0a6] focus:outline-none"
              >
                <option value="1">1e contract</option>
                <option value="2">2e contract</option>
                <option value="3">3e contract</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Startdatum *</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-xs text-white focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Einddatum</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-xs text-white focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Uren/week</label>
              <input
                type="number"
                min="1"
                max="40"
                value={form.hoursPerWeek}
                onChange={(e) => setForm((f) => ({ ...f, hoursPerWeek: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-xs text-white focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Bruto salaris/maand</label>
              <input
                type="number"
                min="0"
                step="50"
                value={form.salaryGross}
                onChange={(e) => setForm((f) => ({ ...f, salaryGross: e.target.value }))}
                placeholder="bijv. 2500"
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-xs text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Einde proeftijd</label>
              <input
                type="date"
                value={form.probationEndDate}
                onChange={(e) => setForm((f) => ({ ...f, probationEndDate: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-xs text-white focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#68b0a6] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Opslaan...' : 'Contract aanmaken'}
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

      {/* Contract list */}
      {contracts.length === 0 ? (
        <p className="text-sm text-[#9ca3af] py-4 text-center">Geen contracten gevonden.</p>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => {
            const daysLeft = daysUntil(c.endDate);
            return (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-[#1e2028] px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#e8e9ed]">{c.contractType ?? 'Contract'}</div>
                  <div className="text-xs text-[#9ca3af] mt-0.5">
                    {new Date(c.startDate).toLocaleDateString('nl-NL')}
                    {c.endDate ? ` – ${new Date(c.endDate).toLocaleDateString('nl-NL')}` : ' – Onbepaald'}
                    {c.hoursPerWeek ? ` · ${c.hoursPerWeek}u/week` : ''}
                    {c.salaryGross ? ` · €${c.salaryGross.toLocaleString('nl-NL')}/mnd` : ''}
                  </div>
                  {c.probationEndDate && new Date(c.probationEndDate) > new Date() && (
                    <div className="text-xs text-[#f7a247] mt-0.5">
                      Proeftijd t/m {new Date(c.probationEndDate).toLocaleDateString('nl-NL')}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? ''}`}>
                    {c.status === 'ACTIVE' ? 'Actief' : c.status === 'EXPIRED' ? 'Verlopen' : c.status === 'TERMINATED' ? 'Beëindigd' : c.status}
                  </span>
                  {daysLeft !== null && daysLeft <= 60 && daysLeft >= 0 && (
                    <div className={`text-xs mt-1 ${daysLeft <= 30 ? 'text-red-400' : 'text-[#f7a247]'}`}>
                      {daysLeft === 0 ? 'Verloopt vandaag' : `${daysLeft}d`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
