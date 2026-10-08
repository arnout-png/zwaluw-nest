'use client';

import { useMemo, useState } from 'react';
import type { Contract } from '@/types';
import { computeChain, nextChainPosition, probationWarnings, isPermanentContract } from '@/lib/contracts';
import { amsterdamDateString, datePart } from '@/lib/dates';

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
  const end = datePart(dateStr);
  if (!end) return null;
  const today = amsterdamDateString();
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** ACTIVE met een einddatum in het verleden is in werkelijkheid verlopen. */
function effectiveStatus(c: Contract): string {
  const end = datePart(c.endDate);
  if (c.status === 'ACTIVE' && end && end < amsterdamDateString()) return 'EXPIRED';
  return c.status;
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [form, setForm] = useState({
    contractType: 'Bepaalde tijd',
    startDate: '',
    endDate: '',
    hoursPerWeek: '40',
    salaryGross: '',
    probationEndDate: '',
  });

  function resetForm() {
    setForm({
      contractType: 'Bepaalde tijd',
      startDate: '',
      endDate: '',
      hoursPerWeek: '40',
      salaryGross: '',
      probationEndDate: '',
    });
    setError('');
  }

  // Ketenbepaling: berekend uit de contracthistorie (3 tijdelijke contracten
  // binnen 36 maanden, keten doorbroken na > 6 maanden tussenpoos).
  const chain = useMemo(() => computeChain(contracts), [contracts]);
  const formIsPermanent = isPermanentContract({ startDate: form.startDate, endDate: form.endDate || null, contractType: form.contractType });
  const formPosition = form.startDate && !formIsPermanent ? nextChainPosition(contracts, form.startDate) : null;
  const formWarnings = form.startDate
    ? [
        ...(formPosition !== null && formPosition > 3 ? ['Dit zou het 4e tijdelijke contract in de keten zijn: het geldt dan als contract voor onbepaalde tijd.'] : []),
        ...probationWarnings({
          startDate: form.startDate,
          endDate: form.endDate || null,
          probationEndDate: form.probationEndDate || null,
          chainPosition: formPosition ?? 1,
        }),
      ]
    : [];

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
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fout bij aanmaken contract.'); return; }
      setContracts((prev) => [data.data, ...prev]);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setShowForm(false);
      resetForm();
    } catch {
      setError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

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
                  className={`h-2 w-5 rounded-full ${
                    i <= Math.min(chain.count, 3)
                      ? chain.level === 'exceeded' ? 'bg-red-400' : chain.level === 'warning' ? 'bg-[#f7a247]' : 'bg-[#68b0a6]'
                      : 'bg-[#363848]'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-[#9ca3af]">
              {chain.count}/3{chain.count > 0 ? ` · ${chain.months} mnd` : ''}
            </span>
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

      {chain.message && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
          chain.level === 'exceeded' ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-[#f7a247]/30 bg-[#f7a247]/10 text-[#f7a247]'
        }`}>
          {chain.message}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#f7a247]/30 bg-[#f7a247]/10 px-3 py-2 text-xs text-[#f7a247] space-y-1">
          {warnings.map((w) => <p key={w}>{w}</p>)}
        </div>
      )}

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
              <div className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-xs text-[#9ca3af]">
                {formIsPermanent ? 'n.v.t. (onbepaalde tijd)' : formPosition ? `${formPosition}e contract (automatisch)` : 'Kies eerst een startdatum'}
              </div>
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
            {formWarnings.length > 0 && (
              <div className="col-span-2 rounded-lg border border-[#f7a247]/30 bg-[#f7a247]/10 px-3 py-2 text-xs text-[#f7a247] space-y-1">
                {formWarnings.map((w) => <p key={w}>{w}</p>)}
              </div>
            )}
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
            const status = effectiveStatus(c);
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
                  {c.probationEndDate && (datePart(c.probationEndDate) ?? '') >= amsterdamDateString() && (
                    <div className="text-xs text-[#f7a247] mt-0.5">
                      Proeftijd t/m {new Date(c.probationEndDate).toLocaleDateString('nl-NL')}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? ''}`}>
                    {status === 'ACTIVE' ? 'Actief' : status === 'EXPIRED' ? 'Verlopen' : status === 'TERMINATED' ? 'Beëindigd' : status === 'PENDING' ? 'Toekomstig' : status}
                  </span>
                  {status === 'ACTIVE' && daysLeft !== null && daysLeft <= 60 && daysLeft >= 0 && (
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
