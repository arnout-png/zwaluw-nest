'use client';

import { useState } from 'react';
import type { CandidateNote } from '@/types';

interface Props {
  candidateId: string;
  initialNotes: CandidateNote[];
}

export function CandidateNotesClient({ candidateId, initialNotes }: Props) {
  const [notes, setNotes] = useState<CandidateNote[]>(initialNotes);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Fout bij opslaan notitie.');
        return;
      }
      setNotes((prev) => [json.data, ...prev]);
      setContent('');
    } catch {
      setError('Kan geen verbinding maken met de server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Schrijf een notitie over deze kandidaat..."
          rows={3}
          className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none resize-none"
        />
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-40 transition-colors"
        >
          {saving ? 'Opslaan...' : 'Notitie toevoegen'}
        </button>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-sm text-[#9ca3af] py-4 text-center">Nog geen notities.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-[#1e2028] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#68b0a6]">
                  {note.author?.name ?? 'Onbekend'}
                </span>
                <span className="text-xs text-[#9ca3af]">
                  {new Date(note.createdAt).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-[#e8e9ed] whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
