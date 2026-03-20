'use client';

import { useState } from 'react';

interface LeaveRequestFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  defaultType?: string;
}

export function LeaveRequestForm({ onSuccess, onCancel, defaultType = 'VACATION' }: LeaveRequestFormProps) {
  const [type, setType] = useState(defaultType);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function calcDays() {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    let days = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const days = calcDays();
    if (days === 0) {
      setError('Selecteer geldige start- en einddatum (weekdagen).');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, startDate, endDate, days, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Fout bij indienen aanvraag.');
        return;
      }
      onSuccess();
    } catch {
      setError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

  const days = calcDays();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Type */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#9ca3af]">Type verlof</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
        >
          <option value="VACATION">Vakantie</option>
          <option value="SICK">Ziekmelding</option>
          <option value="PERSONAL">Persoonlijk verlof</option>
          <option value="UNPAID">Onbetaald verlof</option>
          <option value="SPECIAL">Bijzonder verlof</option>
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#9ca3af]">Startdatum</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#9ca3af]">Einddatum</label>
          <input
            type="date"
            required
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
          />
        </div>
      </div>

      {days > 0 && (
        <p className="text-xs text-[#68b0a6]">{days} werkdag{days !== 1 ? 'en' : ''}</p>
      )}

      {/* Reason */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#9ca3af]">Reden (optioneel)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Voeg een toelichting toe..."
          className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none resize-none"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Indienen...' : type === 'SICK' ? 'Ziek melden' : 'Verlof aanvragen'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
