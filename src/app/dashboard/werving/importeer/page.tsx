'use client';

import { useState } from 'react';
import type { SheetLead } from '@/lib/google-sheets';

type ImportState = 'idle' | 'loading' | 'preview' | 'importing' | 'done' | 'error';

export default function ImporteerPage() {
  const [state, setState] = useState<ImportState>('idle');
  const [leads, setLeads] = useState<SheetLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadPreview() {
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/integrations/google-sheets/import');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Laden mislukt');
      const rows: SheetLead[] = data.data ?? [];
      setLeads(rows);
      setSelected(new Set(rows.map((_, i) => i)));
      setState('preview');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Onbekende fout');
      setState('error');
    }
  }

  function toggleAll() {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((_, i) => i)));
    }
  }

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  }

  async function runImport() {
    if (selected.size === 0) return;
    setState('importing');

    // IDs of leads we do NOT want to import (i.e., already have a ZwaluwNest ID)
    const skipIds = leads
      .filter((l, i) => !selected.has(i) && l.zwaluwId)
      .map((l) => l.zwaluwId);

    try {
      const res = await fetch('/api/integrations/google-sheets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import mislukt');
      setResult({ imported: data.imported, skipped: data.skipped });
      setState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import mislukt');
      setState('error');
    }
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white">Importeer vanuit Google Sheets</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Lees kandidaten uit het verbonden Google Spreadsheet en voeg ze toe aan de Werving Kanban.
        </p>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <h2 className="text-sm font-semibold text-white mb-2">Hoe werkt dit?</h2>
        <ol className="space-y-1.5 text-sm text-[#9ca3af]">
          <li><span className="text-[#68b0a6] font-medium">1.</span> Klik op &ldquo;Haal data op&rdquo; om het spreadsheet te lezen.</li>
          <li><span className="text-[#68b0a6] font-medium">2.</span> Selecteer de rijen die je wilt importeren (rijen met een ZwaluwNest ID worden overgeslagen).</li>
          <li><span className="text-[#68b0a6] font-medium">3.</span> Klik op &ldquo;Importeren&rdquo; om de kandidaten aan te maken in de Werving module.</li>
        </ol>
        <div className="mt-3 rounded-lg bg-[#1e2028] px-3 py-2 text-xs text-[#9ca3af]">
          <span className="text-[#f7a247] font-medium">Let op:</span> Kandidaten met een bestaand e-mailadres worden automatisch overgeslagen om duplicaten te voorkomen.
        </div>
      </div>

      {/* Action / States */}
      {state === 'idle' && (
        <button
          onClick={loadPreview}
          className="flex items-center gap-2 rounded-lg bg-[#68b0a6] px-5 py-2.5 text-sm font-semibold text-[#14151b] hover:bg-[#7ec4ba] transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Haal data op uit Google Sheets
        </button>
      )}

      {state === 'loading' && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-8 text-center">
          <div className="animate-pulse text-[#9ca3af] text-sm">Google Sheets laden...</div>
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-xl border border-red-500/20 bg-[#252732] p-5">
          <p className="text-sm text-red-400 mb-3">{errorMsg}</p>
          <button
            onClick={() => setState('idle')}
            className="text-sm text-[#68b0a6] hover:underline"
          >
            ← Probeer opnieuw
          </button>
        </div>
      )}

      {state === 'done' && result && (
        <div className="rounded-xl border border-[#68b0a6]/30 bg-[#252732] p-6 text-center">
          <div className="text-3xl mb-3">✓</div>
          <h2 className="text-lg font-semibold text-white mb-1">Import voltooid</h2>
          <p className="text-[#9ca3af] text-sm">
            <span className="text-[#68b0a6] font-semibold">{result.imported} kandidaten</span> geïmporteerd
            {result.skipped > 0 && `, ${result.skipped} overgeslagen (duplicaat)`}.
          </p>
          <div className="mt-4 flex gap-3 justify-center">
            <a
              href="/dashboard/werving"
              className="rounded-lg bg-[#68b0a6] px-4 py-2 text-sm font-semibold text-[#14151b] hover:bg-[#7ec4ba] transition"
            >
              Bekijk Werving Kanban →
            </a>
            <button
              onClick={() => { setState('idle'); setLeads([]); setResult(null); }}
              className="rounded-lg border border-[#363848] px-4 py-2 text-sm text-[#9ca3af] hover:bg-[#363848] transition"
            >
              Nieuwe import
            </button>
          </div>
        </div>
      )}

      {(state === 'preview' || state === 'importing') && leads.length === 0 && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-8 text-center">
          <p className="text-[#9ca3af] text-sm">Geen rijen gevonden in het spreadsheet.</p>
          <button onClick={() => setState('idle')} className="mt-3 text-sm text-[#68b0a6] hover:underline">
            ← Terug
          </button>
        </div>
      )}

      {(state === 'preview' || state === 'importing') && leads.length > 0 && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#363848]">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === leads.length}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-[#363848] bg-[#1e2028] accent-[#68b0a6]"
              />
              <span className="text-sm font-semibold text-white">
                {leads.length} rij{leads.length !== 1 ? 'en' : ''} gevonden
              </span>
              {selected.size > 0 && (
                <span className="rounded-full bg-[#68b0a6]/10 px-2 py-0.5 text-xs text-[#68b0a6]">
                  {selected.size} geselecteerd
                </span>
              )}
            </div>
          </div>

          {/* Rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#363848] bg-[#1e2028]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#9ca3af] w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#9ca3af]">Naam</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#9ca3af]">E-mail</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#9ca3af]">Telefoon</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#9ca3af]">Campagne</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#9ca3af]">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#9ca3af]">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr
                    key={i}
                    onClick={() => toggle(i)}
                    className={`border-b border-[#363848] cursor-pointer transition ${
                      selected.has(i) ? 'bg-[#68b0a6]/5' : 'hover:bg-[#1e2028]'
                    } ${lead.zwaluwId ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggle(i)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-[#363848] bg-[#1e2028] accent-[#68b0a6]"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-[#e8e9ed]">{lead.name || '—'}</td>
                    <td className="px-4 py-3 text-[#9ca3af]">{lead.email || '—'}</td>
                    <td className="px-4 py-3 text-[#9ca3af]">{lead.phone || '—'}</td>
                    <td className="px-4 py-3 text-[#9ca3af] font-mono text-xs">{lead.campaign || '—'}</td>
                    <td className="px-4 py-3 text-[#9ca3af]">{lead.date || '—'}</td>
                    <td className="px-4 py-3">
                      {lead.zwaluwId ? (
                        <span className="rounded-full bg-[#68b0a6]/10 px-2 py-0.5 text-xs text-[#68b0a6]">Al aangemaakt</span>
                      ) : (
                        <span className="rounded-full bg-[#f7a247]/10 px-2 py-0.5 text-xs text-[#f7a247]">Nieuw</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#363848]">
            <button
              onClick={() => { setState('idle'); setLeads([]); }}
              className="text-sm text-[#9ca3af] hover:text-white transition"
            >
              ← Annuleren
            </button>
            <button
              onClick={runImport}
              disabled={selected.size === 0 || state === 'importing'}
              className="flex items-center gap-2 rounded-lg bg-[#68b0a6] px-5 py-2 text-sm font-semibold text-[#14151b] hover:bg-[#7ec4ba] disabled:opacity-50 transition"
            >
              {state === 'importing' ? (
                <>
                  <span className="animate-spin">↻</span> Importeren...
                </>
              ) : (
                <>
                  {selected.size} kandidaten importeren →
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
