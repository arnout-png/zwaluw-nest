'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CallLog, CallStatus, CandidateStatus } from '@/types';

const CALL_STATUSES: { status: CallStatus; label: string; icon: string; color: string; activeColor: string }[] = [
  {
    status: 'GEEN_GEHOOR',
    label: 'Geen gehoor',
    icon: '📵',
    color: 'border-[#363848] text-[#9ca3af] hover:border-[#68b0a6]/50 hover:text-white',
    activeColor: 'border-[#4a5568] bg-[#2d2f3e] text-white',
  },
  {
    status: 'VOICEMAIL',
    label: 'Voicemail',
    icon: '📬',
    color: 'border-[#363848] text-[#9ca3af] hover:border-[#f7a247]/50 hover:text-white',
    activeColor: 'border-[#f7a247]/50 bg-[#f7a247]/10 text-[#f7a247]',
  },
  {
    status: 'TERUGBELLEN',
    label: 'Terugbellen',
    icon: '🔁',
    color: 'border-[#363848] text-[#9ca3af] hover:border-blue-500/50 hover:text-white',
    activeColor: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
  },
  {
    status: 'BEREIKT',
    label: 'Bereikt',
    icon: '✅',
    color: 'border-[#363848] text-[#9ca3af] hover:border-[#68b0a6]/50 hover:text-white',
    activeColor: 'border-[#68b0a6]/60 bg-[#68b0a6]/10 text-[#68b0a6]',
  },
];

const STATUS_LABELS: Record<CallStatus, string> = {
  GEEN_GEHOOR: 'Geen gehoor',
  VOICEMAIL: 'Voicemail',
  BEREIKT: 'Bereikt',
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
  candidateName: string;
  initialCallLogs: CallLog[];
  screeningSection: React.ReactNode;
  checklistSection: React.ReactNode;
}

