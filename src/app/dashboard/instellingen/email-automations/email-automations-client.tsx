'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { AutomationDefinition, AutomationConfig } from '@/lib/email-automations';

interface Props {
  catalog: AutomationDefinition[];
}

const CATEGORY_LABELS: Record<string, string> = {
  Werving: 'Werving',
  HR: 'HR',
  Cron: 'Automatisch (cron)',
  SMS: 'SMS',
  Klant: 'Klant',
};

const RECIPIENT_COLORS: Record<string, string> = {
  Kandidaat: 'bg-blue-500/10 text-blue-400',
  Medewerker: 'bg-purple-500/10 text-purple-400',
  Beheerder: 'bg-orange-500/10 text-orange-400',
  Klant: 'bg-green-500/10 text-green-400',
  Recruiter: 'bg-pink-500/10 text-pink-400',
};

type ConfigMap = Record<string, AutomationConfig>;

export function EmailAutomationsClient({ catalog }: Props) {
  const [configs, setConfigs] = useState<ConfigMap>({});
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, { subject: string; intro: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email-automations');
      const data: AutomationConfig[] = await res.json();
      const map: ConfigMap = {};
      for (const c of data) map[c.key] = c;
      setConfigs(map);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function getConfig(key: string): AutomationConfig {
    return configs[key] ?? { key, enabled: true, customSubject: null, customIntro: null, updatedAt: null };
  }

  async function toggleEnabled(key: string) {
    const current = getConfig(key);
    setToggling((p) => ({ ...p, [key]: true }));
    setConfigs((p) => ({ ...p, [key]: { ...current, enabled: !current.enabled } }));
    try {
      await fetch('/api/admin/email-automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled: !current.enabled }),
      });
    } catch {
      // revert on error
      setConfigs((p) => ({ ...p, [key]: current }));
    } finally {
      setToggling((p) => ({ ...p, [key]: false }));
    }
  }

  function openEdit(key: string, def: AutomationDefinition) {
    const config = getConfig(key);
    setEditState((p) => ({
      ...p,
      [key]: {
        subject: config.customSubject ?? def.defaultSubject,
        intro: config.customIntro ?? def.defaultIntro ?? '',
      },
    }));
    setExpandedKey(expandedKey === key ? null : key);
  }

  async function saveEdit(key: string, def: AutomationDefinition) {
    const edit = editState[key];
    if (!edit) return;
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      const customSubject = edit.subject !== def.defaultSubject ? edit.subject : null;
      const customIntro = def.hasCustomIntro && edit.intro !== (def.defaultIntro ?? '') ? edit.intro : null;
      await fetch('/api/admin/email-automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, customSubject, customIntro }),
      });
      setConfigs((p) => ({
        ...p,
        [key]: { ...getConfig(key), customSubject, customIntro, updatedAt: new Date().toISOString() },
      }));
      setSaved((p) => ({ ...p, [key]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2000);
    } catch {
      // silent
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  }

  function resetToDefault(key: string, def: AutomationDefinition) {
    setEditState((p) => ({
      ...p,
      [key]: {
        subject: def.defaultSubject,
        intro: def.defaultIntro ?? '',
      },
    }));
  }

  const categories = [...new Set(catalog.map((d) => d.category))];

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/instellingen"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#363848] bg-[#252732] text-[#9ca3af] hover:text-white transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Automations</h1>
          <p className="mt-0.5 text-sm text-[#9ca3af]">
            Beheer welke automatische e-mails en SMS-berichten worden verstuurd en pas de inhoud aan.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#9ca3af] text-sm">
          Laden…
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => {
            const defs = catalog.filter((d) => d.category === cat);
            return (
              <section key={cat}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h2>
                <div className="space-y-2">
                  {defs.map((def) => {
                    const config = getConfig(def.key);
                    const isExpanded = expandedKey === def.key;
                    const edit = editState[def.key];
                    const hasCustomizations =
                      config.customSubject !== null || config.customIntro !== null;

                    return (
                      <div
                        key={def.key}
                        className={`rounded-xl border transition-colors ${
                          isExpanded
                            ? 'border-[#68b0a6]/30 bg-[#252732]'
                            : 'border-[#363848] bg-[#252732]'
                        }`}
                      >
                        {/* Row */}
                        <div className="flex items-center gap-4 p-4">
                          {/* Toggle */}
                          <button
                            onClick={() => toggleEnabled(def.key)}
                            disabled={toggling[def.key]}
                            className={`relative flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none ${
                              config.enabled ? 'bg-[#68b0a6]' : 'bg-[#363848]'
                            } ${toggling[def.key] ? 'opacity-50' : ''}`}
                            title={config.enabled ? 'Uitzetten' : 'Aanzetten'}
                          >
                            <span
                              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ml-0.5 ${
                                config.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-white">{def.name}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  RECIPIENT_COLORS[def.recipient] ?? 'bg-[#363848] text-[#9ca3af]'
                                }`}
                              >
                                {def.recipient}
                              </span>
                              {hasCustomizations && (
                                <span className="rounded-full bg-[#f7a247]/10 px-2 py-0.5 text-xs font-medium text-[#f7a247]">
                                  Aangepast
                                </span>
                              )}
                              {!config.enabled && (
                                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                                  Uit
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[#9ca3af] truncate">{def.description}</p>
                            <p className="mt-0.5 text-xs text-[#6b7280]">
                              <span className="text-[#9ca3af]">Trigger:</span> {def.trigger}
                            </p>
                          </div>

                          {/* Edit button */}
                          <button
                            onClick={() => openEdit(def.key, def)}
                            className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              isExpanded
                                ? 'border-[#68b0a6]/30 bg-[#68b0a6]/10 text-[#68b0a6]'
                                : 'border-[#363848] bg-[#1e2028] text-[#9ca3af] hover:text-white hover:border-[#4a4d5c]'
                            }`}
                          >
                            {isExpanded ? 'Sluiten' : 'Bewerken'}
                          </button>
                        </div>

                        {/* Expanded edit panel */}
                        {isExpanded && edit && (
                          <div className="border-t border-[#363848] px-4 pb-4 pt-4 space-y-4">
                            {/* Subject (hidden for SMS) */}
                            {def.category !== 'SMS' && (
                            <div>
                              <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">
                                Onderwerp
                                {config.customSubject && (
                                  <span className="ml-2 text-[#f7a247]">(aangepast)</span>
                                )}
                              </label>
                              <input
                                type="text"
                                value={edit.subject}
                                onChange={(e) =>
                                  setEditState((p) => ({
                                    ...p,
                                    [def.key]: { ...edit, subject: e.target.value },
                                  }))
                                }
                                className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#6b7280] focus:border-[#68b0a6]/50 focus:outline-none"
                              />
                              <p className="mt-1 text-xs text-[#6b7280]">
                                Standaard: <span className="font-mono">{def.defaultSubject}</span>
                              </p>
                            </div>
                            )}

                            {/* Intro */}
                            {def.hasCustomIntro && (
                              <div>
                                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">
                                  {def.category === 'SMS' ? 'Berichttekst' : 'Introductietekst'}
                                  {config.customIntro && (
                                    <span className="ml-2 text-[#f7a247]">(aangepast)</span>
                                  )}
                                </label>
                                <textarea
                                  rows={4}
                                  value={edit.intro}
                                  onChange={(e) =>
                                    setEditState((p) => ({
                                      ...p,
                                      [def.key]: { ...edit, intro: e.target.value },
                                    }))
                                  }
                                  className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#6b7280] focus:border-[#68b0a6]/50 focus:outline-none resize-y"
                                />
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveEdit(def.key, def)}
                                disabled={saving[def.key]}
                                className="rounded-lg bg-[#68b0a6] px-4 py-1.5 text-sm font-medium text-[#14151b] hover:bg-[#5a9e94] disabled:opacity-50 transition-colors"
                              >
                                {saving[def.key] ? 'Opslaan…' : saved[def.key] ? 'Opgeslagen ✓' : 'Opslaan'}
                              </button>
                              <button
                                onClick={() => resetToDefault(def.key, def)}
                                className="rounded-lg border border-[#363848] px-4 py-1.5 text-sm font-medium text-[#9ca3af] hover:text-white transition-colors"
                              >
                                Standaard herstellen
                              </button>
                              {config.updatedAt && (
                                <span className="ml-auto text-xs text-[#6b7280]">
                                  Laatst gewijzigd:{' '}
                                  {new Date(config.updatedAt).toLocaleDateString('nl-NL', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
