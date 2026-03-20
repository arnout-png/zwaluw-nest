'use client';

import { useState } from 'react';
import type { InterviewChecklist, InterviewChecklistResult } from '@/types';

interface Props {
  candidateId: string;
  checklist: InterviewChecklist;
  initialResults: InterviewChecklistResult[];
}

export function CandidateChecklistClient({ candidateId, checklist, initialResults }: Props) {
  const buildResultMap = (results: InterviewChecklistResult[]) =>
    Object.fromEntries(results.map(r => [r.itemId, r]));

  const [results, setResults] = useState<Record<string, InterviewChecklistResult>>(
    buildResultMap(initialResults)
  );
  const [toggling, setToggling] = useState<string | null>(null);

  const items = checklist.items ?? [];
  const checkedCount = Object.values(results).filter(r => r.checked).length;

  async function handleToggle(itemId: string) {
    const current = results[itemId]?.checked ?? false;
    const newChecked = !current;

    // Optimistic update
    setResults(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { id: '', itemId, candidateId }), checked: newChecked },
    }));
    setToggling(itemId);

    try {
      const res = await fetch(`/api/candidates/${candidateId}/checklist-results`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, checked: newChecked }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setResults(prev => ({ ...prev, [itemId]: json.data }));
      } else {
        // Revert on error
        setResults(prev => ({
          ...prev,
          [itemId]: { ...(prev[itemId] ?? { id: '', itemId, candidateId }), checked: current },
        }));
      }
    } catch {
      setResults(prev => ({
        ...prev,
        [itemId]: { ...(prev[itemId] ?? { id: '', itemId, candidateId }), checked: current },
      }));
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-[#363848] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#68b0a6] transition-all"
            style={{ width: items.length ? `${(checkedCount / items.length) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-xs text-[#9ca3af] shrink-0">
          {checkedCount} / {items.length} afgevinkt
        </span>
      </div>

      {/* Checklist items */}
      <ul className="space-y-2">
        {items.map(item => {
          const result = results[item.id];
          const isChecked = result?.checked ?? false;
          const isToggling = toggling === item.id;

          return (
            <li key={item.id} className="rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2.5">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => handleToggle(item.id)}
                  disabled={isToggling}
                  aria-label={isChecked ? 'Vink af' : 'Afvinken'}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors focus:outline-none ${
                    isChecked
                      ? 'border-[#68b0a6] bg-[#68b0a6]'
                      : 'border-[#4a4d60] bg-transparent hover:border-[#68b0a6]'
                  } ${isToggling ? 'opacity-50' : ''}`}
                >
                  {isChecked && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isChecked ? 'line-through text-[#9ca3af]' : 'text-[#e8e9ed]'}`}>
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="text-xs text-[#9ca3af] mt-0.5">{item.description}</p>
                  )}
                  {isChecked && result?.checkedBy && (
                    <p className="text-[10px] text-[#9ca3af] mt-0.5">
                      Afgevinkt door {result.checkedBy.name}
                      {result.checkedAt && (
                        <> op {new Date(result.checkedAt).toLocaleDateString('nl-NL', {
                          day: 'numeric', month: 'short',
                        })}</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
