'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserWithPhone } from './page';
import type { Role } from '@/types';

const ROLES: Role[] = ['ADMIN', 'PLANNER', 'ADVISEUR', 'MONTEUR', 'CALLCENTER', 'BACKOFFICE', 'WAREHOUSE'];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  PLANNER: 'Planner',
  ADVISEUR: 'Adviseur',
  MONTEUR: 'Monteur',
  CALLCENTER: 'Callcenter',
  BACKOFFICE: 'Backoffice',
  WAREHOUSE: 'Magazijn',
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-purple-500/10 text-purple-400',
  PLANNER: 'bg-blue-500/10 text-blue-400',
  ADVISEUR: 'bg-[#68b0a6]/10 text-[#68b0a6]',
  MONTEUR: 'bg-[#f7a247]/10 text-[#f7a247]',
  CALLCENTER: 'bg-pink-500/10 text-pink-400',
  BACKOFFICE: 'bg-indigo-500/10 text-indigo-400',
  WAREHOUSE: 'bg-yellow-500/10 text-yellow-400',
};

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  phonePersonal: string;
}

interface Props {
  initialUsers: UserWithPhone[];
}

export function GebruikersClient({ initialUsers }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithPhone[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserWithPhone & { phonePersonal: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<NewUserForm>({
    name: '', email: '', password: '', role: 'PLANNER', phonePersonal: '',
  });
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = users.filter(u => {
    const matchesSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  function startEdit(u: UserWithPhone) {
    setEditingId(u.id);
    setEditForm({ name: u.name, role: u.role as Role, isActive: u.isActive, phonePersonal: u.phonePersonal ?? '' });
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setError('');
  }

  async function saveEdit(id: string) {
    setSaving(id);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Opslaan mislukt.');
        return;
      }
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...json.data, phonePersonal: editForm.phonePersonal ?? u.phonePersonal } : u));
      setEditingId(null);
      setEditForm({});
      router.refresh();
    } catch {
      setError('Verbinding mislukt.');
    } finally {
      setSaving(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          role: createForm.role,
          phonePersonal: createForm.phonePersonal.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Aanmaken mislukt.');
        return;
      }
      const newUser: UserWithPhone = {
        ...json.data,
        phonePersonal: createForm.phonePersonal.trim() || null,
      };
      setUsers(prev => [newUser, ...prev]);
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', role: 'PLANNER', phonePersonal: '' });
      router.refresh();
    } catch {
      setError('Verbinding mislukt.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Verwijderen mislukt.');
        setConfirmDeleteId(null);
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== id));
      setConfirmDeleteId(null);
      setEditingId(null);
      router.refresh();
    } catch {
      setError('Verbinding mislukt.');
    } finally {
      setDeletingId(null);
    }
  }

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Gebruikers</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">{users.length} gebruikers · portaltogang en rollen beheren</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setError(''); }}
          className="flex items-center gap-2 rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Gebruiker toevoegen</span>
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Nieuwe gebruiker toevoegen</h2>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: 'name', label: 'Naam', required: true },
              { key: 'email', label: 'E-mailadres', required: true, type: 'email' },
              { key: 'password', label: 'Wachtwoord', required: true, type: 'password' },
              { key: 'phonePersonal', label: 'Telefoonnummer', required: false, type: 'tel' },
            ].map(({ key, label, required, type }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-[#9ca3af]">{label}</label>
                <input
                  type={type ?? 'text'}
                  required={required}
                  value={createForm[key as keyof NewUserForm]}
                  onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Rol</label>
              <select
                value={createForm.role}
                onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
              >
                {creating ? 'Aanmaken...' : 'Gebruiker aanmaken'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setError(''); }}
                className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + role filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Zoek op naam of e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#363848] bg-[#252732] pl-9 pr-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRoleFilter('ALL')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${roleFilter === 'ALL' ? 'bg-[#68b0a6] text-white' : 'border border-[#363848] text-[#9ca3af] hover:text-white'}`}
          >
            Alle rollen
          </button>
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r === roleFilter ? 'ALL' : r)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${roleFilter === r ? 'bg-[#68b0a6] text-white' : 'border border-[#363848] text-[#9ca3af] hover:text-white'}`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Global error (edit) */}
      {error && editingId && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* User list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-8 text-center text-sm text-[#9ca3af]">
            Geen gebruikers gevonden.
          </div>
        )}
        {filtered.map(u => (
          <div key={u.id} className="rounded-xl border border-[#363848] bg-[#252732]">
            {/* User row */}
            <div className="flex items-center gap-3 p-4">
              {/* Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#68b0a6]/20 text-xs font-bold text-[#68b0a6]">
                {initials(u.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{u.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[u.role as Role] ?? 'bg-[#363848] text-[#9ca3af]'}`}>
                    {ROLE_LABELS[u.role as Role] ?? u.role}
                  </span>
                  {!u.isActive && (
                    <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Inactief</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs text-[#9ca3af] truncate">{u.email}</span>
                  {u.phonePersonal && (
                    <span className="text-xs text-[#9ca3af]">{u.phonePersonal}</span>
                  )}
                </div>
              </div>

              {/* Edit button */}
              <button
                onClick={() => editingId === u.id ? cancelEdit() : startEdit(u)}
                className="shrink-0 text-xs text-[#9ca3af] hover:text-white transition-colors"
              >
                {editingId === u.id ? 'Annuleren' : 'Bewerken'}
              </button>
            </div>

            {/* Inline edit form */}
            {editingId === u.id && (
              <div className="border-t border-[#363848] px-4 pb-4 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Naam</label>
                    <input
                      type="text"
                      value={editForm.name ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Rol</label>
                    <select
                      value={editForm.role as string ?? u.role}
                      onChange={e => setEditForm(f => ({ ...f, role: e.target.value as Role }))}
                      className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Telefoonnummer</label>
                    <input
                      type="tel"
                      value={editForm.phonePersonal ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, phonePersonal: e.target.value }))}
                      placeholder="+31 6 12345678"
                      className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#9ca3af]">Status</label>
                    <select
                      value={editForm.isActive ? 'active' : 'inactive'}
                      onChange={e => setEditForm(f => ({ ...f, isActive: e.target.value === 'active' }))}
                      className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                    >
                      <option value="active">Actief</option>
                      <option value="inactive">Inactief</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => saveEdit(u.id)}
                    disabled={saving === u.id}
                    className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
                  >
                    {saving === u.id ? 'Opslaan...' : 'Opslaan'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-lg border border-[#363848] px-4 py-2 text-xs text-[#9ca3af] hover:text-white transition-colors"
                  >
                    Annuleren
                  </button>
                  <div className="flex-1" />
                  {confirmDeleteId === u.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400">Zeker weten?</span>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
                        className="rounded-lg bg-red-500/20 border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                      >
                        {deletingId === u.id ? 'Verwijderen...' : 'Ja, verwijder'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white transition-colors"
                      >
                        Nee
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(u.id)}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400/70 hover:text-red-400 hover:border-red-500/60 transition-colors"
                    >
                      Verwijderen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
