'use client';

import { useState, useRef } from 'react';

interface Props {
  jobId: string;
  jobTitle: string;
  slug: string;
}

export function ApplyForm({ jobId, jobTitle, slug }: Props) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    postalCode: '',
    city: '',
    linkedinUrl: '',
    cvUrl: '',
    motivation: '',
    availableFrom: '',
    salaryExpectation: '',
    consent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [cvUploading, setCvUploading] = useState(false);
  const [cvFileName, setCvFileName] = useState('');
  const cvInputRef = useRef<HTMLInputElement>(null);

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/apply/upload-cv', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'CV uploaden mislukt.'); return; }
      setForm((prev) => ({ ...prev, cvUrl: json.url }));
      setCvFileName(file.name);
    } finally {
      setCvUploading(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consent) {
      setError('Je moet akkoord gaan met de privacyverklaring om te solliciteren.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/apply/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, jobId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Versturen mislukt. Probeer het opnieuw.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Er is een fout opgetreden. Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full bg-white border-none rounded-lg p-3 focus:ring-2 focus:ring-[#196961]/20 transition-all text-sm outline-none placeholder:text-[#6f7977] text-[#1b1c1c]';
  const labelCls =
    'text-[0.65rem] font-bold uppercase tracking-wider text-[#3f4947] px-1';

  if (submitted) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#196961]/10">
          <svg className="h-8 w-8 text-[#196961]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-[#1b1c1c]">Bedankt voor je sollicitatie!</h3>
        <p className="text-[#3f4947] max-w-md mx-auto">
          We hebben je aanmelding voor <strong>{jobTitle}</strong> ontvangen. Een van onze
          recruiters neemt zo snel mogelijk contact met je op.
        </p>
        <p className="text-sm text-[#6f7977]">
          Heb je vragen? Neem dan contact op via onze website.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-5">

      {/* Naam */}
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label className={labelCls}>Voornaam *</label>
        <input
          type="text"
          required
          value={form.firstName}
          onChange={(e) => update('firstName', e.target.value)}
          placeholder="Jan"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label className={labelCls}>Achternaam *</label>
        <input
          type="text"
          required
          value={form.lastName}
          onChange={(e) => update('lastName', e.target.value)}
          placeholder="de Vries"
          className={inputCls}
        />
      </div>

      {/* Contact */}
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label className={labelCls}>E-mailadres *</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="jan@voorbeeld.nl"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label className={labelCls}>Telefoonnummer</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="06 12345678"
          className={inputCls}
        />
      </div>

      {/* Adres */}
      <div className="md:col-span-4 flex flex-col gap-1.5">
        <label className={labelCls}>Straat & Huisnummer</label>
        <input
          type="text"
          value={form.street}
          onChange={(e) => update('street', e.target.value)}
          placeholder="Hoofdstraat 1"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-2 flex flex-col gap-1.5">
        <label className={labelCls}>Postcode</label>
        <input
          type="text"
          value={form.postalCode}
          onChange={(e) => update('postalCode', e.target.value)}
          placeholder="1234 AB"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label className={labelCls}>Woonplaats</label>
        <input
          type="text"
          value={form.city}
          onChange={(e) => update('city', e.target.value)}
          placeholder="Amsterdam"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <label className={labelCls}>Beschikbaar per</label>
        <input
          type="date"
          value={form.availableFrom}
          onChange={(e) => update('availableFrom', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* LinkedIn */}
      <div className="md:col-span-4 flex flex-col gap-1.5">
        <label className={labelCls}>LinkedIn profiel</label>
        <input
          type="url"
          value={form.linkedinUrl}
          onChange={(e) => update('linkedinUrl', e.target.value)}
          placeholder="https://linkedin.com/in/jouw-naam"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-2 flex flex-col gap-1.5">
        <label className={labelCls}>Salariswens (€)</label>
        <input
          type="number"
          min={0}
          placeholder="bijv. 3000"
          value={form.salaryExpectation}
          onChange={(e) => update('salaryExpectation', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* CV */}
      <div className="md:col-span-6 flex flex-col gap-1.5">
        <label className={labelCls}>CV uploaden</label>
        <input
          ref={cvInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleCvUpload}
        />
        {form.cvUrl ? (
          <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3">
            <svg className="h-5 w-5 text-[#196961] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-[#1b1c1c] flex-1 truncate">{cvFileName}</span>
            <button
              type="button"
              onClick={() => { setForm((p) => ({ ...p, cvUrl: '' })); setCvFileName(''); }}
              className="text-xs text-[#6f7977] hover:text-red-500 transition-colors shrink-0"
            >
              Verwijderen
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => cvInputRef.current?.click()}
            disabled={cvUploading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed border-[#bec9c6] bg-white px-4 py-5 text-sm text-[#6f7977] hover:border-[#196961] hover:text-[#1b1c1c] transition-colors disabled:opacity-50"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {cvUploading ? 'Uploaden...' : 'CV uploaden (PDF, Word — max 10 MB)'}
          </button>
        )}
      </div>

      {/* Motivatie */}
      <div className="md:col-span-6 flex flex-col gap-1.5">
        <label className={labelCls}>Motivatie</label>
        <textarea
          rows={5}
          value={form.motivation}
          onChange={(e) => update('motivation', e.target.value)}
          placeholder="Waarom ben jij de perfecte kandidaat? Vertel ons kort over je motivatie..."
          className={`${inputCls} resize-y min-h-[140px]`}
        />
      </div>

      {/* Consent */}
      <div className="md:col-span-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => update('consent', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#bec9c6] accent-[#196961]"
          />
          <span className="text-xs text-[#3f4947] leading-relaxed">
            Ik ga akkoord met de verwerking van mijn persoonsgegevens conform de{' '}
            <span className="text-[#196961]">privacyverklaring</span> van Veilig Douchen.
            Mijn gegevens worden maximaal 1 jaar bewaard. *
          </span>
        </label>
      </div>

      {error && (
        <p className="md:col-span-6 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="md:col-span-6 mt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#8b5000] text-white font-bold py-4 rounded-lg hover:bg-[#703f00] transition-colors shadow-lg shadow-[#8b5000]/10 disabled:opacity-60"
        >
          {submitting ? 'Versturen…' : 'Verstuur Sollicitatie'}
        </button>
      </div>

    </form>
  );
}
