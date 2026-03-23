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

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#2b2b2b] focus:border-[#68b0a6] focus:outline-none';
  const labelCls = 'block text-xs font-medium text-[#363636] mb-1.5';

  if (submitted) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#68b0a6]/10">
          <svg className="h-7 w-7 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-poppins text-xl font-semibold text-[#2b2b2b]">Bedankt voor je sollicitatie!</h3>
        <p className="text-[#363636]">
          We hebben je aanmelding voor <strong>{jobTitle}</strong> ontvangen. Een van onze recruiters neemt zo snel mogelijk contact met je op.
        </p>
        <p className="text-sm text-[#9ca3af]">
          Heb je vragen? Neem dan contact op via onze website.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
      <h3 className="font-poppins text-lg font-semibold text-[#2b2b2b] mb-5">Direct solliciteren</h3>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Voornaam *</label>
            <input type="text" required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Achternaam *</label>
            <input type="text" required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>E-mailadres *</label>
            <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefoonnummer</label>
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className={labelCls}>Straat + huisnummer</label>
          <input type="text" value={form.street} onChange={(e) => update('street', e.target.value)} placeholder="bijv. Hoofdstraat 12" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Postcode</label>
            <input type="text" value={form.postalCode} onChange={(e) => update('postalCode', e.target.value)} placeholder="bijv. 3011 AA" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Woonplaats</label>
            <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="bijv. Rotterdam" className={inputCls} />
          </div>
        </div>

        {/* LinkedIn */}
        <div>
          <label className={labelCls}>LinkedIn profiel</label>
          <input
            type="url"
            value={form.linkedinUrl}
            onChange={(e) => update('linkedinUrl', e.target.value)}
            placeholder="https://linkedin.com/in/jouw-naam"
            className={inputCls}
          />
        </div>

        {/* CV upload */}
        <div>
          <label className={labelCls}>CV uploaden</label>
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleCvUpload}
          />
          {form.cvUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
              <svg className="h-5 w-5 text-[#68b0a6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-[#2b2b2b] flex-1 truncate">{cvFileName}</span>
              <button
                type="button"
                onClick={() => { setForm((p) => ({ ...p, cvUrl: '' })); setCvFileName(''); }}
                className="text-xs text-[#9ca3af] hover:text-red-500 transition-colors shrink-0"
              >
                Verwijderen
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => cvInputRef.current?.click()}
              disabled={cvUploading}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-[#9ca3af] hover:border-[#68b0a6] hover:text-[#363636] transition-colors disabled:opacity-50"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {cvUploading ? 'Uploaden...' : 'CV uploaden (PDF, Word, JPG — max 10 MB)'}
            </button>
          )}
        </div>

        {/* Availability + salary */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Beschikbaar per</label>
            <input type="date" value={form.availableFrom} onChange={(e) => update('availableFrom', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Salariswens (€)</label>
            <input type="number" min={0} placeholder="bijv. 3000" value={form.salaryExpectation} onChange={(e) => update('salaryExpectation', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Motivation */}
        <div>
          <label className={labelCls}>Motivatie</label>
          <textarea
            rows={4}
            value={form.motivation}
            onChange={(e) => update('motivation', e.target.value)}
            placeholder="Waarom wil je bij ons werken?"
            className={`${inputCls} resize-y`}
          />
        </div>

        {/* Consent */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => update('consent', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-200 accent-[#68b0a6]"
          />
          <span className="text-xs text-[#363636] leading-relaxed">
            Ik ga akkoord met de verwerking van mijn persoonsgegevens conform de{' '}
            <span className="text-[#68b0a6]">privacyverklaring</span> van Veilig Douchen.
            Mijn gegevens worden maximaal 1 jaar bewaard. *
          </span>
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-[#f7a247] py-3 text-sm font-semibold text-white hover:bg-[#e5932e] disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Versturen...' : 'Sollicitatie versturen →'}
        </button>
      </form>
    </div>
  );
}
