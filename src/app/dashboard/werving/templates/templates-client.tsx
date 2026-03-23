'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ScreeningScript, InterviewChecklist, VacatureRol } from '@/types';
import { VACATURE_ROL_LABELS } from '@/types';

interface Props {
  screeningScripts: ScreeningScript[];
  interviewChecklists: InterviewChecklist[];
}

type Tab = 'screening' | 'checklist';

// ─── Screening script editor ──────────────────────────────────────────────────

interface QuestionDraft { question: string; placeholder: string; required: boolean }
interface ItemDraft { label: string; description: string }

function ScriptEditor({ onSaved, initialScript }: { onSaved: () => void; initialScript?: ScreeningScript }) {
  const [name, setName] = useState(initialScript?.name ?? '');
  const [description, setDescription] = useState(initialScript?.description ?? '');
  const [isActive, setIsActive] = useState(initialScript?.isActive ?? true);
  const [roleType, setRoleType] = useState<VacatureRol | ''>(initialScript?.roleType ?? '');
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialScript?.questions?.length
      ? initialScript.questions.map(q => ({ question: q.question, placeholder: q.placeholder ?? '', required: q.required }))
      : [{ question: '', placeholder: '', required: false }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditing = !!initialScript;

  function addQuestion() {
    setQuestions(prev => [...prev, { question: '', placeholder: '', required: false }]);
  }

  function removeQuestion(i: number) {
    setQuestions(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, field: keyof QuestionDraft, value: string | boolean) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Naam is verplicht.'); return; }
    const validQuestions = questions.filter(q => q.question.trim());
    if (!validQuestions.length) { setError('Voeg minimaal één vraag toe.'); return; }

    setSaving(true); setError('');
    const url = isEditing ? `/api/admin/screening-scripts/${initialScript.id}` : '/api/admin/screening-scripts';
    const res = await fetch(url, {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, isActive, roleType: roleType || null, questions: validQuestions }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Fout bij opslaan.'); setSaving(false); return; }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#68b0a6]/30 bg-[#252732] p-5">
      <h3 className="text-sm font-semibold text-white">{isEditing ? `Script bewerken — ${initialScript.name}` : 'Nieuw pre-screening script'}</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-[#9ca3af] mb-1">Naam *</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Standaard pre-screening"
            className="w-full rounded-md border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9ca3af] mb-1">Beschrijving</label>
          <input
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Optionele beschrijving"
            className="w-full rounded-md border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#9ca3af] mb-1">Functietype (optioneel)</label>
        <select
          value={roleType}
          onChange={e => setRoleType(e.target.value as VacatureRol | '')}
          className="w-full rounded-md border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none"
        >
          <option value="">— Generiek (alle rollen) —</option>
          {(Object.entries(VACATURE_ROL_LABELS) as [VacatureRol, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#e8e9ed] cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
          className="rounded border-[#363848] bg-[#1e2028] accent-[#68b0a6]" />
        Meteen activeren (deactiveert andere scripts van hetzelfde functietype)
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Vragen</span>
          <button type="button" onClick={addQuestion}
            className="text-xs text-[#68b0a6] hover:text-white transition-colors">+ Vraag toevoegen</button>
        </div>

        {questions.map((q, i) => (
          <div key={i} className="rounded-lg border border-[#363848] bg-[#1e2028] p-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-[#9ca3af] mt-1.5 w-5 shrink-0">{i + 1}.</span>
              <div className="flex-1 space-y-2">
                <input
                  value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)}
                  placeholder="Vraag (bijv. Wat is uw huidige werkgever?)"
                  className="w-full rounded border border-[#363848] bg-[#252732] px-2.5 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none"
                />
                <input
                  value={q.placeholder} onChange={e => updateQuestion(i, 'placeholder', e.target.value)}
                  placeholder="Placeholder tekst (optioneel)"
                  className="w-full rounded border border-[#363848] bg-[#252732] px-2.5 py-1.5 text-xs text-[#9ca3af] focus:border-[#68b0a6] focus:outline-none"
                />
                <label className="flex items-center gap-1.5 text-xs text-[#9ca3af] cursor-pointer">
                  <input type="checkbox" checked={q.required}
                    onChange={e => updateQuestion(i, 'required', e.target.checked)}
                    className="accent-[#68b0a6]" />
                  Verplicht veld
                </label>
              </div>
              <button type="button" onClick={() => removeQuestion(i)}
                className="text-[#9ca3af] hover:text-red-400 transition-colors text-lg leading-none mt-0.5">×</button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button type="submit" disabled={saving}
        className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-40 transition-colors">
        {saving ? 'Opslaan…' : isEditing ? 'Wijzigingen opslaan' : 'Script opslaan'}
      </button>
    </form>
  );
}

// ─── Checklist editor ─────────────────────────────────────────────────────────

function ChecklistEditor({ onSaved, initialChecklist }: { onSaved: () => void; initialChecklist?: InterviewChecklist }) {
  const [name, setName] = useState(initialChecklist?.name ?? '');
  const [description, setDescription] = useState(initialChecklist?.description ?? '');
  const [isActive, setIsActive] = useState(initialChecklist?.isActive ?? true);
  const [roleType, setRoleType] = useState<VacatureRol | ''>(initialChecklist?.roleType ?? '');
  const [items, setItems] = useState<ItemDraft[]>(
    initialChecklist?.items?.length
      ? initialChecklist.items.map(i => ({ label: i.label, description: i.description ?? '' }))
      : [{ label: '', description: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditing = !!initialChecklist;

  function addItem() { setItems(prev => [...prev, { label: '', description: '' }]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof ItemDraft, value: string) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Naam is verplicht.'); return; }
    const validItems = items.filter(item => item.label.trim());
    if (!validItems.length) { setError('Voeg minimaal één punt toe.'); return; }

    setSaving(true); setError('');
    const url = isEditing ? `/api/admin/interview-checklists/${initialChecklist.id}` : '/api/admin/interview-checklists';
    const res = await fetch(url, {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, isActive, roleType: roleType || null, items: validItems }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Fout bij opslaan.'); setSaving(false); return; }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-purple-500/30 bg-[#252732] p-5">
      <h3 className="text-sm font-semibold text-white">{isEditing ? `Checklist bewerken — ${initialChecklist.name}` : 'Nieuwe interview checklist'}</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-[#9ca3af] mb-1">Naam *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Standaard interview checklist"
            className="w-full rounded-md border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9ca3af] mb-1">Beschrijving</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Optionele beschrijving"
            className="w-full rounded-md border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#9ca3af] mb-1">Functietype (optioneel)</label>
        <select
          value={roleType}
          onChange={e => setRoleType(e.target.value as VacatureRol | '')}
          className="w-full rounded-md border border-[#363848] bg-[#1e2028] px-3 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none"
        >
          <option value="">— Generiek (alle rollen) —</option>
          {(Object.entries(VACATURE_ROL_LABELS) as [VacatureRol, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#e8e9ed] cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
          className="rounded border-[#363848] bg-[#1e2028] accent-[#68b0a6]" />
        Meteen activeren (deactiveert andere checklists van hetzelfde functietype)
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Checkpunten</span>
          <button type="button" onClick={addItem}
            className="text-xs text-[#68b0a6] hover:text-white transition-colors">+ Punt toevoegen</button>
        </div>

        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-[#363848] bg-[#1e2028] p-3">
            <span className="text-xs font-bold text-[#9ca3af] mt-1.5 w-5 shrink-0">{i + 1}.</span>
            <div className="flex-1 space-y-1.5">
              <input value={item.label} onChange={e => updateItem(i, 'label', e.target.value)}
                placeholder="Checkpunt (bijv. CV besproken)"
                className="w-full rounded border border-[#363848] bg-[#252732] px-2.5 py-1.5 text-sm text-[#e8e9ed] focus:border-[#68b0a6] focus:outline-none" />
              <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                placeholder="Toelichting (optioneel)"
                className="w-full rounded border border-[#363848] bg-[#252732] px-2.5 py-1.5 text-xs text-[#9ca3af] focus:border-[#68b0a6] focus:outline-none" />
            </div>
            <button type="button" onClick={() => removeItem(i)}
              className="text-[#9ca3af] hover:text-red-400 transition-colors text-lg leading-none mt-0.5">×</button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button type="submit" disabled={saving}
        className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-40 transition-colors">
        {saving ? 'Opslaan…' : isEditing ? 'Wijzigingen opslaan' : 'Checklist opslaan'}
      </button>
    </form>
  );
}

// ─── Main templates client ────────────────────────────────────────────────────

export function TemplatesClient({ screeningScripts, interviewChecklists }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('screening');
  const [showNewScript, setShowNewScript] = useState(false);
  const [showNewChecklist, setShowNewChecklist] = useState(false);
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const router = useRouter();

  const handleSaved = () => {
    setShowNewScript(false);
    setShowNewChecklist(false);
    setEditingScriptId(null);
    setEditingChecklistId(null);
    router.refresh();
  };

  async function toggleScriptActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/screening-scripts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    router.refresh();
  }

  async function toggleChecklistActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/interview-checklists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    router.refresh();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'screening', label: 'Pre-screening scripts' },
    { id: 'checklist', label: 'Interview checklists' },
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Scripts & Checklists</h1>
        <p className="text-sm text-[#9ca3af] mt-1">
          Beheer pre-screening scripts en interview checklists voor het wervingsproces.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#363848]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#68b0a6] text-[#68b0a6]'
                : 'border-transparent text-[#9ca3af] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pre-screening scripts tab */}
      {activeTab === 'screening' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewScript(v => !v)}
              className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] transition-colors"
            >
              {showNewScript ? 'Annuleren' : '+ Nieuw script'}
            </button>
          </div>

          {showNewScript && <ScriptEditor onSaved={handleSaved} />}

          {screeningScripts.length === 0 && !showNewScript ? (
            <div className="rounded-xl border border-dashed border-[#363848] p-8 text-center">
              <p className="text-sm text-[#9ca3af]">Nog geen scripts aangemaakt.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {screeningScripts.map(script => (
                <React.Fragment key={script.id}>
                <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">{script.name}</h3>
                        {script.isActive && (
                          <span className="rounded-full bg-[#68b0a6]/10 px-2 py-0.5 text-[10px] font-medium text-[#68b0a6]">
                            Actief
                          </span>
                        )}
                        {script.roleType && (
                          <span className="rounded-full bg-[#363848] px-2 py-0.5 text-[10px] text-[#9ca3af]">
                            {VACATURE_ROL_LABELS[script.roleType]}
                          </span>
                        )}
                      </div>
                      {script.description && (
                        <p className="text-xs text-[#9ca3af] mt-0.5">{script.description}</p>
                      )}
                      <p className="text-xs text-[#9ca3af] mt-1">
                        {script.questions?.length ?? 0} vragen
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingScriptId(editingScriptId === script.id ? null : script.id)}
                        className="rounded-lg bg-[#363848] px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:text-white transition-colors"
                      >
                        {editingScriptId === script.id ? 'Annuleren' : 'Bewerken'}
                      </button>
                      <button
                        onClick={() => toggleScriptActive(script.id, !script.isActive)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          script.isActive
                            ? 'bg-[#363848] text-[#9ca3af] hover:text-white'
                            : 'bg-[#68b0a6]/10 text-[#68b0a6] hover:bg-[#68b0a6]/20'
                        }`}
                      >
                        {script.isActive ? 'Deactiveren' : 'Activeren'}
                      </button>
                    </div>
                  </div>

                  {/* Questions preview */}
                  {editingScriptId !== script.id && (script.questions?.length ?? 0) > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-[#363848] pt-3">
                      {script.questions?.map((q, i) => (
                        <li key={q.id} className="flex items-start gap-2 text-xs text-[#9ca3af]">
                          <span className="shrink-0 font-medium text-[#68b0a6]">{i + 1}.</span>
                          {q.question}
                          {q.required && <span className="text-red-400 ml-0.5">*</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Inline edit form */}
                {editingScriptId === script.id && (
                  <div className="mt-4 border-t border-[#363848] pt-4">
                    <ScriptEditor onSaved={handleSaved} initialScript={script} />
                  </div>
                )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interview checklists tab */}
      {activeTab === 'checklist' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewChecklist(v => !v)}
              className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] transition-colors"
            >
              {showNewChecklist ? 'Annuleren' : '+ Nieuwe checklist'}
            </button>
          </div>

          {showNewChecklist && <ChecklistEditor onSaved={handleSaved} />}

          {interviewChecklists.length === 0 && !showNewChecklist ? (
            <div className="rounded-xl border border-dashed border-[#363848] p-8 text-center">
              <p className="text-sm text-[#9ca3af]">Nog geen checklists aangemaakt.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interviewChecklists.map(checklist => (
                <React.Fragment key={checklist.id}>
                <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">{checklist.name}</h3>
                        {checklist.isActive && (
                          <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                            Actief
                          </span>
                        )}
                        {checklist.roleType && (
                          <span className="rounded-full bg-[#363848] px-2 py-0.5 text-[10px] text-[#9ca3af]">
                            {VACATURE_ROL_LABELS[checklist.roleType]}
                          </span>
                        )}
                      </div>
                      {checklist.description && (
                        <p className="text-xs text-[#9ca3af] mt-0.5">{checklist.description}</p>
                      )}
                      <p className="text-xs text-[#9ca3af] mt-1">
                        {checklist.items?.length ?? 0} punten
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingChecklistId(editingChecklistId === checklist.id ? null : checklist.id)}
                        className="rounded-lg bg-[#363848] px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:text-white transition-colors"
                      >
                        {editingChecklistId === checklist.id ? 'Annuleren' : 'Bewerken'}
                      </button>
                      <button
                        onClick={() => toggleChecklistActive(checklist.id, !checklist.isActive)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          checklist.isActive
                            ? 'bg-[#363848] text-[#9ca3af] hover:text-white'
                            : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                        }`}
                      >
                        {checklist.isActive ? 'Deactiveren' : 'Activeren'}
                      </button>
                    </div>
                  </div>

                  {editingChecklistId !== checklist.id && (checklist.items?.length ?? 0) > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-[#363848] pt-3">
                      {checklist.items?.map((item, i) => (
                        <li key={item.id} className="flex items-start gap-2 text-xs text-[#9ca3af]">
                          <span className="shrink-0 font-medium text-purple-400">{i + 1}.</span>
                          {item.label}
                          {item.description && (
                            <span className="text-[#4a4d60]"> — {item.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Inline edit form */}
                {editingChecklistId === checklist.id && (
                  <div className="mt-4 border-t border-[#363848] pt-4">
                    <ChecklistEditor onSaved={handleSaved} initialChecklist={checklist} />
                  </div>
                )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
