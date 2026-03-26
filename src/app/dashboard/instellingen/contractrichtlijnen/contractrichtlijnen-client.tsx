'use client';

import { useState } from 'react';
import Link from 'next/link';

const VACATURE_ROLLEN = [
  { key: 'MONTEUR', label: 'Installatiemonteur' },
  { key: 'ADVISEUR', label: 'Sales adviseur' },
  { key: 'BINNENDIENST_TECHNISCH', label: 'Technische binnendienst' },
  { key: 'BINNENDIENST_CALLCENTER', label: 'Callcenter medewerker' },
  { key: 'WAREHOUSE', label: 'Magazijnmedewerker' },
  { key: 'BACKOFFICE', label: 'Backoffice medewerker' },
] as const;

type RolKey = (typeof VACATURE_ROLLEN)[number]['key'];

interface Props {
  initialGuidelines: Record<string, string>;
}

export function ContractrichtlijnenClient({ initialGuidelines }: Props) {
  const [activeRol, setActiveRol] = useState<RolKey>('MONTEUR');
  const [contents, setContents] = useState<Record<string, string>>(
    Object.fromEntries(VACATURE_ROLLEN.map((r) => [r.key, initialGuidelines[r.key] ?? '']))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeLabel = VACATURE_ROLLEN.find((r) => r.key === activeRol)?.label ?? '';

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/settings/contract-guidelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleType: activeRol, content: contents[activeRol] ?? '' }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/instellingen"
          className="text-[#9ca3af] hover:text-white transition text-sm"
        >
          ← Instellingen
        </Link>
        <span className="text-[#363848]">/</span>
        <h1 className="text-xl font-semibold text-white">Contractrichtlijnen per rol</h1>
      </div>

      <p className="text-sm text-[#9ca3af] max-w-xl">
        Stel arbeidsvoorwaarden en richtlijnen in per vacaturerol. Dit wordt zichtbaar voor recruiters
        tijdens en na het sollicitatiegesprek.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        {/* Rol tabs */}
        <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {VACATURE_ROLLEN.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveRol(key)}
              className={`rounded-lg px-3 py-2 text-left text-xs font-medium whitespace-nowrap transition-colors ${
                activeRol === key
                  ? 'bg-[#f7a247] text-white'
                  : 'bg-[#252732] border border-[#363848] text-[#9ca3af] hover:text-white hover:bg-[#2e3041]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{activeLabel}</h2>
            <span className="text-xs text-[#9ca3af]">Markdown ondersteund</span>
          </div>

          <textarea
            value={contents[activeRol] ?? ''}
            onChange={(e) => setContents((prev) => ({ ...prev, [activeRol]: e.target.value }))}
            rows={16}
            placeholder={`Voer contractrichtlijnen in voor ${activeLabel}...\n\nBijvoorbeeld:\n# Salaris\n- Schaal conform CAO\n- €2.800–€3.600 bruto per maand\n\n# Arbeidsvoorwaarden\n- 25 vakantiedagen\n- Lease-auto\n- Pensioenregeling`}
            className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-3 text-sm text-white placeholder-[#4b5563] focus:border-[#68b0a6] focus:outline-none font-mono resize-y"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-[#68b0a6] px-5 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
            {saved && <span className="text-xs text-[#68b0a6]">✓ Opgeslagen</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
