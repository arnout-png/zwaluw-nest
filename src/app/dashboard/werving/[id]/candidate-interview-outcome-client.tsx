'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  candidateId: string;
  initialOutcome?: string | null;
  initialOutcomeAt?: string | null;
}

export function CandidateInterviewOutcomeClient({ candidateId, initialOutcome, initialOutcomeAt }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!initialOutcome);
  const [outcome, setOutcome] = useState(initialOutcome ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!outcome.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewOutcome: outcome.trim(),
          interviewOutcomeAt: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Opslaan mislukt.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Verbinding mislukt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Gespreksuitkomst</h2>
        {!editing && initialOutcome && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-[#9ca3af] hover:text-white transition"
          >
            Bewerken
          </button>
        )}
      </div>

      {!editing && initialOutcome ? (
        <div className="space-y-1">
          <p className="text-sm text-[#e8e9ed] whitespace-pre-wrap">{initialOutcome}</p>
          {initialOutcomeAt && (
            <p className="text-xs text-[#9ca3af]">
              Vastgelegd op{' '}
              {new Date(initialOutcomeAt).toLocaleDateString('nl-NL', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#9ca3af]">
            Leg de uitkomst en observaties van het gesprek vast. Dit kan direct na het gesprek of later.
          </p>
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={4}
            placeholder="Bijv. kandidaat maakte een sterke indruk, goede technische kennis, beschikbaar per 1 april..."
            className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none resize-y"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !outcome.trim()}
              className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Opslaan…' : 'Uitkomst opslaan'}
            </button>
            {initialOutcome && (
              <button
                onClick={() => { setEditing(false); setOutcome(initialOutcome); }}
                className="rounded-lg border border-[#363848] px-4 py-2 text-xs text-[#9ca3af] hover:text-white transition"
              >
                Annuleren
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
