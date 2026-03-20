'use client';

import { useState, useMemo } from 'react';
import { EmployeeCard } from '@/components/hr/employee-card';
import type { EmployeeWithProfile } from '@/types';

const ROLE_OPTIONS = [
  { value: 'ADVISEUR', label: 'Adviseur' },
  { value: 'MONTEUR', label: 'Monteur' },
  { value: 'PLANNER', label: 'Planner' },
  { value: 'CALLCENTER', label: 'Callcenter' },
  { value: 'BACKOFFICE', label: 'Backoffice' },
  { value: 'WAREHOUSE', label: 'Magazijn' },
  { value: 'ADMIN', label: 'Beheerder' },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

interface NewEmployeeForm {
  email: string;
  name: string;
  role: string;
  password: string;
  department: string;
  startDate: string;
  phonePersonal: string;
  leaveBalanceDays: string;
}

interface PersoneelClientProps {
  employees: EmployeeWithProfile[];
}

export function PersoneelClient({ employees: initialEmployees }: PersoneelClientProps) {
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>(initialEmployees);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<NewEmployeeForm>({
    email: '', name: '', role: 'ADVISEUR', password: '',
    department: '', startDate: '', phonePersonal: '', leaveBalanceDays: '25',
  });

  // Derive unique departments for filter pills
  const departments = useMemo(() => {
    const depts = new Set<string>();
    for (const e of employees) {
      const d = e.employeeProfile?.department;
      if (d) depts.add(d);
    }
    return [...depts].sort();
  }, [employees]);

  // Unique roles present in the list
  const presentRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const e of employees) roles.add(e.role);
    return [...roles];
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.employeeProfile?.department ?? '').toLowerCase().includes(q);
      const matchesRole = !roleFilter || e.role === roleFilter;
      const matchesDept = !deptFilter || e.employeeProfile?.department === deptFilter;
      return matchesSearch && matchesRole && matchesDept;
    });
  }, [employees, search, roleFilter, deptFilter]);

  function resetForm() {
    setForm({ email: '', name: '', role: 'ADVISEUR', password: '', department: '', startDate: '', phonePersonal: '', leaveBalanceDays: '25' });
    setFormError('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phonePersonal: form.phonePersonal || undefined,
          leaveBalanceDays: Number(form.leaveBalanceDays) || 25,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Fout bij aanmaken medewerker.');
        return;
      }
      const newEmp: EmployeeWithProfile = {
        ...data.data,
        employeeProfile: {
          id: data.data.employeeProfileId ?? '',
          userId: data.data.id,
          department: form.department || undefined,
          startDate: form.startDate || undefined,
          phonePersonal: form.phonePersonal || undefined,
          leaveBalanceDays: Number(form.leaveBalanceDays) || 25,
          leaveUsedDays: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      setEmployees((prev) => [newEmp, ...prev]);
      setShowForm(false);
      resetForm();
    } catch {
      setFormError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

  const hasFilters = !!search || !!roleFilter || !!deptFilter;

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Personeel</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            {filtered.length !== employees.length
              ? `${filtered.length} van ${employees.length} medewerkers`
              : `${employees.length} actieve medewerkers`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); resetForm(); }}
          className="flex items-center gap-2 rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Medewerker toevoegen
        </button>
      </div>

      {/* Add employee form */}
      {showForm && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Nieuwe medewerker toevoegen</h2>
          {formError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Naam *</label>
              <input type="text" required value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">E-mail *</label>
              <input type="email" required value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Wachtwoord *</label>
              <input type="password" required minLength={8} value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 tekens"
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Rol *</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none">
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Afdeling</label>
              <input type="text" value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="bijv. Sales"
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Startdatum</label>
              <input type="date" value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Telefoon</label>
              <input type="tel" value={form.phonePersonal}
                onChange={(e) => setForm((f) => ({ ...f, phonePersonal: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Verlofbalans (dagen)</label>
              <input type="number" min="0" max="50" value={form.leaveBalanceDays}
                onChange={(e) => setForm((f) => ({ ...f, leaveBalanceDays: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors">
                {saving ? 'Opslaan...' : 'Medewerker aanmaken'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors">
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-4 w-4 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Zoek op naam, e-mail of afdeling..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#363848] bg-[#252732] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none focus:ring-1 focus:ring-[#68b0a6]"
          />
        </div>

        {/* Role filter pills */}
        {presentRoles.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRoleFilter(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !roleFilter ? 'bg-[#68b0a6] text-white' : 'bg-[#252732] border border-[#363848] text-[#9ca3af] hover:border-[#68b0a6] hover:text-white'
              }`}
            >
              Alle rollen
            </button>
            {presentRoles.map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(roleFilter === r ? null : r)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  roleFilter === r ? 'bg-[#68b0a6] text-white' : 'bg-[#252732] border border-[#363848] text-[#9ca3af] hover:border-[#68b0a6] hover:text-white'
                }`}
              >
                {ROLE_LABELS[r] ?? r}
              </button>
            ))}
          </div>
        )}

        {/* Department filter pills */}
        {departments.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDeptFilter(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !deptFilter ? 'bg-[#f7a247] text-white' : 'bg-[#252732] border border-[#363848] text-[#9ca3af] hover:border-[#f7a247] hover:text-white'
              }`}
            >
              Alle afdelingen
            </button>
            {departments.map((d) => (
              <button
                key={d}
                onClick={() => setDeptFilter(deptFilter === d ? null : d)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  deptFilter === d ? 'bg-[#f7a247] text-white' : 'bg-[#252732] border border-[#363848] text-[#9ca3af] hover:border-[#f7a247] hover:text-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {/* Active filter indicator */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setRoleFilter(null); setDeptFilter(null); }}
            className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-red-400 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Filters wissen
          </button>
        )}
      </div>

      {/* Employee list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#363848] bg-[#252732] py-16">
          <svg className="h-12 w-12 text-[#363848] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-[#9ca3af]">
            {hasFilters ? 'Geen medewerkers gevonden voor deze filters.' : 'Nog geen medewerkers.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} />
          ))}
        </div>
      )}
    </div>
  );
}
