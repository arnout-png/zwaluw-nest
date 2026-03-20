'use client';

import { useState } from 'react';

interface Props {
  googleConnected: boolean;
  googleStatus?: string;
  hasGoogleCredentials: boolean;
  hasResend: boolean;
  hasFacebook: boolean;
  hasGoogleSheets: boolean;
  hasCronSecret: boolean;
  hasNmbrs: boolean;
  hasLinkedIn: boolean;
  linkedinStatus?: string;
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
  hasResend,
  hasFacebook,
  hasGoogleSheets,
  hasCronSecret,
  hasNmbrs,
  hasLinkedIn,
  linkedinStatus,
}: Props) {
  const [nmbrsStatus, setNmbrsStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [linkedinImporting, setLinkedinImporting] = useState(false);
  const [linkedinImportResult, setLinkedinImportResult] = useState('');
  const [nmbrsMessage, setNmbrsMessage] = useState('');
  const [nmbrsImporting, setNmbrsImporting] = useState(false);
  const [nmbrsImportResult, setNmbrsImportResult] = useState<string>('');
  const [nmbrsSyncing, setNmbrsSyncing] = useState(false);
  const [nmbrsSyncResult, setNmbrsSyncResult] = useState<string>('');

  async function importFromLinkedIn() {
    setLinkedinImporting(true);
    setLinkedinImportResult('');
    try {
      const res = await fetch('/api/integrations/linkedin/import', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setLinkedinImportResult(
          `Geïmporteerd: ${json.created}, overgeslagen: ${json.skipped}${json.errors?.length ? `, fouten: ${json.errors.join('; ')}` : ''}`
        );
      } else {
        setLinkedinImportResult(`Fout: ${json.error}`);
      }
    } catch {
      setLinkedinImportResult('Netwerkfout — import mislukt.');
    } finally {
      setLinkedinImporting(false);
    }
  }

  async function testNmbrs() {
    setNmbrsStatus('testing');
    setNmbrsMessage('');
    try {
      const res = await fetch('/api/integrations/nmbrs/test');
      const json = await res.json();
      if (json.ok) {
        const companyNames = (json.companies as Array<{ name: string }>).map((c) => c.name).join(', ');
        setNmbrsStatus('ok');
        setNmbrsMessage(`Verbonden ✓ — Bedrijven: ${companyNames || '(geen)'}`);
      } else {
        setNmbrsStatus('error');
        setNmbrsMessage(json.error ?? 'Verbinding mislukt.');
      }
    } catch {
      setNmbrsStatus('error');
      setNmbrsMessage('Netwerkfout — controleer de server.');
    }
  }

  async function importFromNmbrs() {
    setNmbrsImporting(true);
    setNmbrsImportResult('');
    try {
      const res = await fetch('/api/integrations/nmbrs/import', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setNmbrsImportResult(
          `Geïmporteerd: ${json.imported}, overgeslagen: ${json.skipped}${json.errors?.length ? `, fouten: ${json.errors.join('; ')}` : ''}`
        );
      } else {
        setNmbrsImportResult(`Fout: ${json.error}`);
      }
    } catch {
      setNmbrsImportResult('Netwerkfout — import mislukt.');
    } finally {
      setNmbrsImporting(false);
    }
  }

  async function syncToNmbrs() {
    setNmbrsSyncing(true);
    setNmbrsSyncResult('');
    try {
      const res = await fetch('/api/integrations/nmbrs/sync', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setNmbrsSyncResult(
          `Gesynchroniseerd: ${json.synced}${json.errors?.length ? `, fouten: ${json.errors.join('; ')}` : ''}`
        );
      } else {
        setNmbrsSyncResult(`Fout: ${json.error}`);
      }
    } catch {
      setNmbrsSyncResult('Netwerkfout — sync mislukt.');
    } finally {
      setNmbrsSyncing(false);
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

      {/* Facebook Leads Webhook */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1877F2]/10">
              <svg className="h-5 w-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Facebook Lead Ads Webhook</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Automatisch nieuwe kandidaten aanmaken vanuit Facebook Lead Ads.
              </p>
            </div>
          </div>
          <StatusBadge ok={hasFacebook} label={hasFacebook ? 'Geconfigureerd' : 'Niet geconfigureerd'} />
        </div>

        <div className="mt-4 rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af] space-y-2">
          <p className="font-medium text-white">Webhook URL (kopieer naar Facebook Business Manager):</p>
          <div className="flex items-center gap-2">
            <code className="text-[#68b0a6] bg-[#14151b] px-2 py-1 rounded flex-1 overflow-x-auto">
              {typeof window !== 'undefined' ? window.location.origin : 'https://jouwdomein.nl'}/api/webhooks/facebook-leads
            </code>
          </div>
          {!hasFacebook && (
            <>
              <p className="font-medium text-[#f7a247] mt-2">Vereiste omgevingsvariabelen:</p>
              <pre className="font-mono text-[#9ca3af]">
{`FACEBOOK_WEBHOOK_VERIFY_TOKEN=jouw_verify_token
FACEBOOK_APP_SECRET=jouw_app_secret
FACEBOOK_PAGE_ACCESS_TOKEN=jouw_page_token`}
              </pre>
            </>
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

      {/* Email (Resend) */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">E-mail Notificaties (Resend)</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Automatische e-mails voor verlof, contracten en poortwachter.
              </p>
            </div>
          </div>
          <StatusBadge ok={hasResend} label={hasResend ? 'Geconfigureerd' : 'Niet geconfigureerd'} />
        </div>

        {!hasResend && (
          <div className="mt-4 rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af]">
            <p className="font-medium text-[#f7a247] mb-1">Configuratie vereist</p>
            <pre className="font-mono">
{`RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=ZwaluwNest <noreply@jouwdomein.nl>
ADMIN_EMAIL=beheerder@jouwdomein.nl`}
            </pre>
            <p className="mt-2">Meld je aan op <span className="text-[#68b0a6]">resend.com</span>, verifieer je domein en maak een API-sleutel aan.</p>
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

      {/* Nmbrs HR Integratie */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <svg className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Nmbrs HR Koppeling</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Medewerkers importeren vanuit Nmbrs of naar Nmbrs synchroniseren via SOAP API v3.
              </p>
            </div>
          </div>
          <StatusBadge ok={hasNmbrs} label={hasNmbrs ? 'Geconfigureerd' : 'Niet geconfigureerd'} />
        </div>

        {!hasNmbrs ? (
          <div className="mt-4 rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af]">
            <p className="font-medium text-[#f7a247] mb-1">Vereiste omgevingsvariabelen</p>
            <pre className="font-mono">
{`NMBRS_USERNAME=uw@email.nl
NMBRS_TOKEN=uw-api-token-uit-nmbrs
NMBRS_DOMAIN=bedrijfsnaam
NMBRS_SANDBOX=false   # true voor sandbox testen`}
            </pre>
            <p className="mt-2">
              De API-token vindt u in Nmbrs onder <span className="text-[#68b0a6]">Instellingen → Gebruiker → API-toegang</span>.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Test connection */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={testNmbrs}
                disabled={nmbrsStatus === 'testing'}
                className="rounded-lg border border-[#363848] px-4 py-2 text-xs font-medium text-white hover:bg-[#363848] disabled:opacity-50 transition-colors"
              >
                {nmbrsStatus === 'testing' ? 'Testen...' : 'Test verbinding'}
              </button>
              {nmbrsMessage && (
                <span className={`text-xs ${nmbrsStatus === 'ok' ? 'text-[#68b0a6]' : 'text-red-400'}`}>
                  {nmbrsMessage}
                </span>
              )}
            </div>

            {/* Import */}
            <div className="rounded-lg bg-[#1e2028] p-3 space-y-2">
              <p className="text-xs font-medium text-white">Importeer medewerkers uit Nmbrs</p>
              <p className="text-xs text-[#9ca3af]">
                Haalt alle Nmbrs-medewerkers op en maakt accounts aan in ZwaluwNest (overslaat bestaande e-mailadressen).
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={importFromNmbrs}
                  disabled={nmbrsImporting}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50 transition-colors"
                >
                  {nmbrsImporting ? 'Importeren...' : 'Importeer medewerkers'}
                </button>
                {nmbrsImportResult && (
                  <span className="text-xs text-[#9ca3af]">{nmbrsImportResult}</span>
                )}
              </div>
            </div>

            {/* Sync */}
            <div className="rounded-lg bg-[#1e2028] p-3 space-y-2">
              <p className="text-xs font-medium text-white">Synchroniseer naar Nmbrs</p>
              <p className="text-xs text-[#9ca3af]">
                Stuurt medewerkers die nog geen Nmbrs-ID hebben naar Nmbrs en slaat het ID op.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={syncToNmbrs}
                  disabled={nmbrsSyncing}
                  className="rounded-lg bg-[#68b0a6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
                >
                  {nmbrsSyncing ? 'Synchroniseren...' : 'Synchroniseer naar Nmbrs'}
                </button>
                {nmbrsSyncResult && (
                  <span className="text-xs text-[#9ca3af]">{nmbrsSyncResult}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LinkedIn Lead Gen */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2]/10">
              <svg className="h-5 w-5 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">LinkedIn Lead Gen Forms</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Automatisch kandidaten importeren via LinkedIn Lead Gen Forms API.
              </p>
            </div>
          </div>
          <StatusBadge ok={hasLinkedIn} label={hasLinkedIn ? 'Verbonden' : 'Niet verbonden'} />
        </div>

        {linkedinStatus === 'connected' && (
          <div className="mt-3 rounded-lg bg-[#68b0a6]/10 border border-[#68b0a6]/20 px-3 py-2 text-xs text-[#68b0a6]">
            ✓ LinkedIn succesvol gekoppeld!
          </div>
        )}
        {linkedinStatus === 'error' && (
          <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            Koppelen mislukt. Controleer de LinkedIn OAuth instellingen.
          </div>
        )}

        <div className="mt-4 space-y-3">
          {!process.env.NEXT_PUBLIC_APP_URL && hasLinkedIn ? null : (
            <div className="rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af] space-y-2">
              <p className="font-medium text-white">Webhook URL (plak in LinkedIn Campaign Manager):</p>
              <code className="block text-[#68b0a6] bg-[#14151b] px-2 py-1 rounded overflow-x-auto">
                {typeof window !== 'undefined' ? window.location.origin : 'https://zwaluw-portal.vercel.app'}/api/integrations/linkedin/webhook
              </code>
            </div>
          )}

          {!hasLinkedIn ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-[#1e2028] px-3 py-3 text-xs text-[#9ca3af]">
                <p className="font-medium text-[#f7a247] mb-1">Vereiste omgevingsvariabelen</p>
                <pre className="font-mono">
{`LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_WEBHOOK_SECRET=...  # optioneel, voor webhook verificatie`}
                </pre>
                <p className="mt-2">
                  Maak een LinkedIn App aan op{' '}
                  <span className="text-[#68b0a6]">developer.linkedin.com</span>, vraag
                  Marketing Developer Platform toegang aan en activeer de scope{' '}
                  <code className="text-[#68b0a6]">r_ads_leadgen_automation</code>.
                </p>
              </div>
              <a
                href="/api/integrations/linkedin/connect"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0958a8] transition"
              >
                Verbind met LinkedIn →
              </a>
            </div>
          ) : (
            <div className="rounded-lg bg-[#1e2028] p-3 space-y-2">
              <p className="text-xs font-medium text-white">Leads importeren</p>
              <p className="text-xs text-[#9ca3af]">
                Haalt recente Lead Gen Form inzendingen op en maakt kandidaatprofielen aan (overslaat bestaande e-mailadressen).
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={importFromLinkedIn}
                  disabled={linkedinImporting}
                  className="rounded-lg bg-[#0A66C2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0958a8] disabled:opacity-50 transition-colors"
                >
                  {linkedinImporting ? 'Importeren...' : 'Importeer LinkedIn leads'}
                </button>
                {linkedinImportResult && (
                  <span className="text-xs text-[#9ca3af]">{linkedinImportResult}</span>
                )}
              </div>
              <div className="pt-1">
                <a
                  href="/api/integrations/linkedin/connect"
                  className="text-xs text-[#9ca3af] hover:text-white transition underline underline-offset-2"
                >
                  Opnieuw verbinden
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info footer */}
      <div className="rounded-xl border border-[#363848] bg-[#1e2028] p-4">
        <p className="text-xs text-[#9ca3af]">
          <span className="text-white font-medium">Tip:</span> Voeg alle omgevingsvariabelen toe via Vercel Dashboard → Settings → Environment Variables.
          Na het toevoegen, herstart de development server of maak een nieuwe deployment aan.
        </p>
      </div>
    </div>
  );
}
