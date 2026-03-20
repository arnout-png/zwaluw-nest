'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CandidateStatus } from '@/types';

const ALL_STAGES: { value: CandidateStatus; label: string }[] = [
  { value: 'NEW_LEAD', label: 'Nieuw' },
  { value: 'PRE_SCREENING', label: 'Pre-screening' },
  { value: 'SCREENING_DONE', label: 'Screening klaar' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'RESERVE_BANK', label: 'Reserve Bank' },
  { value: 'HIRED', label: 'Aangenomen' },
  { value: 'REJECTED', label: 'Afgewezen' },
];

interface Props {
  candidateId: string;
  currentStatus: CandidateStatus;
}

export function CandidateStageClient({ candidateId, currentStatus }: Props) {
  const [status, setStatus] = useState<CandidateStatus>(currentStatus);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange(newStatus: CandidateStatus) {
    if (newStatus === status) return;
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

  const activeIndex = ALL_STAGES.findIndex((s) => s.value === status);
  const visibleStages = ALL_STAGES.filter(
    (s) => s.value !== 'REJECTED'
  );

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

      {/* Reject button */}
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
    </div>
  );
}
