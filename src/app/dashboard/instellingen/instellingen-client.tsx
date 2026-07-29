'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const VACATURE_ROLLEN = [
  { key: 'MONTEUR', label: 'Installatiemonteur' },
  { key: 'ADVISEUR', label: 'Sales adviseur' },
  { key: 'BINNENDIENST_TECHNISCH', label: 'Technische binnendienst' },
  { key: 'BINNENDIENST_CALLCENTER', label: 'Callcenter medewerker' },
  { key: 'WAREHOUSE', label: 'Magazijnmedewerker' },
  { key: 'BACKOFFICE', label: 'Backoffice medewerker' },
] as const;

type VacatureRolKey = (typeof VACATURE_ROLLEN)[number]['key'];

interface Props {
  googleConnected: boolean;
  googleStatus?: string;
  hasGoogleCredentials: boolean;
  hasGoogleSheets: boolean;
  hasCronSecret: boolean;
  staffUsers: { id: string; name: string; jobTitle?: string | null; role: string }[];
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? 'bg-[#68b0a6]/10 text-[#68b0a6]' : 'bg-[#9ca3af]/10 text-[#9ca3af]'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-[#68b0a6]' : 'bg-[#9ca3af]'}`} />
      {label}
    </span>
  );
}

export function InstellingenClient({
  googleConnected,
  googleStatus,
  hasGoogleCredentials,
  hasGoogleSheets,
  hasCronSecret,
  staffUsers,
}: Props) {

  // Stage alert thresholds
  const [stageAlerts, setStageAlerts] = useState({
    NEW_LEAD: 3,
    CONTACTED: 5,
    PRE_SCREENING: 5,
    SCREENING_DONE: 3,
    INTERVIEW: 7,
    RESERVE_BANK: 30,
  });
  const [stageAlertsLoading, setStageAlertsLoading] = useState(true);
  const [stageAlertsSaving, setStageAlertsSaving] = useState(false);
  const [stageAlertsSaved, setStageAlertsSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stage-alerts')
      .then((r) => r.json())
      .then((d) => {
        setStageAlerts({
          NEW_LEAD: d.NEW_LEAD ?? 3,
          CONTACTED: d.CONTACTED ?? 5,
          PRE_SCREENING: d.PRE_SCREENING ?? 5,
          SCREENING_DONE: d.SCREENING_DONE ?? 3,
          INTERVIEW: d.INTERVIEW ?? 7,
          RESERVE_BANK: d.RESERVE_BANK ?? 30,
        });
      })
      .catch(() => {})
      .finally(() => setStageAlertsLoading(false));
  }, []);

  async function saveStageAlerts() {
    setStageAlertsSaving(true);
    try {
      await fetch('/api/admin/stage-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageAlerts),
      });
      setStageAlertsSaved(true);
      setTimeout(() => setStageAlertsSaved(false), 2500);
    } catch {
      // silent fail
    } finally {
      setStageAlertsSaving(false);
    }
  }
  // Role assignments
  const [roleAssignments, setRoleAssignments] = useState<Record<VacatureRolKey, string>>(
    Object.fromEntries(VACATURE_ROLLEN.map((r) => [r.key, ''])) as Record<VacatureRolKey, string>
  );
  const [roleAssignmentsLoading, setRoleAssignmentsLoading] = useState(true);
  const [roleAssignmentsSaving, setRoleAssignmentsSaving] = useState(false);
  const [roleAssignmentsSaved, setRoleAssignmentsSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings/role-assignments')
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, string> = {};
        for (const item of d.data ?? []) {
          map[item.roleType] = item.userId ?? '';
        }
        setRoleAssignments((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {})
      .finally(() => setRoleAssignmentsLoading(false));
  }, []);

  async function saveRoleAssignments() {
    setRoleAssignmentsSaving(true);
    try {
      const payload = VACATURE_ROLLEN.map((r) => ({
        roleType: r.key,
        userId: roleAssignments[r.key] || null,
      }));
      await fetch('/api/settings/role-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setRoleAssignmentsSaved(true);
      setTimeout(() => setRoleAssignmentsSaved(false), 2500);
    } catch {
      // silent fail
    } finally {
      setRoleAssignmentsSaving(false);
    }
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white">Instellingen & Integraties</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Beheer externe koppelingen en automatiseringen voor ZwaluwNest.
        </p>
      </div>

      {/* E-mail automations */}
      <Link
        href="/dashboard/instellingen/email-automations"
        className="flex items-center justify-between rounded-xl border border-[#363848] bg-[#252732] p-5 hover:border-[#4a4d5c] transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#68b0a6]/10">
            <svg className="h-5 w-5 text-[#68b0a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">E-mail automations</h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">
              Beheer welke automatische e-mails worden verstuurd en pas de inhoud aan.
            </p>
          </div>
        </div>
        <svg className="h-4 w-4 text-[#9ca3af] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* Google Calendar */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.5 22h-15A2.502 2.502 0 012 19.5v-15C2 3.122 3.122 2 4.5 2H8V0h2v2h4V0h2v2h3.5C21.878 2 23 3.122 23 4.5v15c0 1.378-1.122 2.5-2.5 2.5zM4.5 4C4.224 4 4 4.224 4 4.5v15c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-15c0-.276-.224-.5-.5-.5H19v2h-2V4H7v2H5V4H4.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Google Agenda</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Synchroniseer afspraken en verlof met je Google Agenda.
              </p>
            </div>
          </div>
          <StatusBadge ok={googleConnected} label={googleConnected ? 'Verbonden' : 'Niet verbonden'} />
        </div>

        {googleStatus === 'connected' && (
          <div className="mt-3 rounded-lg bg-[#68b0a6]/10 border border-[#68b0a6]/20 px-3 py-2 text-xs text-[#68b0a6]">
            ✓ Google Agenda succesvol gekoppeld!
          </div>
        )}
        {googleStatus === 'error' && (
          <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            Koppelen mislukt. Controleer de Google OAuth instellingen in je .env bestand.
          </div>
        )}

        <div className="mt-4">
          {!hasGoogleCredentials ? (
            <div className="rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af]">
              <p className="font-medium text-[#f7a247] mb-1">Configuratie vereist</p>
              <p>Voeg de volgende omgevingsvariabelen toe aan je <code className="text-[#68b0a6]">.env</code>:</p>
              <pre className="mt-2 text-[#9ca3af] font-mono">
{`GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...`}
              </pre>
            </div>
          ) : googleConnected ? (
            <div className="flex gap-2">
              <a
                href="/api/integrations/google/connect"
                className="rounded-lg border border-[#363848] px-4 py-2 text-xs text-[#9ca3af] hover:bg-[#363848] transition"
              >
                Opnieuw verbinden
              </a>
            </div>
          ) : (
            <a
              href="/api/integrations/google/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
            >
              Verbind Google Agenda →
            </a>
          )}
        </div>
      </div>


      {/* Google Sheets */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.86 2H4.14A2.14 2.14 0 002 4.14v15.72A2.14 2.14 0 004.14 22h15.72A2.14 2.14 0 0022 19.86V4.14A2.14 2.14 0 0019.86 2zM9 18H6v-2h3v2zm0-4H6v-2h3v2zm0-4H6V8h3v2zm5 8h-3v-2h3v2zm0-4h-3v-2h3v2zm0-4h-3V8h3v2zm5 8h-3v-2h3v2zm0-4h-3v-2h3v2zm0-4h-3V8h3v2z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Google Sheets Koppeling</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Leads loggen naar Google Sheets en historische leads importeren.
              </p>
            </div>
          </div>
          <StatusBadge ok={hasGoogleSheets} label={hasGoogleSheets ? 'Geconfigureerd' : 'Niet geconfigureerd'} />
        </div>

        {!hasGoogleSheets && (
          <div className="mt-4 rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af]">
            <p className="font-medium text-[#f7a247] mb-1">Configuratie vereist</p>
            <pre className="font-mono">
{`GOOGLE_SHEETS_ID=spreadsheet_id_uit_url
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=base64_json`}
            </pre>
            <p className="mt-2">
              Maak een Service Account aan in Google Cloud Console, deel het spreadsheet met het service account e-mailadres, en codeer de JSON-sleutel als base64.
            </p>
          </div>
        )}

        {hasGoogleSheets && (
          <div className="mt-4">
            <a
              href="/dashboard/werving/importeer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500 transition"
            >
              Leads importeren →
            </a>
          </div>
        )}
      </div>


      {/* Cron / Automatische notificaties */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f7a247]/10">
              <svg className="h-5 w-5 text-[#f7a247]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Dagelijkse Automatische Controles</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Cron job loopt elke dag om 07:00 — controleert contracten, verzuim en AVG.
              </p>
            </div>
          </div>
          <StatusBadge ok={hasCronSecret} label={hasCronSecret ? 'Geconfigureerd' : 'Niet geconfigureerd'} />
        </div>

        {!hasCronSecret && (
          <div className="mt-4 rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af]">
            <p className="font-medium text-[#f7a247] mb-1">Configuratie vereist</p>
            <pre className="font-mono">CRON_SECRET=willekeurige_lange_geheime_string</pre>
          </div>
        )}

        {hasCronSecret && (
          <div className="mt-4 rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af]">
            <p>Handmatig uitvoeren (curl):</p>
            <pre className="mt-1 text-[#68b0a6] font-mono overflow-x-auto">
{`curl -X POST \\
  -H "x-cron-secret: $CRON_SECRET" \\
  ${typeof window !== 'undefined' ? window.location.origin : 'https://jouwdomein.nl'}/api/cron/daily-checks`}
            </pre>
          </div>
        )}
      </div>

      {/* Werving */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Werving</h2>
      </div>

      {/* Contract Guidelines link */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#68b0a6]/10">
              <svg className="h-5 w-5 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Contractrichtlijnen per rol</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Stel arbeidsvoorwaarden in die zichtbaar zijn tijdens sollicitatiegesprekken.
              </p>
            </div>
          </div>
          <a
            href="/dashboard/instellingen/contractrichtlijnen"
            className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:bg-[#363848] hover:text-white transition"
          >
            Beheren →
          </a>
        </div>
      </div>

      {/* Werving — Roltoewijzing */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f7a247]/10">
            <svg className="h-5 w-5 text-[#f7a247]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Automatische roltoewijzing</h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">
              Nieuwe leads worden automatisch toegewezen aan de gekozen recruiter per vacaturerol.
            </p>
          </div>
        </div>

        {roleAssignmentsLoading ? (
          <p className="text-xs text-[#9ca3af]">Laden…</p>
        ) : (
          <div className="space-y-2">
            {VACATURE_ROLLEN.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-4 rounded-lg bg-[#1e2028] px-3 py-2">
                <span className="text-xs text-white w-48 shrink-0">{label}</span>
                <select
                  value={roleAssignments[key]}
                  onChange={(e) => setRoleAssignments((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 rounded-lg border border-[#363848] bg-[#14151b] px-2 py-1 text-xs text-white focus:border-[#68b0a6] focus:outline-none"
                >
                  <option value="">— Geen toewijzing —</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.jobTitle ? ` — ${u.jobTitle}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveRoleAssignments}
                disabled={roleAssignmentsSaving}
                className="rounded-lg bg-[#f7a247] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e5932e] disabled:opacity-50 transition-colors"
              >
                {roleAssignmentsSaving ? 'Opslaan…' : 'Toewijzingen opslaan'}
              </button>
              {roleAssignmentsSaved && (
                <span className="text-xs text-[#68b0a6]">✓ Opgeslagen</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stage Duration Alerts */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#68b0a6]/10">
              <svg className="h-5 w-5 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Wervingsstage Alerts</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Stuur een melding als een kandidaat te lang in een fase staat.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {stageAlertsLoading ? (
            <p className="text-xs text-[#9ca3af]">Laden…</p>
          ) : (
            <>
              {([
                { key: 'NEW_LEAD', label: 'Nieuw' },
                { key: 'CONTACTED', label: 'Gecontacteerd' },
                { key: 'PRE_SCREENING', label: 'Pre-screening' },
                { key: 'SCREENING_DONE', label: 'Screening klaar' },
                { key: 'INTERVIEW', label: 'Interview' },
                { key: 'RESERVE_BANK', label: 'Reserve Bank' },
              ] as { key: keyof typeof stageAlerts; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-lg bg-[#1e2028] px-3 py-2">
                  <span className="text-xs text-white w-36 shrink-0">{label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={stageAlerts[key]}
                      onChange={(e) =>
                        setStageAlerts((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                      }
                      className="w-16 rounded-lg border border-[#363848] bg-[#14151b] px-2 py-1 text-xs text-white text-right focus:border-[#68b0a6] focus:outline-none"
                    />
                    <span className="text-xs text-[#9ca3af]">dagen</span>
                  </div>
                  <span className="text-xs text-[#9ca3af] flex-1 text-right">
                    {stageAlerts[key] === 0 ? 'Uitgeschakeld' : `Alert na ${stageAlerts[key]} dagen`}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={saveStageAlerts}
                  disabled={stageAlertsSaving}
                  className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
                >
                  {stageAlertsSaving ? 'Opslaan…' : 'Drempelwaarden opslaan'}
                </button>
                {stageAlertsSaved && (
                  <span className="text-xs text-[#68b0a6]">✓ Opgeslagen</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
