'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CandidateStatus } from '@/types';

const ALL_STAGES: { value: CandidateStatus; label: string }[] = [
  { value: 'NEW_LEAD', label: 'Nieuw' },
  { value: 'PRE_SCREENING', label: 'Pre-screening' },
  { value: 'SCREENING_DONE', label: 'Screening klaar' },
  { value: 'INTERVIEW', label: 'Sollicitatiegesprek' },
  { value: 'RESERVE_BANK', label: 'Reserve Bank' },
  { value: 'HIRED', label: 'Aangenomen' },
  { value: 'REJECTED', label: 'Afgewezen' },
];

const REJECTION_REASONS = [
  { value: 'SALARY', label: 'Salarisverwachting te hoog' },
  { value: 'EXPERIENCE', label: 'Onvoldoende ervaring' },
  { value: 'CULTURE_FIT', label: 'Geen culturele match' },
  { value: 'AVAILABILITY', label: 'Beschikbaarheid niet passend' },
  { value: 'NO_RESPONSE', label: 'Kandidaat reageert niet' },
  { value: 'OTHER', label: 'Anders' },
];

interface Props {
  candidateId: string;
  currentStatus: CandidateStatus;
  candidateEmail?: string;
}

export function CandidateStageClient({ candidateId, currentStatus, candidateEmail }: Props) {
  const [status, setStatus] = useState<CandidateStatus>(currentStatus);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('OTHER');
  const [sendRejectionEmail, setSendRejectionEmail] = useState(!!candidateEmail);
  const [rejectSaving, setRejectSaving] = useState(false);

  async function handleChange(newStatus: CandidateStatus) {
    if (newStatus === status) return;
    if (newStatus === 'REJECTED') {
      setShowRejectModal(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmReject() {
    setRejectSaving(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason, sendEmail: sendRejectionEmail }),
      });
      if (res.ok) {
        setStatus('REJECTED');
        setShowRejectModal(false);
        router.refresh();
      }
    } finally {
      setRejectSaving(false);
    }
  }

  const activeIndex = ALL_STAGES.findIndex((s) => s.value === status);
  const visibleStages = ALL_STAGES.filter((s) => s.value !== 'REJECTED');

  return (
    <div className="space-y-4">
      {/* Stage stepper */}
      <div className="flex items-center gap-1 flex-wrap">
        {visibleStages.map((stage, i) => {
          const stageIndex = ALL_STAGES.findIndex((s) => s.value === stage.value);
          const isPast = stageIndex < activeIndex && status !== 'REJECTED';
          const isCurrent = stage.value === status;
          return (
            <div key={stage.value} className="flex items-center gap-1">
              <button
                onClick={() => handleChange(stage.value)}
                disabled={saving}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  isCurrent
                    ? 'bg-[#68b0a6] text-white'
                    : isPast
                    ? 'bg-[#68b0a6]/20 text-[#68b0a6] hover:bg-[#68b0a6]/30'
                    : 'bg-[#363848] text-[#9ca3af] hover:bg-[#42455a]'
                }`}
              >
                {stage.label}
              </button>
              {i < visibleStages.length - 1 && (
                <span className="text-[#363848] text-xs">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Status selector */}
      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => handleChange(e.target.value as CandidateStatus)}
          disabled={saving}
          className="rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none disabled:opacity-50"
        >
          {ALL_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {saving && <span className="text-xs text-[#9ca3af]">Opslaan...</span>}
      </div>

      {/* Rejection modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#363848] bg-[#252732] p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-white mb-1">Kandidaat afwijzen</h3>
            <p className="text-xs text-[#9ca3af] mb-5">
              Geef een reden op en geef aan of je de kandidaat per e-mail wil informeren.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Reden</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                >
                  {REJECTION_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {candidateEmail && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendRejectionEmail}
                    onChange={(e) => setSendRejectionEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-[#363848] bg-[#1e2028] accent-[#68b0a6]"
                  />
                  <div>
                    <p className="text-xs font-medium text-white">Stuur afwijzingsmail</p>
                    <p className="text-xs text-[#9ca3af]">{candidateEmail}</p>
                  </div>
                </label>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={confirmReject}
                  disabled={rejectSaving}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                >
                  {rejectSaving ? 'Opslaan...' : 'Afwijzen bevestigen'}
                </button>
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejectSaving}
                  className="flex-1 rounded-lg border border-[#363848] px-4 py-2.5 text-sm font-medium text-[#9ca3af] hover:bg-[#363848] transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
