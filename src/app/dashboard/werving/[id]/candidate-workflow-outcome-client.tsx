'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CandidateStatus } from '@/types';

interface Props {
  candidateId: string;
  candidateStatus: CandidateStatus;
  candidateName: string;
}

export function CandidateWorkflowOutcomeClient({ candidateId, candidateStatus, candidateName }: Props) {
  const router = useRouter();

  // Prescreening phase state
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState('Kantoor Zwaluw, Oss');
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [bookingError, setBookingError] = useState('');
  const [rejectStatus, setRejectStatus] = useState<'idle' | 'saving'>('idle');
  const [rejectError, setRejectError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [sendRejectEmail, setSendRejectEmail] = useState(true);

  // Post-interview phase state
  const [interviewOutcome, setInterviewOutcome] = useState<'HIRED' | 'RESERVE_BANK' | null>(null);
  const [showInterviewReject, setShowInterviewReject] = useState(false);
  const [outcomeStatus, setOutcomeStatus] = useState<'idle' | 'saving'>('idle');
  const [outcomeError, setOutcomeError] = useState('');

  const isPreScreening = ['PRE_SCREENING', 'SCREENING_DONE'].includes(candidateStatus);
  const isInterview = candidateStatus === 'INTERVIEW';

  // ── Prescreening: book appointment ────────────────────────────────────────────
  async function handleBookAppointment(e: React.FormEvent) {
    e.preventDefault();
    setBookingError('');
    setBookingStatus('saving');
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
      const json = await res.json();
      if (!res.ok) {
        setBookingError(json.error ?? 'Opslaan mislukt.');
        setBookingStatus('error');
        return;
      }
      setBookingStatus('done');
      router.refresh();
    } catch {
      setBookingError('Verbinding mislukt.');
      setBookingStatus('error');
    }
  }

  // ── Prescreening: reject candidate ────────────────────────────────────────────
  async function handleRejectPreScreening() {
    setRejectError('');
    setRejectStatus('saving');
    try {
      const res = await fetch(`/api/candidates/${candidateId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || undefined, sendEmail: sendRejectEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRejectError(json.error ?? 'Opslaan mislukt.');
        setRejectStatus('idle');
        return;
      }
      router.refresh();
    } catch {
      setRejectError('Verbinding mislukt.');
      setRejectStatus('idle');
    }
  }

  // ── Post-interview: set outcome ────────────────────────────────────────────────
  async function handleInterviewOutcome(status: 'HIRED' | 'RESERVE_BANK') {
    setOutcomeError('');
    setOutcomeStatus('saving');
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOutcomeError(json.error ?? 'Opslaan mislukt.');
        setOutcomeStatus('idle');
        return;
      }
      router.refresh();
    } catch {
      setOutcomeError('Verbinding mislukt.');
      setOutcomeStatus('idle');
    }
  }

  async function handleInterviewReject() {
    setOutcomeError('');
    setOutcomeStatus('saving');
    try {
      const res = await fetch(`/api/candidates/${candidateId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || undefined, sendEmail: sendRejectEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOutcomeError(json.error ?? 'Opslaan mislukt.');
        setOutcomeStatus('idle');
        return;
      }
      router.refresh();
    } catch {
      setOutcomeError('Verbinding mislukt.');
      setOutcomeStatus('idle');
    }
  }

  // ── PRE_SCREENING / SCREENING_DONE ─────────────────────────────────────────────
  if (isPreScreening) {
    // Rejection confirmation
    if (showRejectConfirm) {
      return (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-lg">⚠️</span>
            <h3 className="text-sm font-semibold text-white">Kandidaat afwijzen</h3>
          </div>
          <p className="text-sm text-[#9ca3af]">
            Weet je zeker dat je <span className="text-white font-medium">{candidateName}</span> wil afwijzen?
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">
              Reden (optioneel)
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="bijv. 'Niet beschikbaar op korte termijn'"
              className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-red-400 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendRejectEmail}
              onChange={e => setSendRejectEmail(e.target.checked)}
              className="rounded border-[#363848] bg-[#1e2028] accent-[#68b0a6]"
            />
            <span className="text-sm text-[#9ca3af]">Stuur afwijzingsmail naar kandidaat</span>
          </label>
          {rejectError && <p className="text-xs text-red-400">{rejectError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleRejectPreScreening}
              disabled={rejectStatus === 'saving'}
              className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {rejectStatus === 'saving' ? 'Opslaan...' : 'Ja, afwijzen'}
            </button>
            <button
              onClick={() => setShowRejectConfirm(false)}
              className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      );
    }

    // Appointment form
    if (showAppointmentForm) {
      if (bookingStatus === 'done') {
        return (
          <div className="rounded-xl border border-[#68b0a6]/40 bg-[#68b0a6]/10 p-5 text-center space-y-2">
            <p className="text-2xl">✅</p>
            <p className="text-sm font-semibold text-[#68b0a6]">Afspraak bevestigd!</p>
            <p className="text-xs text-[#9ca3af]">
              {candidateName} is uitgenodigd voor een sollicitatiegesprek.
              De pagina ververst automatisch.
            </p>
          </div>
        );
      }

      return (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-lg">📅</span>
              <h3 className="text-sm font-semibold text-white">Sollicitatiegesprek plannen</h3>
            </div>
            <button
              onClick={() => setShowAppointmentForm(false)}
              className="text-[#9ca3af] hover:text-white text-xs transition-colors"
            >
              ← Terug
            </button>
          </div>
          <form onSubmit={handleBookAppointment} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">Datum *</label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={e => setAppointmentDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">Tijd *</label>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={e => setAppointmentTime(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">Locatie</label>
              <input
                type="text"
                value={appointmentLocation}
                onChange={e => setAppointmentLocation(e.target.value)}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
            <p className="text-xs text-[#9ca3af]">
              📧 Kandidaat ontvangt automatisch een uitnodigingsmail en SMS bevestiging.
            </p>
            {bookingError && <p className="text-xs text-red-400">{bookingError}</p>}
            <button
              type="submit"
              disabled={bookingStatus === 'saving'}
              className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-50 transition-colors"
            >
              {bookingStatus === 'saving' ? 'Bevestigen...' : '✅ Afspraak bevestigen & uitnodigen'}
            </button>
          </form>
        </div>
      );
    }

    // Default: outcome buttons
    return (
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Uitkomst pre-screening</h2>
        </div>
        <p className="text-xs text-[#9ca3af]">
          Loop de pre-screening vragen hierboven door en geef het resultaat aan.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={() => setShowRejectConfirm(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all"
          >
            <span>👎</span>
            Geen interesse — Afwijzen
          </button>
          <button
            onClick={() => setShowAppointmentForm(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm font-medium text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all"
          >
            <span>📅</span>
            Interessant — Afspraak plannen
          </button>
        </div>
      </div>
    );
  }

  // ── INTERVIEW ──────────────────────────────────────────────────────────────────
  if (isInterview) {
    // Reject confirmation
    if (showInterviewReject) {
      return (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-lg">⚠️</span>
            <h3 className="text-sm font-semibold text-white">Kandidaat afwijzen na gesprek</h3>
          </div>
          <p className="text-sm text-[#9ca3af]">
            Weet je zeker dat je <span className="text-white font-medium">{candidateName}</span> wil afwijzen?
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide">
              Reden (optioneel)
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="bijv. 'Niet voldoende ervaring'"
              className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-red-400 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendRejectEmail}
              onChange={e => setSendRejectEmail(e.target.checked)}
              className="rounded border-[#363848] bg-[#1e2028] accent-[#68b0a6]"
            />
            <span className="text-sm text-[#9ca3af]">Stuur afwijzingsmail naar kandidaat</span>
          </label>
          {outcomeError && <p className="text-xs text-red-400">{outcomeError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleInterviewReject}
              disabled={outcomeStatus === 'saving'}
              className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {outcomeStatus === 'saving' ? 'Opslaan...' : 'Ja, afwijzen'}
            </button>
            <button
              onClick={() => setShowInterviewReject(false)}
              className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      );
    }

    // Outcome confirmation for HIRED or RESERVE_BANK
    if (interviewOutcome) {
      const isHired = interviewOutcome === 'HIRED';
      return (
        <div className={`rounded-xl border p-5 space-y-4 ${isHired ? 'border-green-500/30 bg-green-500/5' : 'border-[#68b0a6]/30 bg-[#68b0a6]/5'}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{isHired ? '🎉' : '🏦'}</span>
            <h3 className="text-sm font-semibold text-white">
              {isHired ? 'Kandidaat aannemen' : 'Toevoegen aan reserve bank'}
            </h3>
          </div>
          <p className="text-sm text-[#9ca3af]">
            {isHired
              ? `Weet je zeker dat je ${candidateName} wil aannemen? Er wordt een medewerkersprofiel aangemaakt.`
              : `${candidateName} wordt toegevoegd aan de reserve bank — klaar om in te stromen wanneer er een opening is.`
            }
          </p>
          {outcomeError && <p className="text-xs text-red-400">{outcomeError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => handleInterviewOutcome(interviewOutcome)}
              disabled={outcomeStatus === 'saving'}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors ${
                isHired ? 'bg-green-500/80 hover:bg-green-500' : 'bg-[#68b0a6]/80 hover:bg-[#68b0a6]'
              }`}
            >
              {outcomeStatus === 'saving' ? 'Opslaan...' : 'Bevestigen'}
            </button>
            <button
              onClick={() => setInterviewOutcome(null)}
              className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      );
    }

    // Default: post-interview outcome buttons
    return (
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Uitkomst sollicitatiegesprek</h2>
        <p className="text-xs text-[#9ca3af]">
          Loop de checklist hierboven door en geef de uitkomst van het gesprek aan.
        </p>
        {outcomeError && <p className="text-xs text-red-400">{outcomeError}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            onClick={() => setInterviewOutcome('HIRED')}
            className="flex items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm font-medium text-green-400 hover:bg-green-500/10 hover:border-green-500/50 transition-all"
          >
            <span>🎉</span>
            Aangenomen
          </button>
          <button
            onClick={() => setInterviewOutcome('RESERVE_BANK')}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#68b0a6]/30 bg-[#68b0a6]/5 px-4 py-3 text-sm font-medium text-[#68b0a6] hover:bg-[#68b0a6]/10 hover:border-[#68b0a6]/50 transition-all"
          >
            <span>🏦</span>
            Reserve bank
          </button>
          <button
            onClick={() => setShowInterviewReject(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all"
          >
            <span>❌</span>
            Afwijzen
          </button>
        </div>
      </div>
    );
  }

  return null;
}
