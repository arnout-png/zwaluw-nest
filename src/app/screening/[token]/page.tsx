'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Step = 'loading' | 'form' | 'done' | 'expired' | 'error' | 'already_done';

export default function ScreeningPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [firstName, setFirstName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form fields
  const [motivation, setMotivation] = useState('');
  const [experience, setExperience] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [salaryExpectation, setSalaryExpectation] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/screening/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.alreadyDone) { setFirstName(data.firstName ?? ''); setStep('already_done'); return; }
        if (data.valid) { setFirstName(data.firstName ?? ''); setStep('form'); return; }
        if (data.error?.includes('verlopen')) { setStep('expired'); return; }
        setStep('error');
      })
      .catch(() => setStep('error'));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!motivation.trim()) newErrors.motivation = 'Dit veld is verplicht.';
    if (!experience.trim()) newErrors.experience = 'Dit veld is verplicht.';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/screening/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivation, experience, availableFrom, salaryExpectation, extraNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('done');
      } else {
        setErrors({ form: data.error ?? 'Er is een fout opgetreden.' });
      }
    } catch {
      setErrors({ form: 'Verbindingsfout. Controleer je internetverbinding.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1e2028] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#68b0a6]/10">
            <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none">
              <path d="M16 4 C8 4 4 10 4 16 C4 22 8 26 12 24 C14 23 15 21 16 18 C17 21 18 23 20 24 C24 26 28 22 28 16 C28 10 24 4 16 4 Z" fill="#68b0a6" opacity="0.9" />
              <path d="M16 18 C14 14 10 12 6 14 C9 10 14 9 16 12 C18 9 23 10 26 14 C22 12 18 14 16 18 Z" fill="#14151b" opacity="0.7" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Veilig Douchen</div>
            <div className="text-[10px] text-[#68b0a6] font-mono tracking-widest uppercase">Pre-screening</div>
          </div>
        </div>

        {/* Loading */}
        {step === 'loading' && (
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-8 text-center">
            <div className="animate-pulse text-[#9ca3af] text-sm">Formulier laden...</div>
          </div>
        )}

        {/* Already done */}
        {step === 'already_done' && (
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-8 text-center">
            <div className="text-3xl mb-4">✓</div>
            <h1 className="text-xl font-semibold text-white mb-2">Al ingevuld</h1>
            <p className="text-[#9ca3af] text-sm">
              {firstName ? `Hallo ${firstName}, je` : 'Je'} hebt de pre-screening al eerder ingevuld.
              We nemen binnenkort contact met je op.
            </p>
          </div>
        )}

        {/* Expired */}
        {step === 'expired' && (
          <div className="rounded-xl border border-red-500/20 bg-[#252732] p-8 text-center">
            <div className="text-3xl mb-4">⏰</div>
            <h1 className="text-xl font-semibold text-white mb-2">Link verlopen</h1>
            <p className="text-[#9ca3af] text-sm">
              Deze uitnodigingslink is verlopen. Neem contact op met Veilig Douchen om een nieuwe link te ontvangen.
            </p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="rounded-xl border border-red-500/20 bg-[#252732] p-8 text-center">
            <div className="text-3xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-white mb-2">Ongeldige link</h1>
            <p className="text-[#9ca3af] text-sm">
              Deze link is niet geldig. Controleer de link in je e-mail of neem contact op met Veilig Douchen.
            </p>
          </div>
        )}

        {/* Success */}
        {step === 'done' && (
          <div className="rounded-xl border border-[#68b0a6]/30 bg-[#252732] p-8 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h1 className="text-xl font-semibold text-white mb-2">Bedankt, {firstName}!</h1>
            <p className="text-[#9ca3af] text-sm leading-relaxed">
              Je pre-screening is succesvol ingediend. We beoordelen je antwoorden en nemen
              binnen enkele werkdagen contact met je op.
            </p>
            <p className="text-[#68b0a6] text-sm mt-4 font-medium">Veilig Douchen Team</p>
          </div>
        )}

        {/* Form */}
        {step === 'form' && (
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-6 sm:p-8">
            <h1 className="text-xl font-semibold text-white mb-1">
              Hallo{firstName ? ` ${firstName}` : ''}!
            </h1>
            <p className="text-[#9ca3af] text-sm mb-6">
              Vul onderstaand formulier in om je sollicitatie te vervolgen.
              Dit duurt ongeveer 5 minuten.
            </p>

            {errors.form && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 mb-4 text-sm text-red-400">
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Motivatie */}
              <div>
                <label className="block text-sm font-medium text-[#e8e9ed] mb-1.5">
                  Waarom wil je bij Veilig Douchen werken? <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={motivation}
                  onChange={(e) => { setMotivation(e.target.value); setErrors((p) => ({ ...p, motivation: '' })); }}
                  rows={4}
                  className={`w-full rounded-lg border px-3 py-2.5 bg-[#1e2028] text-sm text-[#e8e9ed] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#68b0a6]/50 transition resize-none ${errors.motivation ? 'border-red-500' : 'border-[#363848]'}`}
                  placeholder="Vertel ons over je motivatie..."
                />
                {errors.motivation && <p className="text-red-400 text-xs mt-1">{errors.motivation}</p>}
              </div>

              {/* Werkervaring */}
              <div>
                <label className="block text-sm font-medium text-[#e8e9ed] mb-1.5">
                  Relevante werkervaring <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={experience}
                  onChange={(e) => { setExperience(e.target.value); setErrors((p) => ({ ...p, experience: '' })); }}
                  rows={4}
                  className={`w-full rounded-lg border px-3 py-2.5 bg-[#1e2028] text-sm text-[#e8e9ed] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#68b0a6]/50 transition resize-none ${errors.experience ? 'border-red-500' : 'border-[#363848]'}`}
                  placeholder="Beschrijf je werkervaring (functies, sectoren, vaardigheden)..."
                />
                {errors.experience && <p className="text-red-400 text-xs mt-1">{errors.experience}</p>}
              </div>

              {/* Beschikbaar vanaf */}
              <div>
                <label className="block text-sm font-medium text-[#e8e9ed] mb-1.5">
                  Beschikbaar vanaf
                </label>
                <input
                  type="date"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className="w-full rounded-lg border border-[#363848] px-3 py-2.5 bg-[#1e2028] text-sm text-[#e8e9ed] focus:outline-none focus:ring-2 focus:ring-[#68b0a6]/50 transition"
                />
              </div>

              {/* Salarisverwachting */}
              <div>
                <label className="block text-sm font-medium text-[#e8e9ed] mb-1.5">
                  Salarisverwachting (bruto per maand)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] text-sm">€</span>
                  <input
                    type="number"
                    value={salaryExpectation}
                    onChange={(e) => setSalaryExpectation(e.target.value)}
                    min={0}
                    step={100}
                    className="w-full rounded-lg border border-[#363848] pl-7 pr-3 py-2.5 bg-[#1e2028] text-sm text-[#e8e9ed] focus:outline-none focus:ring-2 focus:ring-[#68b0a6]/50 transition"
                    placeholder="2500"
                  />
                </div>
              </div>

              {/* Extra opmerkingen */}
              <div>
                <label className="block text-sm font-medium text-[#e8e9ed] mb-1.5">
                  Overige opmerkingen
                </label>
                <textarea
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[#363848] px-3 py-2.5 bg-[#1e2028] text-sm text-[#e8e9ed] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#68b0a6]/50 transition resize-none"
                  placeholder="Wil je ons nog iets laten weten?"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#68b0a6] py-3 text-sm font-semibold text-[#14151b] hover:bg-[#7ec4ba] disabled:opacity-50 transition"
              >
                {submitting ? 'Versturen...' : 'Screening indienen →'}
              </button>

              <p className="text-center text-xs text-[#6b7280]">
                Je gegevens worden veilig opgeslagen conform de AVG / GDPR.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
