'use client';

import { useState } from 'react';

interface ProfileData {
  name: string;
  email: string;
  role: string;
  address: string;
  city: string;
  postalCode: string;
  phonePersonal: string;
  dateOfBirth: string;
  emergencyName: string;
  emergencyPhone: string;
  department: string;
  startDate: string;
  leaveBalanceDays: number;
  leaveUsedDays: number;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Beheerder', PLANNER: 'Planner', ADVISEUR: 'Adviseur',
  MONTEUR: 'Monteur', CALLCENTER: 'Callcenter', BACKOFFICE: 'Backoffice', WAREHOUSE: 'Magazijn',
};

export function ProfielClient({ initialData }: { initialData: ProfileData }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: initialData.name,
    address: initialData.address,
    city: initialData.city,
    postalCode: initialData.postalCode,
    phonePersonal: initialData.phonePersonal,
    dateOfBirth: initialData.dateOfBirth,
    emergencyName: initialData.emergencyName,
    emergencyPhone: initialData.emergencyPhone,
  });

  // Password change form
  const [pwSaved, setPwSaved] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  function f(key: keyof typeof form, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
    setSaved(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fout bij opslaan.'); return; }
      setSaved(true);
    } catch {
      setError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSaved(false);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Nieuwe wachtwoorden komen niet overeen.');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError('Nieuw wachtwoord moet minimaal 8 tekens zijn.');
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error ?? 'Fout bij wijzigen wachtwoord.'); return; }
      setPwSaved(true);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      setPwError('Kan geen verbinding maken met de server.');
    } finally {
      setPwSaving(false);
    }
  }

  const leaveRemaining = initialData.leaveBalanceDays - initialData.leaveUsedDays;
  const leavePct = Math.min(100, Math.round((initialData.leaveUsedDays / Math.max(initialData.leaveBalanceDays, 1)) * 100));

  return (
    <div className="space-y-6 fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Mijn profiel</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">Beheer je persoonlijke gegevens en inloggegevens</p>
      </div>

      {/* Read-only info */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#68b0a6]/20 text-xl font-bold text-[#68b0a6] shrink-0">
            {form.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div className="text-lg font-semibold text-white">{form.name || initialData.name}</div>
            <div className="text-sm text-[#9ca3af]">{initialData.email}</div>
            <div className="mt-1 flex gap-2 flex-wrap">
              <span className="rounded-full bg-[#68b0a6]/10 px-2.5 py-0.5 text-xs font-medium text-[#68b0a6]">
                {ROLE_LABELS[initialData.role] ?? initialData.role}
              </span>
              {initialData.department && (
                <span className="rounded-full bg-[#363848] px-2.5 py-0.5 text-xs text-[#9ca3af]">
                  {initialData.department}
                </span>
              )}
              {initialData.startDate && (
                <span className="rounded-full bg-[#363848] px-2.5 py-0.5 text-xs text-[#9ca3af]">
                  In dienst: {new Date(initialData.startDate).toLocaleDateString('nl-NL')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Leave balance */}
        <div className="rounded-lg bg-[#1e2028] p-3">
          <div className="flex justify-between text-xs text-[#9ca3af] mb-1.5">
            <span>Verlofbalans</span>
            <span>{initialData.leaveUsedDays} / {initialData.leaveBalanceDays} dagen gebruikt</span>
          </div>
          <div className="h-2 rounded-full bg-[#363848] overflow-hidden">
            <div className="h-full rounded-full bg-[#68b0a6] transition-all" style={{ width: `${leavePct}%` }} />
          </div>
          <div className="mt-1 text-xs text-[#68b0a6]">{leaveRemaining} dagen resterend</div>
        </div>
      </div>

      {/* Personal info form */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Persoonlijke gegevens</h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-4 rounded-lg border border-[#4ade80]/30 bg-[#4ade80]/10 px-4 py-3 text-sm text-[#4ade80]">
            Gegevens opgeslagen.
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Display name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Naam</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => f('name', e.target.value)}
              className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Telefoon</label>
              <input
                type="tel"
                value={form.phonePersonal}
                onChange={(e) => f('phonePersonal', e.target.value)}
                placeholder="06-12345678"
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Geboortedatum</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => f('dateOfBirth', e.target.value)}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Adres</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => f('address', e.target.value)}
              placeholder="Straatnaam 1"
              className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Postcode</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => f('postalCode', e.target.value)}
                placeholder="1234 AB"
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Woonplaats</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => f('city', e.target.value)}
                placeholder="Amsterdam"
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
          </div>

          {/* Emergency contact */}
          <div className="pt-1">
            <div className="text-xs font-medium text-[#9ca3af] mb-2 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Contactpersoon bij noodgeval
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  value={form.emergencyName}
                  onChange={(e) => f('emergencyName', e.target.value)}
                  placeholder="Naam"
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="tel"
                  value={form.emergencyPhone}
                  onChange={(e) => f('emergencyPhone', e.target.value)}
                  placeholder="Telefoonnummer"
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Opslaan...' : 'Wijzigingen opslaan'}
            </button>
          </div>
        </form>
      </div>

      {/* Password change */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Wachtwoord wijzigen</h2>

        {pwError && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {pwError}
          </div>
        )}
        {pwSaved && (
          <div className="mb-4 rounded-lg border border-[#4ade80]/30 bg-[#4ade80]/10 px-4 py-3 text-sm text-[#4ade80]">
            Wachtwoord gewijzigd.
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Huidig wachtwoord</label>
            <input
              type="password"
              required
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
              className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Nieuw wachtwoord</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder="Min. 8 tekens"
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Bevestig wachtwoord</label>
              <input
                type="password"
                required
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-lg bg-[#363848] border border-[#4a4c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a4c5e] disabled:opacity-50 transition-colors"
            >
              {pwSaving ? 'Wijzigen...' : 'Wachtwoord wijzigen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
