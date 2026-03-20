'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface CandidateAssignClientProps {
  candidateId: string;
  assignedTo?: { id: string; name: string } | null;
}

export function CandidateAssignClient({ candidateId, assignedTo }: CandidateAssignClientProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>(assignedTo?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/employees/list');
    if (res.ok) {
      const json = await res.json();
      setUsers(json.data ?? []);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleChange = async (userId: string) => {
    setSelectedId(userId);
    setSaving(true);
    setSaved(false);

    await fetch(`/api/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToId: userId || null }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const selectedUser = users.find(u => u.id === selectedId);

  return (
    <div className="flex items-center gap-3">
      {selectedUser && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#363848] text-[10px] font-bold text-[#68b0a6]">
          {selectedUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <select
          value={selectedId}
          onChange={e => handleChange(e.target.value)}
          disabled={saving || users.length === 0}
          className="w-full rounded-md border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none disabled:opacity-50"
        >
          <option value="">— Niet toegewezen —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      {saving && <span className="text-xs text-[#9ca3af]">Opslaan…</span>}
      {saved && <span className="text-xs text-[#68b0a6]">✓ Opgeslagen</span>}
    </div>
  );
}
