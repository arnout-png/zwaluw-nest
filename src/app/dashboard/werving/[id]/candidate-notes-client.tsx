'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CandidateNote } from '@/types';

interface UserOption {
  id: string;
  name: string;
}

interface Props {
  candidateId: string;
  initialNotes: CandidateNote[];
}

/** Highlight @mentions in note content */
function renderNoteContent(content: string) {
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-medium text-[#68b0a6]">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function CandidateNotesClient({ candidateId, initialNotes }: Props) {
  const [notes, setNotes] = useState<CandidateNote[]>(initialNotes);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // @mention state
  const [mentionedUsers, setMentionedUsers] = useState<UserOption[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadUsers = useCallback(async () => {
    if (allUsers.length > 0) return;
    const res = await fetch('/api/employees/list');
    if (res.ok) {
      const json = await res.json();
      setAllUsers(json.data ?? []);
    }
  }, [allUsers.length]);

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? 0;
    setContent(val);
    setCursorPos(pos);

    // Detect @-trigger: find the last @ before cursor with no space after it
    const textBeforeCursor = val.slice(0, pos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setPickerFilter(atMatch[1].toLowerCase());
      setShowPicker(true);
      loadUsers();
    } else {
      setShowPicker(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showPicker && e.key === 'Escape') {
      setShowPicker(false);
    }
  }

  function selectMention(user: UserOption) {
    // Replace the partial @text with the full @FirstName
    const firstName = user.name.split(' ')[0];
    const textBeforeCursor = content.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const before = content.slice(0, atIndex);
    const after = content.slice(cursorPos);
    const newContent = `${before}@${firstName} ${after}`;
    setContent(newContent);
    setShowPicker(false);

    // Add to mentioned users (avoid duplication)
    setMentionedUsers(prev =>
      prev.find(u => u.id === user.id) ? prev : [...prev, user]
    );

    // Restore focus
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + firstName.length + 2; // +2 for @+space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  const filteredUsers = allUsers.filter(
    u => u.name.toLowerCase().includes(pickerFilter) &&
         !mentionedUsers.find(m => m.id === u.id)
  );

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-mention-picker]')) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          mentionedUserIds: mentionedUsers.map(u => u.id),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Fout bij opslaan notitie.');
        return;
      }
      setNotes((prev) => [json.data, ...prev]);
      setContent('');
      setMentionedUsers([]);
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
        <div className="relative" data-mention-picker>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Schrijf een notitie… Typ @ om een collega te taggen"
            rows={3}
            className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none resize-none"
          />

          {/* @Mention picker dropdown */}
          {showPicker && filteredUsers.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-[#363848] bg-[#252732] shadow-xl overflow-hidden">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wide border-b border-[#363848]">
                Medewerker taggen
              </div>
              <ul className="max-h-40 overflow-y-auto">
                {filteredUsers.slice(0, 8).map(u => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); selectMention(u); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#e8e9ed] hover:bg-[#363848] transition-colors"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#363848] text-[9px] font-bold text-[#68b0a6]">
                        {u.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      {u.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tagged chips */}
        {mentionedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mentionedUsers.map(u => (
              <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-[#68b0a6]/10 px-2 py-0.5 text-[11px] text-[#68b0a6]">
                @{u.name.split(' ')[0]}
                <button
                  type="button"
                  onClick={() => setMentionedUsers(prev => prev.filter(m => m.id !== u.id))}
                  className="ml-0.5 hover:text-white"
                  aria-label={`Verwijder tag ${u.name}`}
                >×</button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
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
              <p className="text-sm text-[#e8e9ed] whitespace-pre-wrap">
                {renderNoteContent(note.content)}
              </p>
              {note.mentions && note.mentions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.mentions.map(m => (
                    <span key={m.id} className="rounded-full bg-[#68b0a6]/10 px-1.5 py-0.5 text-[10px] text-[#68b0a6]">
                      @{m.user?.name ?? 'Onbekend'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
