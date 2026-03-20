'use client';

import Link from 'next/link';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Candidate, CandidateStatus } from '@/types';

interface CandidateCardProps {
  candidate: Candidate;
  onMove: (id: string, newStatus: CandidateStatus) => void;
  /** When true, renders as a floating overlay copy (no drag re-init, no link) */
  overlay?: boolean;
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

const LEAD_SOURCE_LABEL: Record<string, string> = {
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  REFERRAL: 'Referral',
  MANUAL: 'Handmatig',
  GOOGLE: 'Google',
  OTHER: 'Overig',
};

const LEAD_SOURCE_COLOR: Record<string, string> = {
  FACEBOOK: 'bg-blue-500/10 text-blue-400',
  LINKEDIN: 'bg-sky-500/10 text-sky-400',
  INDEED: 'bg-purple-500/10 text-purple-400',
  REFERRAL: 'bg-green-500/10 text-green-400',
  MANUAL: 'bg-[#363848] text-[#9ca3af]',
  GOOGLE: 'bg-red-500/10 text-red-400',
  OTHER: 'bg-[#363848] text-[#9ca3af]',
};

function consentDaysLeft(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const expires = new Date(expiresAt);
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((expires.getTime() - today.getTime()) / (1000*60*60*24));
}

export function CandidateCard({ candidate, onMove, overlay = false }: CandidateCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
    data: { candidate },
    disabled: overlay,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const nextStatus = NEXT_STATUS[candidate.status];
  const nextLabel = NEXT_LABEL[candidate.status];
  const daysLeft = consentDaysLeft(candidate.consentExpiresAt);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`rounded-lg border border-[#363848] bg-[#1e2028] p-3 space-y-2 transition-opacity ${
        isDragging ? 'opacity-40' : 'opacity-100'
      } ${overlay ? 'shadow-2xl rotate-1 cursor-grabbing' : ''}`}
    >
      {/* Drag handle + Name + consent badge */}
      <div className="flex items-start gap-2">
        {/* Drag handle — spread listeners + attributes here */}
        <button
          type="button"
          {...(overlay ? {} : listeners)}
          {...(overlay ? {} : attributes)}
          className={`mt-0.5 shrink-0 rounded text-[#4a4d60] hover:text-[#9ca3af] transition-colors focus:outline-none ${
            overlay ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'
          }`}
          tabIndex={overlay ? -1 : 0}
          aria-label="Versleep kandidaat"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
          </svg>
        </button>

        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          {overlay ? (
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {candidate.firstName} {candidate.lastName}
              </div>
              <div className="text-xs text-[#9ca3af] truncate">{candidate.email}</div>
            </div>
          ) : (
            <Link href={`/dashboard/werving/${candidate.id}`} className="min-w-0 group">
              <div className="text-sm font-medium text-white truncate group-hover:text-[#68b0a6] transition-colors">
                {candidate.firstName} {candidate.lastName}
              </div>
              <div className="text-xs text-[#9ca3af] truncate">{candidate.email}</div>
            </Link>
          )}

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
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-[#9ca3af]">
        {candidate.salaryExpectation && (
          <span>€{candidate.salaryExpectation}</span>
        )}
        <span>{new Date(candidate.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
        {candidate.leadSource && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            LEAD_SOURCE_COLOR[candidate.leadSource] ?? 'bg-[#363848] text-[#9ca3af]'
          }`}>
            {LEAD_SOURCE_LABEL[candidate.leadSource] ?? candidate.leadSource}
          </span>
        )}
      </div>

      {/* Assignee chip */}
      {candidate.assignedTo && (
        <div className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#363848] text-[9px] font-bold text-[#68b0a6] shrink-0">
            {candidate.assignedTo.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </span>
          <span className="truncate">{candidate.assignedTo.name}</span>
        </div>
      )}

      {/* Move button — hidden in overlay */}
      {!overlay && nextStatus && nextLabel && (
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
