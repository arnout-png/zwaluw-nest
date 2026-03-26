'use client';

import { useState } from 'react';
import type { JobOpening, VacatureRol } from '@/types';
import { VACATURE_ROL_LABELS } from '@/types';
import { ImagePickerModal } from './image-picker';

const EMPTY: Partial<JobOpening> = {
  title: '',
  slug: '',
  description: '',
  requirements: '',
  location: '',
  hoursPerWeek: '',
  salaryRange: '',
  imageUrl: '',
  benefits: '',
  perks: '',
  impact: '',
  roleType: undefined,
  isActive: true,
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

interface Props {
  initialJobOpenings: JobOpening[];
}

export function VacaturesClient({ initialJobOpenings }: Props) {
  const [openings, setOpenings] = useState<JobOpening[]>(initialJobOpenings);
  const [editing, setEditing] = useState<Partial<JobOpening> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://zwaluw-portal.vercel.app';

  function openNew() {
    setEditing({ ...EMPTY });
    setIsNew(true);
    setError('');
  }

  function openEdit(job: JobOpening) {
    setEditing({ ...job });
    setIsNew(false);
    setError('');
  }

  function closeEditor() {
    setEditing(null);
    setError('');
  }

  async function save() {
    if (!editing) return;
    if (!editing.title || !editing.slug || !editing.description) {
      setError('Titel, slug en beschrijving zijn verplicht.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const res = await fetch('/api/admin/job-openings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Opslaan mislukt.'); return; }
        setOpenings((prev) => [json.data, ...prev]);
      } else {
        const res = await fetch(`/api/admin/job-openings/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Opslaan mislukt.'); return; }
        setOpenings((prev) => prev.map((o) => (o.id === json.data.id ? json.data : o)));
      }
      closeEditor();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(job: JobOpening) {
    const res = await fetch(`/api/admin/job-openings/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !job.isActive }),
    });
    if (res.ok) {
      const json = await res.json();
      setOpenings((prev) => prev.map((o) => (o.id === job.id ? json.data : o)));
    }
  }


  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Vacatures</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">Beheer openstaande vacatures voor het publieke sollicitatieformulier.</p>
        </div>
        <button
          onClick={openNew}
          className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7ec4ba] transition-colors"
        >
          + Nieuwe vacature
        </button>
      </div>

      {/* Job opening cards */}
      {openings.length === 0 ? (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-10 text-center">
          <p className="text-sm text-[#9ca3af]">Nog geen vacatures aangemaakt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {openings.map((job) => (
            <div key={job.id} className="rounded-xl border border-[#363848] bg-[#252732] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-white truncate">{job.title}</h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        job.isActive
                          ? 'bg-[#68b0a6]/10 text-[#68b0a6]'
                          : 'bg-[#9ca3af]/10 text-[#9ca3af]'
                      }`}
                    >
                      {job.isActive ? 'Actief' : 'Inactief'}
                    </span>
                    {job.roleType && (
                      <span className="inline-flex items-center rounded-full bg-[#363848] px-2 py-0.5 text-xs text-[#9ca3af]">
                        {VACATURE_ROL_LABELS[job.roleType]}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 flex-wrap">
                    {job.location && (
                      <span className="text-xs text-[#9ca3af]">{job.location}</span>
                    )}
                    {job.hoursPerWeek && (
                      <span className="text-xs text-[#9ca3af]">{job.hoursPerWeek}</span>
                    )}
                    {job.salaryRange && (
                      <span className="text-xs text-[#9ca3af]">{job.salaryRange}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(job)}
                    className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-white hover:bg-[#363848] transition-colors"
                  >
                    Bewerken
                  </button>
                  <button
                    onClick={() => toggleActive(job)}
                    className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:bg-[#363848] transition-colors"
                  >
                    {job.isActive ? 'Deactiveren' : 'Activeren'}
                  </button>
                </div>
              </div>

              {/* Public URL */}
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#1e2028] px-3 py-2">
                <span className="text-xs text-[#9ca3af] truncate flex-1">
                  {appUrl}/vacature/{job.slug}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(`${appUrl}/vacature/${job.slug}`)}
                  className="text-xs text-[#68b0a6] hover:text-white shrink-0 transition-colors"
                >
                  Kopieer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
          <div className="w-full max-w-2xl rounded-2xl border border-[#363848] bg-[#252732] p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-white mb-5">
              {isNew ? 'Nieuwe vacature' : 'Vacature bewerken'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Functietitel *</label>
                  <input
                    type="text"
                    value={editing.title ?? ''}
                    onChange={(e) => {
                      const title = e.target.value;
                      setEditing((prev) => ({
                        ...prev,
                        title,
                        ...(isNew ? { slug: slugify(title) } : {}),
                      }));
                    }}
                    className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Slug (URL) *</label>
                  <input
                    type="text"
                    value={editing.slug ?? ''}
                    onChange={(e) => setEditing((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white font-mono focus:border-[#68b0a6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Functietype</label>
                <select
                  value={editing.roleType ?? ''}
                  onChange={(e) => setEditing((prev) => ({
                    ...prev,
                    roleType: (e.target.value as VacatureRol) || undefined,
                  }))}
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                >
                  <option value="">— Geen specifiek type —</option>
                  {(Object.entries(VACATURE_ROL_LABELS) as [VacatureRol, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Locatie</label>
                  <input
                    type="text"
                    value={editing.location ?? ''}
                    onChange={(e) => setEditing((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="bijv. Rotterdam"
                    className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Uren per week</label>
                  <input
                    type="text"
                    value={editing.hoursPerWeek ?? ''}
                    onChange={(e) => setEditing((prev) => ({ ...prev, hoursPerWeek: e.target.value }))}
                    placeholder="bijv. 32–40 uur"
                    className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Salaris</label>
                  <input
                    type="text"
                    value={editing.salaryRange ?? ''}
                    onChange={(e) => setEditing((prev) => ({ ...prev, salaryRange: e.target.value }))}
                    placeholder="bijv. €2.800–€3.600"
                    className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Afbeelding</label>
                {editing.imageUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editing.imageUrl}
                      alt="Preview"
                      className="h-16 w-24 rounded-lg object-cover border border-[#363848]"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowImagePicker(true)}
                        className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-white hover:bg-[#363848] transition-colors"
                      >
                        Andere afbeelding
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing((prev) => ({ ...prev, imageUrl: '' }))}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowImagePicker(true)}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-[#363848] bg-[#1e2028] px-4 py-3 text-sm text-[#9ca3af] hover:border-[#68b0a6] hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Afbeelding uploaden of kiezen uit bibliotheek
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Functiebeschrijving *</label>
                <textarea
                  rows={5}
                  value={editing.description ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Vereisten</label>
                <textarea
                  rows={4}
                  value={editing.requirements ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, requirements: e.target.value }))}
                  placeholder="Eén vereiste per regel..."
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Voordelen</label>
                <textarea
                  rows={3}
                  value={editing.benefits ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, benefits: e.target.value }))}
                  placeholder="Eén voordeel per regel, bijv.&#10;Marktconform salaris&#10;25 vakantiedagen"
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none resize-y"
                />
                <p className="mt-1 text-[10px] text-[#9ca3af]">Één voordeel per regel — verschijnt in &ldquo;Wat we bieden&rdquo; blok.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Perks</label>
                <input
                  type="text"
                  value={editing.perks ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, perks: e.target.value }))}
                  placeholder="bijv. Lease Auto, Pensioen, Opleidingen, Teamuitjes"
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-[#9ca3af]">Kommagescheiden — verschijnt als tags in groen &ldquo;Extra Perks&rdquo; blok.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Dagelijkse impact</label>
                <textarea
                  rows={4}
                  value={editing.impact ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, impact: e.target.value }))}
                  placeholder="Beschrijf de dagelijkse impact van deze functie..."
                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none resize-y"
                />
                <p className="mt-1 text-[10px] text-[#9ca3af]">Vrije tekst — verschijnt in &ldquo;Jouw dagelijkse impact&rdquo; sectie.</p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.isActive !== false}
                  onChange={(e) => setEditing((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-[#363848] bg-[#1e2028] accent-[#68b0a6]"
                />
                <span className="text-sm text-white">Vacature direct activeren (zichtbaar op /apply)</span>
              </label>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-[#68b0a6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Opslaan...' : 'Vacature opslaan'}
                </button>
                <button
                  onClick={closeEditor}
                  disabled={saving}
                  className="flex-1 rounded-lg border border-[#363848] px-4 py-2.5 text-sm font-medium text-[#9ca3af] hover:bg-[#363848] transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image picker modal */}
      {showImagePicker && editing && (
        <ImagePickerModal
          currentUrl={editing.imageUrl ?? ''}
          onSelect={(url) => {
            setEditing((prev) => ({ ...prev, imageUrl: url }));
            setShowImagePicker(false);
          }}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </div>
  );
}
