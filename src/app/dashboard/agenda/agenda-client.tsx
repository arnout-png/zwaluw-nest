'use client';

import { useState } from 'react';
import { WeekCalendar } from '@/components/agenda/week-calendar';
import type { Appointment, EmployeeWithProfile } from '@/types';

interface AgendaClientProps {
  appointments: Appointment[];
  employees: EmployeeWithProfile[];
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

const APPT_TYPES = ['Adviesgesprek', 'Montage', 'Inspectie', 'Nazorg', 'Overig'];
const MONTH_NAMES = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

export function AgendaClient({ appointments: initialAppts, employees }: AgendaClientProps) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppts);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employeeProfileId: '',
    type: 'Adviesgesprek',
    scheduledAt: '',
    duration: '60',
    customerName: '',
    address: '',
    notes: '',
  });

  function prevWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function goToday() {
    setWeekStart(getMonday(new Date()));
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  function weekLabel() {
    const s = weekStart;
    const e = weekEnd;
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()}–${e.getDate()} ${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`;
    }
    return `${s.getDate()} ${MONTH_NAMES[s.getMonth()]} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`;
  }

  // Filter appointments to current week using the `date` field
  const weekStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const weekAppts = appointments.filter((a) => {
    const d = a.date ?? (a.startTime ? new Date(a.startTime).toISOString().split('T')[0] : '');
    return d >= weekStr && d <= weekEndStr;
  });

  async function handleCreateAppt(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      // Optionally create customer first
      let customerId: string | undefined;
      if (form.customerName) {
        const custRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.customerName, address: form.address || 'Onbekend', city: '' }),
        }).catch(() => null);
        if (custRes?.ok) {
          const custData = await custRes.json();
          customerId = custData.data?.id;
        }
      }

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          employeeProfileId: form.employeeProfileId,
          // Send legacy field names — API maps them to new schema
          type: form.type,
          scheduledAt: form.scheduledAt,
          duration: Number(form.duration),
          address: form.address,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Fout bij aanmaken afspraak.');
        return;
      }
      setAppointments((prev) => [...prev, data.data]);
      setShowForm(false);
      setForm({ employeeProfileId: '', type: 'Adviesgesprek', scheduledAt: '', duration: '60', customerName: '', address: '', notes: '' });
    } catch {
      setError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Agenda</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">{weekAppts.length} afspraken deze week</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Afspraak plannen
        </button>
      </div>

      {/* New appointment form */}
      {showForm && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Nieuwe afspraak</h2>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleCreateAppt} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Medewerker</label>
              <select
                required
                value={form.employeeProfileId}
                onChange={(e) => setForm((f) => ({ ...f, employeeProfileId: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
              >
                <option value="">Selecteer medewerker</option>
                {employees.map((emp) => (
                  <option key={emp.employeeProfile?.id ?? emp.id} value={emp.employeeProfile?.id ?? ''}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
              >
                {APPT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Datum & tijd</label>
              <input
                type="datetime-local"
                required
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Klantnaam</label>
              <input
                type="text"
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Naam klant"
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Adres</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Straat + huisnummer, stad"
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Duur (minuten)</label>
              <select
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
              >
                {[30,45,60,90,120,180].map((d) => (
                  <option key={d} value={d}>{d} minuten</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Opmerkingen</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optionele notities..."
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Opslaan...' : 'Afspraak aanmaken'}
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

      {/* Week navigation */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1e2028] hover:text-white transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-white min-w-40 text-center">{weekLabel()}</span>
            <button onClick={nextWeek} className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1e2028] hover:text-white transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            onClick={goToday}
            className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white hover:border-[#68b0a6] transition-colors"
          >
            Vandaag
          </button>
        </div>
        <WeekCalendar weekStart={weekStart} appointments={weekAppts} />
      </div>
    </div>
  );
}