export function CandidateCallLogClient({
  candidateId,
  candidateStatus,
  candidateName,
  initialCallLogs,
  screeningSection,
  checklistSection,
}: Props) {
  const router = useRouter();
  const [callLogs, setCallLogs] = useState<CallLog[]>(initialCallLogs);
  const [currentStatus, setCurrentStatus] = useState<CandidateStatus>(candidateStatus);
  const [selectedStatus, setSelectedStatus] = useState<CallStatus | null>(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Appointment form state
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [appointmentLocation, setAppointmentLocation] = useState('Kantoor Zwaluw, Oss');
  const [booking, setBooking] = useState(false);
  const [appointmentDone, setAppointmentDone] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Rejection state
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const lastLog = callLogs[0] ?? null;

  // Visibility logic — fully client-state driven, no router.refresh() needed
  const showScreening = ['PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(currentStatus);
  const showOutcome = showScreening && !['INTERVIEW', 'RESERVE_BANK', 'HIRED', 'REJECTED'].includes(currentStatus) && !appointmentDone;
  const showChecklist = ['INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(currentStatus) || appointmentDone;
  const isResolved = ['INTERVIEW', 'RESERVE_BANK', 'HIRED', 'REJECTED'].includes(currentStatus);

  async function logCall() {
    if (!selectedStatus) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/candidates/${candidateId}/call-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus, notes: noteText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Opslaan mislukt.');
        return;
      }
      setCallLogs(prev => [data.data, ...prev]);
      setNoteText('');
      setSelectedStatus(null);
      // When BEREIKT is logged: advance status to PRE_SCREENING locally — no router.refresh() needed
      if (selectedStatus === 'BEREIKT' && currentStatus === 'NEW_LEAD') {
        setCurrentStatus('PRE_SCREENING');
      }
    } catch {
      setSaveError('Verbinding mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function rejectCandidate() {
    setRejecting(true);
    try {
      await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      });
      setCurrentStatus('REJECTED');
      setConfirmReject(false);
      router.refresh(); // Refresh to update header status badge
    } catch {
      // silent
    } finally {
      setRejecting(false);
    }
  }

  async function bookAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!appointmentDate || !appointmentTime) return;
    setBooking(true);
    setBookingError('');
    try {
      const res = await fetch(`/api/candidates/${candidateId}/appointment-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: appointmentDate,
          time: appointmentTime,
          location: appointmentLocation,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setBookingError(data.error ?? 'Afspraak inplannen mislukt.');
        return;
      }
      setAppointmentDone(true);
      setCurrentStatus('INTERVIEW');
      setShowAppointmentForm(false);
      router.refresh(); // Refresh header status badge only
    } catch {
      setBookingError('Verbinding mislukt.');
    } finally {
      setBooking(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* ── Bel opvolging card ─────────────────────────────────────── */}
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

        {/* Appointment success banner */}
        {appointmentDone && (
          <div className="rounded-lg border border-[#68b0a6]/30 bg-[#68b0a6]/10 px-4 py-3 flex items-center gap-3">
            <span className="text-lg">📅</span>
            <div>
              <p className="text-sm font-medium text-[#68b0a6]">Afspraak bevestigd</p>
              <p className="text-xs text-[#9ca3af] mt-0.5">SMS en e-mail zijn verzonden naar {candidateName}. Status bijgewerkt naar Sollicitatiegesprek.</p>
            </div>
          </div>
        )}

        {/* Rejected banner */}
        {currentStatus === 'REJECTED' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400 font-medium">Kandidaat afgewezen</p>
          </div>
        )}

        {/* Log bel poging form — hide when resolved */}
        {!isResolved && (
          <div className="space-y-3">
            <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wide">Log bel poging</p>

            {/* Status buttons */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CALL_STATUSES.map(({ status, label, icon, color, activeColor }) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(prev => prev === status ? null : status)}
                  className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    selectedStatus === status ? activeColor : color
                  }`}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* Optional note + save */}
            {selectedStatus && (
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Optionele notitie (bijv. 'Belt terug morgen om 9:00')"
                  rows={2}
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none resize-none"
                />
                {saveError && (
                  <p className="text-xs text-red-400">{saveError}</p>
                )}
                <button
                  onClick={logCall}
                  disabled={saving}
                  className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Opslaan...' : `Log: ${STATUS_LABELS[selectedStatus]}`}
                </button>
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
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {log.user && (
                      <p className="text-[10px] text-[#9ca3af] mt-0.5">{log.user.name}</p>
                    )}
                    {log.notes && (
                      <p className="text-xs text-[#9ca3af] mt-1 italic">&ldquo;{log.notes}&rdquo;</p>
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

      {/* ── Pre-screening sectie ───────────────────────────────────── */}
      {showScreening && screeningSection && (
        <div className="rounded-xl border border-[#68b0a6]/30 bg-[#252732] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">📋 Pre-screening — vragen doorlopen tijdens gesprek</h2>
            <span className="rounded-full bg-[#68b0a6]/10 px-2 py-0.5 text-[10px] font-medium text-[#68b0a6]">
              Script
            </span>
          </div>
          {screeningSection}
        </div>
      )}

      {/* ── Uitkomst sectie ────────────────────────────────────────── */}
      {showOutcome && (
        <div className="rounded-xl border border-[#f7a247]/20 bg-[#252732] p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-white">Uitkomst pre-screening</p>
            <p className="text-xs text-[#9ca3af] mt-0.5">Loop de pre-screening vragen hierboven door en geef het resultaat aan.</p>
          </div>

          {!showAppointmentForm && !confirmReject && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setConfirmReject(true)}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                👎 Geen interesse
              </button>
              <button
                onClick={() => setShowAppointmentForm(true)}
                className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] transition-colors"
              >
                👍 Interessant — Sollicitatiegesprek plannen
              </button>
            </div>
          )}

          {/* Rejection confirm */}
          {confirmReject && (
            <div className="rounded-lg border border-red-500/30 bg-[#1e2028] p-4 space-y-3">
              <p className="text-sm text-white font-medium">Kandidaat afwijzen?</p>
              <p className="text-xs text-[#9ca3af]">Status wordt bijgewerkt naar Afgewezen. Dit kan niet ongedaan worden gemaakt.</p>
              <div className="flex gap-3">
                <button
                  onClick={rejectCandidate}
                  disabled={rejecting}
                  className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                >
                  {rejecting ? 'Afwijzen...' : 'Ja, afwijzen'}
                </button>
                <button
                  onClick={() => setConfirmReject(false)}
                  className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}

          {/* Appointment booking form */}
          {showAppointmentForm && (
            <form onSubmit={bookAppointment} className="rounded-lg border border-[#68b0a6]/20 bg-[#1e2028] p-4 space-y-4">
              <p className="text-sm font-semibold text-white">📅 Sollicitatiegesprek inplannen</p>
              <p className="text-xs text-[#9ca3af]">
                Na bevestigen ontvangt <strong className="text-white">{candidateName}</strong> een SMS en e-mail bevestiging.
                Status wordt bijgewerkt naar Sollicitatiegesprek.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Datum *</label>
                  <input
                    type="date"
                    required
                    min={today}
                    value={appointmentDate}
                    onChange={e => setAppointmentDate(e.target.value)}
                    className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Tijd *</label>
                  <input
                    type="time"
                    required
                    value={appointmentTime}
                    onChange={e => setAppointmentTime(e.target.value)}
                    className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Locatie</label>
                  <input
                    type="text"
                    value={appointmentLocation}
                    onChange={e => setAppointmentLocation(e.target.value)}
                    placeholder="Kantoor Zwaluw, Oss"
                    className="w-full rounded-lg border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
                  />
                </div>
              </div>

              {bookingError && (
                <p className="text-xs text-red-400">{bookingError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={booking || !appointmentDate}
                  className="rounded-lg bg-[#68b0a6] px-5 py-2 text-sm font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
                >
                  {booking ? 'Bevestigen...' : '✓ Bevestig afspraak & verstuur SMS'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAppointmentForm(false)}
                  className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Interview checklist sectie ────────────────────────────── */}
      {showChecklist && checklistSection && (
        <div className="rounded-xl border border-purple-500/30 bg-[#252732] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">✅ Sollicitatiegesprek checklist</h2>
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
              Checklist
            </span>
          </div>
          {checklistSection}
        </div>
      )}
    </div>
  );
}
