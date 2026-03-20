'use client';

import type { Candidate, CandidateStatus } from '@/types';

interface CandidateCardProps {
  candidate: Candidate;
  onMove: (id: string, newStatus: CandidateStatus) => void;
}

const NEXT_STATUS: Partial<Record<CandidateStatus, CandidateStatus>> = {
  NEW_LEAD: 'PRE_SCREENING',
  PRE_SCREENING: 'INTERVIEW',
  SCREENING_DONE: 'INTERVIEW',
  INTERVIEW: 'RESERVE_BANK',
  RESERVE_BANK: 'HIRED',
};

const NEXT_LABEL: Partial<Record<CandidateStatus, string>> = {
  NEW_LEAD: 'Pre-screening →',
  PRE_SCREENING: 'Interview →',
  SCREENING_DONE: 'Interview →',
  INTERVIEW: 'Reserve bank →',
  RESERVE_BANK: 'Aangenomen →',
};

function consentDaysLeft(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const expires = new Date(expiresAt);
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((expires.getTime() - today.getTime()) / (1000*60*60*24));
}

export function CandidateCard({ candidate, onMove }: CandidateCardProps) {
  const nextStatus = NEXT_STATUS[candidate.status];
  const nextLabel = NEXT_LABEL[candidate.status];
  const daysLeft = consentDaysLeft(candidate.consentExpiresAt);

  return (
    <div className="rounded-lg border border-[#363848] bg-[#1e2028] p-3 space-y-2">
      {/* Name + consent badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {candidate.firstName} {candidate.lastName}
          </div>
          <div className="text-xs text-[#9ca3af] truncate">{candidate.email}</div>
        </div>
        {daysLeft !== null && (
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            daysLeft <= 30 ? 'bg-red-500/10 text-red-400' :
            daysLeft <= 90 ? 'bg-[#f7a247]/10 text-[#f7a247]' :
            'bg-[#68b0a6]/10 text-[#68b0a6]'
          }`}>
            AVG {daysLeft}d
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-[#9ca3af]">
        {candidate.salaryExpectation && (
          <span>€{candidate.salaryExpectation}</span>
        )}
        <span>{new Date(candidate.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
      </div>

      {/* Move button */}
      {nextStatus && nextLabel && (
        <button
          onClick={() => onMove(candidate.id, nextStatus)}
          className="w-full rounded-md bg-[#252732] px-2 py-1.5 text-xs font-medium text-[#68b0a6] hover:bg-[#68b0a6]/10 transition-colors text-left"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
