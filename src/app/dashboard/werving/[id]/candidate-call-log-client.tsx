'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CallLog, CallStatus, CandidateStatus } from '@/types';

const STATUS_LABELS: Record<CallStatus, string> = {
  GEEN_GEHOOR: 'Geen gehoor',
  VOICEMAIL: 'Voicemail',
  BEREIKT: 'Contact',
  TERUGBELLEN: 'Terugbellen',
};

const STATUS_COLORS: Record<CallStatus, string> = {
  GEEN_GEHOOR: 'bg-[#363848] text-[#9ca3af]',
  VOICEMAIL: 'bg-[#f7a247]/10 text-[#f7a247]',
  BEREIKT: 'bg-[#68b0a6]/10 text-[#68b0a6]',
  TERUGBELLEN: 'bg-blue-500/10 text-blue-400',
};

interface Props {
  candidateId: string;
  candidateStatus: CandidateStatus;
  candidatePhone: string | null;
  initialCallLogs: CallLog[];
}

type ActiveForm = 'VOICEMAIL' | 'TERUGBELLEN' | null;

export function CandidateCallLogClient({
  candidateId,
  candidateStatus,
  initialCallLogs,
}: Props) {
  const router = useRouter();
  const [callLogs, setCallLogs] = useState<CallLog[]>(initialCallLogs);
  const [saving, setSaving] = useState<CallStatus | null>(null);
  const [saveError, setSaveError] = useState('');

  // Expanded form state
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [messageLeft, setMessageLeft] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    setCallLogs(initialCallLogs);
  }, [initialCallLogs]);

  const lastLog = callLogs[0] ?? null;
  const isResolved = ['INTERVIEW', 'RESERVE_BANK', 'HIRED', 'REJECTED'].includes(candidateStatus);

  function resetForm() {
    setActiveForm(null);
    setMessageLeft(false);
    setCallbackDate('');
    setCallbackTime('');
    setNoteText('');
    setSaveError('');
  }

  async function logCall(status: CallStatus, opts?: { notes?: string | undefined; callbackAt?: string | undefined }) {
    setSaving(status);
    setSaveError('');
    try {
      const res = await fetch(`/api/candidates/${candidateId}/call-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          notes: opts?.notes ?? null,
          callbackAt: opts?.callbackAt ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Opslaan mislukt.');
        return;
      }
      setCallLogs(prev => [data.data, ...prev]);
      resetForm();
      router.refresh();
    } catch {
      setSaveError('Verbinding mislukt.');
    } finally {
      setSaving(null);
    }
  }

  function handleVoicemailSave() {
    const parts: string[] = [];
    if (messageLeft) parts.push('Bericht achtergelaten');
    if (noteText.trim()) parts.push(noteText.trim());
    logCall('VOICEMAIL', { notes: parts.join('\n') || undefined });
  }

  function handleTerugbellenSave() {
    let callbackAt: string | undefined;
    if (callbackDate) {
      const dt = callbackTime ? `${callbackDate}T${callbackTime}:00` : `${callbackDate}T00:00:00`;
      callbackAt = new Date(dt).toISOString();
    }
    logCall('TERUGBELLEN', { notes: noteText.trim() || undefined, callbackAt });
  }

  // Today as min date for callback
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Bel opvolging</h2>
          {lastLog && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[lastLog.status as CallStatus]}`}>
              Laatste: {STATUS_LABELS[lastLog.status as CallStatus]}
            </span>
          )}
        </div>
        <span className="text-xs text-[#9ca3af]">{callLogs.length} poging{callLogs.length !== 1 ? 'en' : ''}</span>
      </div>

      {/* Bel knoppen + inline formulieren */}
      {!isResolved && (
        <div className="space-y-3">
          <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wide">Log bel poging</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Geen gehoor — direct log */}
            <button
              onClick={() => logCall('GEEN_GEHOOR')}
              disabled={saving !== null}
              className="rounded-lg border border-[#363848] px-3 py-2.5 text-xs font-medium text-[#9ca3af] hover:border-[#68b0a6]/50 hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>📵</span>
              {saving === 'GEEN_GEHOOR' ? 'Opslaan…' : 'Geen gehoor'}
            </button>

            {/* Voicemail — opent inline formulier */}
            <button
              onClick={() => setActiveForm(prev => prev === 'VOICEMAIL' ? null : 'VOICEMAIL')}
              disabled={saving !== null}
              className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                activeForm === 'VOICEMAIL'
                  ? 'border-[#f7a247]/50 bg-[#f7a247]/10 text-[#f7a247]'
                  : 'border-[#363848] text-[#9ca3af] hover:border-[#f7a247]/50 hover:text-white'
              }`}
            >
              <span>📬</span>
              Voicemail
            </button>

            {/* Terugbellen — opent inline formulier */}
            <button
              onClick={() => setActiveForm(prev => prev === 'TERUGBELLEN' ? null : 'TERUGBELLEN')}
              disabled={saving !== null}
              className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                activeForm === 'TERUGBELLEN'
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-[#363848] text-[#9ca3af] hover:border-blue-500/50 hover:text-white'
              }`}
            >
              <span>🔁</span>
              Terugbellen
            </button>

            {/* Contact (BEREIKT) — direct log + refresh */}
            <button
              onClick={() => logCall('BEREIKT')}
              disabled={saving !== null}
              className="rounded-lg border border-[#68b0a6]/60 bg-[#68b0a6]/10 px-3 py-2.5 text-xs font-medium text-[#68b0a6] hover:bg-[#68b0a6]/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>✅</span>
              {saving === 'BEREIKT' ? 'Opslaan…' : 'Contact'}
            </button>
          </div>

          {/* Voicemail formulier */}
          {activeForm === 'VOICEMAIL' && (
            <div className="rounded-lg border border-[#f7a247]/30 bg-[#1e2028] p-4 space-y-3">
              <p className="text-xs font-medium text-[#f7a247]">Voicemail details</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={messageLeft}
                  onChange={e => setMessageLeft(e.target.checked)}
                  className="rounded border-[#363848] bg-[#252732] accent-[#f7a247]"
                />
                <span className="text-sm text-[#e8e9ed]">Bericht achtergelaten</span>
              </label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Optionele opmerking…"
                rows={2}
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#f7a247] focus:outline-none resize-none"
              />
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleVoicemailSave}
                  disabled={saving !== null}
                  className="rounded-lg bg-[#f7a247] px-4 py-2 text-xs font-semibold text-white hover:bg-[#f7a247]/80 disabled:opacity-50 transition-colors"
                >
                  {saving === 'VOICEMAIL' ? 'Opslaan…' : 'Opslaan'}
                </button>
                <button
                  onClick={resetForm}
                  className="rounded-lg border border-[#363848] px-4 py-2 text-xs font-medium text-[#9ca3af] hover:text-white transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}

          {/* Terugbellen formulier */}
          {activeForm === 'TERUGBELLEN' && (
            <div className="rounded-lg border border-blue-500/30 bg-[#1e2028] p-4 space-y-3">
              <p className="text-xs font-medium text-blue-400">Terugbel afspraak</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#9ca3af] mb-1">Datum</label>
                  <input
                    type="date"
                    value={callbackDate}
                    min={todayStr}
                    onChange={e => setCallbackDate(e.target.value)}
                    className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9ca3af] mb-1">Tijd</label>
                  <input
                    type="time"
                    value={callbackTime}
                    onChange={e => setCallbackTime(e.target.value)}
                    className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Optionele opmerking…"
                rows={2}
                className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-blue-500 focus:outline-none resize-none"
              />
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleTerugbellenSave}
                  disabled={saving !== null}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving === 'TERUGBELLEN' ? 'Opslaan…' : 'Opslaan'}
                </button>
                <button
                  onClick={resetForm}
                  className="rounded-lg border border-[#363848] px-4 py-2 text-xs font-medium text-[#9ca3af] hover:text-white transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bel historie */}
      {callLogs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wide">Bel historie</p>
          <div className="space-y-2">
            {callLogs.map((log, i) => (
              <div
                key={log.id}
                className={`flex items-start gap-3 rounded-lg p-3 ${
                  i === 0 ? 'bg-[#1e2028] border border-[#363848]' : 'bg-[#1a1c24]'
                }`}
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${STATUS_COLORS[log.status as CallStatus]}`}>
                  {log.status === 'GEEN_GEHOOR' && '📵'}
                  {log.status === 'VOICEMAIL' && '📬'}
                  {log.status === 'BEREIKT' && '✅'}
                  {log.status === 'TERUGBELLEN' && '🔁'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold ${STATUS_COLORS[log.status as CallStatus].split(' ')[1]}`}>
                      {STATUS_LABELS[log.status as CallStatus]}
                    </span>
                    <span className="text-[10px] text-[#9ca3af] shrink-0">
                      {new Date(log.createdAt).toLocaleString('nl-NL', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {log.user && <p className="text-[10px] text-[#9ca3af] mt-0.5">{log.user.name}</p>}
                  {/* Terugbel datum prominent tonen */}
                  {log.status === 'TERUGBELLEN' && log.callbackAt && (
                    <p className="text-xs text-blue-400 mt-1 font-medium">
                      Terugbellen op:{' '}
                      {new Date(log.callbackAt).toLocaleString('nl-NL', {
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                  {/* Voicemail: bericht achtergelaten badge */}
                  {log.status === 'VOICEMAIL' && log.notes?.includes('Bericht achtergelaten') && (
                    <span className="inline-block mt-1 rounded-full bg-[#f7a247]/10 px-2 py-0.5 text-[10px] text-[#f7a247]">
                      Bericht achtergelaten
                    </span>
                  )}
                  {log.notes && !/^Bericht achtergelaten$/.test(log.notes) && (
                    <p className="text-xs text-[#9ca3af] mt-1 italic">
                      &ldquo;{log.notes.replace('Bericht achtergelaten\n', '')}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {callLogs.length === 0 && !isResolved && (
        <p className="text-xs text-[#9ca3af] text-center py-3 border border-dashed border-[#363848] rounded-lg">
          Nog geen bel pogingen geregistreerd.
        </p>
      )}
    </div>
  );
}
