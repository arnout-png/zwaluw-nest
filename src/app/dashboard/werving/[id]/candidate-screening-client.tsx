'use client';

import { useState } from 'react';
import type { ScreeningScript, ScreeningAnswer } from '@/types';

interface Props {
  candidateId: string;
  script: ScreeningScript;
  initialAnswers: ScreeningAnswer[];
}

export function CandidateScreeningClient({ candidateId, script, initialAnswers }: Props) {
  // Map questionId → answer text
  const buildAnswerMap = (answers: ScreeningAnswer[]) =>
    Object.fromEntries(answers.map(a => [a.questionId, a.answer]));

  const [values, setValues] = useState<Record<string, string>>(buildAnswerMap(initialAnswers));
  const [savedAnswers, setSavedAnswers] = useState<ScreeningAnswer[]>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const questions = script.questions ?? [];

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

  // Lookup saved answer metadata
  const savedMap = Object.fromEntries(savedAnswers.map(a => [a.questionId, a]));

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {questions.map(q => {
          const saved = savedMap[q.id];
          return (
            <div key={q.id}>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1">
                {q.question}
                {q.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <textarea
                value={values[q.id] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder={q.placeholder ?? ''}
                rows={2}
                className="w-full rounded-md border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-[#e8e9ed] placeholder-[#4a4d60] focus:border-[#68b0a6] focus:outline-none resize-none"
              />
              {saved && (
                <p className="mt-0.5 text-[10px] text-[#9ca3af]">
                  Ingevuld door {saved.answeredBy?.name ?? 'onbekend'} op{' '}
                  {new Date(saved.updatedAt).toLocaleDateString('nl-NL', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-40 transition-colors"
        >
          {saving ? 'Opslaan…' : 'Antwoorden opslaan'}
        </button>
        {saved && <span className="text-xs text-[#68b0a6]">✓ Opgeslagen</span>}
      </div>
    </form>
  );
}
