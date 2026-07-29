'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CandidateDeleteClient({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/candidates/${candidateId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/dashboard/werving');
      router.refresh();
    } else {
      setLoading(false);
      setConfirming(false);
      alert('Verwijderen mislukt. Probeer opnieuw.');
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#9ca3af]">Verplaats <strong className="text-white">{candidateName}</strong> naar prullenbak?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
        >
          {loading ? 'Bezig…' : 'Ja, verwijder'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-lg bg-[#363848] px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:text-white transition-colors"
        >
          Annuleer
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#252732] border border-[#363848] px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:border-red-500/40 hover:text-red-400 transition-colors"
      title="Verplaats naar prullenbak"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Prullenbak
    </button>
  );
}
