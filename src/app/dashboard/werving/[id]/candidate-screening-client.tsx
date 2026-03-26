'use client';

import { useState } from 'react';
import type { ScreeningScript, ScreeningAnswer } from '@/types';

interface Props {
  candidateId: string;
  script: ScreeningScript;
  initialAnswers: ScreeningAnswer[];
}

export function CandidateScreeningClient({ candidateId, script, initialAnswers }: Props) {
  const buildAnswerMap = (answers: ScreeningAnswer[]) =>
    Object.fromEntries(answers.map(a => [a.questionId, a.answer]));

  const [values, setValues] = useState<Record<string, string>>(buildAnswerMap(initialAnswers));
  const [savedAnswers, setSavedAnswers] = useState<ScreeningAnswer[]>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const questions = script.questions ?? [];
  const answeredCount = questions.filter(q => values[q.id]?.trim()).length;
  const requiredCount = questions.filter(q => q.required).length;
  const answeredRequired = questions.filter(q => q.required && values[q.id]?.trim()).length;
  const allRequiredAnswered = answeredRequired === requiredCount;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const answers = questions
        .filter(q => values[q.id]?.trim())
        .map(q => ({ questionId: q.id, answer: values[q.id].trim() }));

      const res = await fetch(`/api/candidates/${candidateId}/screening-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Fout bij opslaan.'); return; }
      setSavedAnswers(json.data ?? []);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Kan geen verbinding maken.');
    } finally {
      setSaving(false);
    }
  }

  const savedMap = Object.fromEntries(savedAnswers.map(a => [a.questionId, a]));

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-[#363848] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#68b0a6] transition-all duration-300"
            style={{ width: questions.length ? `${(answeredCount / questions.length) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-xs text-[#9ca3af] shrink-0 tabular-nums">
          {answeredCount} / {questions.length} beantwoord
        </span>
      </div>

      {/* Question cards */}
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const isSaved = !!savedMap[q.id];
          const hasValue = !!values[q.id]?.trim();

          return (
            <div
              key={q.id}
              className={`rounded-lg border p-4 transition-colors ${
                hasValue
                  ? 'border-[#68b0a6]/30 bg-[#1e2028]'
                  : 'border-[#363848] bg-[#1e2028]'
              }`}
            >
              {/* Question header */}
              <div className="flex items-start gap-3 mb-3">
                <span className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  hasValue ? 'bg-[#68b0a6] text-white' : 'bg-[#363848] text-[#9ca3af]'
                }`}>
                  {hasValue ? '✓' : idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white leading-snug">
                    {q.question}
                    {q.required && <span className="ml-1 text-red-400 text-xs">*</span>}
                  </p>
                  {q.placeholder && !hasValue && (
                    <p className="text-xs text-[#9ca3af] mt-0.5 italic">{q.placeholder}</p>
                  )}
                </div>
              </div>

              {/* Answer field */}
              <div className="pl-9">
                <textarea
                  value={values[q.id] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Aantekening / antwoord tijdens gesprek…"
                  rows={2}
                  className="w-full rounded-md border border-[#363848] bg-[#252732] px-3 py-2 text-sm text-[#e8e9ed] placeholder-[#4a4d60] focus:border-[#68b0a6] focus:outline-none resize-none"
                />
                {isSaved && savedMap[q.id] && (
                  <p className="mt-0.5 text-[10px] text-[#9ca3af]">
                    Opgeslagen door {savedMap[q.id].answeredBy?.name ?? 'onbekend'} op{' '}
                    {new Date(savedMap[q.id].updatedAt).toLocaleDateString('nl-NL', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Save button */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || answeredCount === 0}
          className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-40 transition-colors"
        >
          {saving ? 'Opslaan…' : 'Antwoorden opslaan'}
        </button>
        {saved && <span className="text-xs text-[#68b0a6]">✓ Opgeslagen</span>}
        {!allRequiredAnswered && requiredCount > 0 && (
          <span className="text-xs text-[#f7a247]">
            {requiredCount - answeredRequired} verplichte vra{requiredCount - answeredRequired === 1 ? 'ag' : 'gen'} nog open
          </span>
        )}
      </div>
    </form>
  );
}
