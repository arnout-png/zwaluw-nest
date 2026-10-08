'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  candidateId: string;
  hasEmail: boolean;
  hasPhone: boolean;
  /** Is er al eerder een link verstuurd (en nog geldig)? */
  activeUntil?: string | null;
}

/**
 * "Stuur pre-screeninglink": maakt een persoonlijke link (7 dagen geldig),
 * mailt/sms't die naar de kandidaat en zet de kandidaat op Pre-screening.
 * De link wordt ook getoond, zodat je hem zelf kunt doorsturen (WhatsApp).
 */
export function CandidateScreeningInviteClient({ candidateId, hasEmail, hasPhone, activeUntil }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ url: string; emailSent: boolean; smsSent: boolean; warning?: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function send() {
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/candidates/${candidateId}/screening-invite`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Versturen mislukt.');
        return;
      }
      setResult({
        url: json.screeningUrl,
        emailSent: !!json.emailSent,
        smsSent: !!json.smsSent,
        warning: json.warning,
      });
      setConfirming(false);
      router.refresh();
    } catch {
      setError('Geen verbinding. Probeer het opnieuw.');
    } finally {
      setSending(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* klembord geblokkeerd — de link staat zichtbaar in beeld */
    }
  }

  const stillValid = activeUntil && new Date(activeUntil) > new Date();

  return (
    <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Pre-screening per link</h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            De kandidaat vult zelf een korte vragenlijst in (5 min). Link is 7 dagen geldig.
            {stillValid && (
              <> Er staat al een link open tot {new Date(activeUntil!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}; opnieuw versturen maakt een nieuwe.</>
            )}
          </p>
        </div>
        {!confirming && !result && (
          <button
            onClick={() => setConfirming(true)}
            disabled={!hasEmail && !hasPhone}
            className="rounded-lg bg-[#68b0a6] px-3 py-2 text-xs font-semibold text-[#14151b] hover:bg-[#7ec4ba] transition-colors disabled:opacity-50"
          >
            Stuur pre-screeninglink
          </button>
        )}
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#1e2028] p-3">
          <span className="text-xs text-[#e8e9ed] flex-1 min-w-[200px]">
            Link versturen{hasEmail ? ' per e-mail' : ''}{hasEmail && hasPhone ? ' en' : ''}{hasPhone ? ' per sms' : ''}? De kandidaat gaat naar &ldquo;Pre-screening&rdquo;.
          </span>
          <button
            onClick={send}
            disabled={sending}
            className="rounded-lg bg-[#68b0a6] px-3 py-1.5 text-xs font-semibold text-[#14151b] disabled:opacity-50"
          >
            {sending ? 'Versturen…' : 'Ja, versturen'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={sending}
            className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white"
          >
            Annuleer
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2 rounded-lg bg-[#1e2028] p-3">
          <p className="text-xs text-[#68b0a6]">
            ✓ Link aangemaakt
            {result.emailSent ? ' · e-mail verstuurd' : ' · géén e-mail verstuurd'}
            {result.smsSent ? ' · sms verstuurd' : ''}
          </p>
          {result.warning && <p className="text-xs text-[#f7a247]">{result.warning}</p>}
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-[11px] text-[#e8e9ed]">{result.url}</code>
            <button onClick={copy} className="text-xs text-[#68b0a6] hover:text-white shrink-0">
              {copied ? 'Gekopieerd' : 'Kopieer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
