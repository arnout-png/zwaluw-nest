'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { trackApplicationSubmit, readCookie, makeEventId } from '@/lib/meta-pixel';
import { readAttribution } from '@/lib/attribution';

interface Props {
  jobId: string;
  jobTitle: string;
  slug: string;
  privacyUrl: string;
}

const MAX_CV_BYTES = 10 * 1024 * 1024;
const CV_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
const CV_CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  motivation: string;
  consent: boolean;
  website: string; // honeypot — blijft leeg voor mensen
};

/** Leest een JSON-antwoord zonder te crashen op een HTML-foutpagina. */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function ApplyForm({ jobId, jobTitle, slug, privacyUrl }: Props) {
  const uid = useId();
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    postalCode: '',
    city: '',
    motivation: '',
    consent: false,
    website: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ confirmationEmail: boolean } | null>(null);
  const [error, setError] = useState('');
  const [cvRef, setCvRef] = useState('');
  const [cvFileName, setCvFileName] = useState('');
  const [cvUploading, setCvUploading] = useState(false);
  const [cvError, setCvError] = useState('');
  const cvInputRef = useRef<HTMLInputElement>(null);
  const mountedAt = useRef<number | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (submitted) successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [submitted]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (cvInputRef.current) cvInputRef.current.value = '';
    if (!file) return;
    setCvError('');

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!CV_EXTENSIONS.includes(ext)) {
      setCvError('Dit bestandstype wordt niet ondersteund. Upload een PDF, Word-bestand of foto (JPG/PNG).');
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      setCvError('Je cv is groter dan 10 MB. Probeer een PDF of een kleinere foto.');
      return;
    }

    setCvUploading(true);
    try {
      // 1. Eenmalige upload-URL voor de privé-opslag ophalen.
      const res = await fetch('/api/apply/upload-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      });
      const json = await readJson(res);
      if (!res.ok || typeof json.signedUrl !== 'string' || typeof json.ref !== 'string') {
        setCvError((json.error as string) ?? 'Uploaden mislukt. Je kunt ook zonder cv solliciteren.');
        return;
      }

      // 2. Bestand rechtstreeks naar de opslag (niet via onze server: die
      //    weigert bestanden groter dan ~4,5 MB).
      const data = new FormData();
      data.append('cacheControl', '3600');
      data.append('', new Blob([file], { type: file.type || CV_CONTENT_TYPES[ext] }), file.name);
      // Zelfde headers als supabase-js' uploadToSignedUrl (de anon key is publiek).
      const headers: Record<string, string> = { 'x-upsert': 'false' };
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (anonKey) {
        headers.apikey = anonKey;
        headers.Authorization = `Bearer ${anonKey}`;
      }
      const put = await fetch(json.signedUrl, { method: 'PUT', body: data, headers });
      if (!put.ok) {
        setCvError('Uploaden mislukt. Probeer het nog eens, of solliciteer zonder cv — we vragen er later om.');
        return;
      }

      setCvRef(json.ref);
      setCvFileName(file.name);
    } catch {
      setCvError('Uploaden mislukt (geen verbinding?). Probeer het nog eens of solliciteer zonder cv.');
    } finally {
      setCvUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');

    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 15) {
      setError('Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678.');
      return;
    }
    if (!form.consent) {
      setError('Geef toestemming voor het verwerken van je gegevens om te kunnen solliciteren.');
      return;
    }
    if (cvUploading) {
      setError('Even geduld: je cv wordt nog geüpload.');
      return;
    }

    setSubmitting(true);

    // Eén id voor beide kanalen: de browser-Pixel hieronder en het serverevent
    // dat de API naar de Conversions API stuurt. Meta dedupliceert erop.
    const eventId = makeEventId();

    try {
      const res = await fetch(`/api/apply/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cvRef: cvRef || undefined,
          jobId,
          eventId,
          elapsedMs: mountedAt.current ? Date.now() - mountedAt.current : undefined,
          // Herkomst: vastgelegd op de landingspagina, ook als de bezoeker
          // daarna nog doorklikte (utm-tags staan dan niet meer in de URL).
          attribution: readAttribution() ?? undefined,
          fbp: readCookie('_fbp'),
          fbc: readCookie('_fbc'),
          fbclid: new URLSearchParams(window.location.search).get('fbclid'),
          sourceUrl: window.location.origin + window.location.pathname,
        }),
      });
      const json = await readJson(res);
      if (!res.ok) {
        setError((json.error as string) ?? 'Versturen mislukt. Controleer je verbinding en probeer het opnieuw.');
        return;
      }
      setSubmitted({ confirmationEmail: json.confirmationEmail === true });
      // Meta-conversie: sollicitatie succesvol verzonden (SubmitApplication).
      trackApplicationSubmit(eventId, jobTitle);
    } catch {
      setError('Versturen mislukt — controleer je internetverbinding en probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  }

  // text-base op mobiel: iOS zoomt in op velden met een kleinere letter.
  const inputCls =
    'w-full bg-white border border-transparent rounded-lg p-3 focus:border-[#196961]/40 focus:ring-2 focus:ring-[#196961]/20 transition-all text-base md:text-sm outline-none placeholder:text-[#a3acaa] text-[#1b1c1c]';
  const labelCls = 'text-[0.7rem] font-bold uppercase tracking-wider text-[#3f4947] px-1';
  const id = (name: string) => `${uid}-${name}`;

  if (submitted) {
    return (
      <div ref={successRef} className="py-12 text-center space-y-4" role="status" aria-live="polite">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#196961]/10">
          <svg className="h-8 w-8 text-[#196961]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-[#1b1c1c]">Bedankt voor je sollicitatie!</h3>
        <p className="text-[#3f4947] max-w-md mx-auto">
          We hebben je sollicitatie als <strong>{jobTitle}</strong> ontvangen. We bellen je binnen
          twee werkdagen voor een kort kennismakingsgesprek.
        </p>
        {submitted.confirmationEmail && (
          <p className="text-sm text-[#6f7977] max-w-md mx-auto">
            Je ontvangt binnen een paar minuten een bevestiging per e-mail. Niets ontvangen? Kijk dan
            even in je spam-map.
          </p>
        )}
        <p className="text-sm text-[#6f7977]">
          Vragen? Mail naar{' '}
          <a href="mailto:info@veiligdouchen.nl" className="text-[#196961] underline">info@veiligdouchen.nl</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative grid grid-cols-1 md:grid-cols-6 gap-5">
      {/* Honeypot: onzichtbaar voor mensen, bots vullen het in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label htmlFor={id('website')}>Laat dit veld leeg</label>
        <input
          id={id('website')}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => update('website', e.target.value)}
        />
      </div>

      {/* Naam */}
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label htmlFor={id('firstName')} className={labelCls}>Voornaam *</label>
        <input
          id={id('firstName')}
          name="given-name"
          type="text"
          required
          maxLength={80}
          autoComplete="given-name"
          autoCapitalize="words"
          value={form.firstName}
          onChange={(e) => update('firstName', e.target.value)}
          placeholder="bijv. Jan"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label htmlFor={id('lastName')} className={labelCls}>Achternaam *</label>
        <input
          id={id('lastName')}
          name="family-name"
          type="text"
          required
          maxLength={120}
          autoComplete="family-name"
          autoCapitalize="words"
          value={form.lastName}
          onChange={(e) => update('lastName', e.target.value)}
          placeholder="bijv. de Vries"
          className={inputCls}
        />
      </div>

      {/* Contact */}
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label htmlFor={id('email')} className={labelCls}>E-mailadres *</label>
        <input
          id={id('email')}
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="jan@voorbeeld.nl"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label htmlFor={id('phone')} className={labelCls}>Telefoonnummer *</label>
        <input
          id={id('phone')}
          name="tel"
          type="tel"
          required
          maxLength={40}
          autoComplete="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="06 12345678"
          className={inputCls}
        />
      </div>

      {/* Adres */}
      <div className="md:col-span-6 flex flex-col gap-1.5">
        <label htmlFor={id('street')} className={labelCls}>Straat & huisnummer</label>
        <input
          id={id('street')}
          name="street-address"
          type="text"
          maxLength={200}
          autoComplete="street-address"
          value={form.street}
          onChange={(e) => update('street', e.target.value)}
          placeholder="Hoofdstraat 1"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-2 flex flex-col gap-1.5">
        <label htmlFor={id('postalCode')} className={labelCls}>Postcode</label>
        <input
          id={id('postalCode')}
          name="postal-code"
          type="text"
          maxLength={20}
          autoComplete="postal-code"
          autoCapitalize="characters"
          value={form.postalCode}
          onChange={(e) => update('postalCode', e.target.value)}
          placeholder="1234 AB"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-4 flex flex-col gap-1.5">
        <label htmlFor={id('city')} className={labelCls}>Woonplaats</label>
        <input
          id={id('city')}
          name="address-level2"
          type="text"
          maxLength={120}
          autoComplete="address-level2"
          value={form.city}
          onChange={(e) => update('city', e.target.value)}
          placeholder="Zeewolde"
          className={inputCls}
        />
      </div>

      {/* CV */}
      <div className="md:col-span-6 flex flex-col gap-1.5">
        <span className={labelCls}>CV (optioneel)</span>
        <input
          ref={cvInputRef}
          id={id('cv')}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="sr-only"
          onChange={handleCvUpload}
        />
        {cvRef ? (
          <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3">
            <svg className="h-5 w-5 text-[#196961] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-[#1b1c1c] flex-1 truncate">{cvFileName}</span>
            <button
              type="button"
              onClick={() => { setCvRef(''); setCvFileName(''); }}
              className="text-xs text-[#6f7977] hover:text-red-600 transition-colors shrink-0 py-2 px-1"
            >
              Verwijderen
            </button>
          </div>
        ) : (
          <label
            htmlFor={id('cv')}
            className={`flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-[#bec9c6] bg-white px-4 py-5 text-sm text-[#6f7977] hover:border-[#196961] hover:text-[#1b1c1c] transition-colors ${cvUploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {cvUploading ? 'Uploaden…' : 'CV uploaden (PDF, Word of foto — max 10 MB)'}
          </label>
        )}
        {cvError && <p className="text-xs text-red-700 px-1" role="alert">{cvError}</p>}
      </div>

      {/* Motivatie */}
      <div className="md:col-span-6 flex flex-col gap-1.5">
        <label htmlFor={id('motivation')} className={labelCls}>Motivatie (optioneel)</label>
        <textarea
          id={id('motivation')}
          name="motivation"
          rows={5}
          maxLength={5000}
          value={form.motivation}
          onChange={(e) => update('motivation', e.target.value)}
          placeholder="Vertel ons kort waarom deze functie bij je past. Een paar zinnen is genoeg."
          className={`${inputCls} resize-y min-h-[140px]`}
        />
      </div>

      {/* Toestemming (AVG) */}
      <div className="md:col-span-6">
        <label htmlFor={id('consent')} className="flex items-start gap-3 cursor-pointer">
          <input
            id={id('consent')}
            type="checkbox"
            required
            checked={form.consent}
            onChange={(e) => update('consent', e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#bec9c6] accent-[#196961]"
          />
          <span className="text-xs text-[#3f4947] leading-relaxed">
            Ik geef Zwaluw Comfortsanitair toestemming mijn gegevens te gebruiken voor deze sollicitatie, zoals
            beschreven in de{' '}
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="text-[#196961] underline">
              privacyverklaring
            </a>
            . Mijn gegevens worden maximaal 1 jaar bewaard. *
          </span>
        </label>
      </div>

      {error && (
        <p className="md:col-span-6 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <div className="md:col-span-6 mt-2">
        <button
          type="submit"
          disabled={submitting || cvUploading}
          className="w-full bg-[#8b5000] text-white font-bold py-4 rounded-lg hover:bg-[#703f00] transition-colors shadow-lg shadow-[#8b5000]/10 disabled:opacity-60 text-base"
        >
          {submitting ? 'Versturen…' : 'Verstuur sollicitatie'}
        </button>
      </div>
    </form>
  );
}
