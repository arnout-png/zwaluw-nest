'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Step = 'loading' | 'form' | 'done' | 'expired' | 'error';

export default function NummerCorrigerenPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/phone-correct/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) { setFirstName(data.firstName ?? ''); setStep('form'); return; }
        if (data.error === 'expired') { setStep('expired'); return; }
        setStep('error');
      })
      .catch(() => setStep('error'));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 8) {
      setFormError('Vul een geldig telefoonnummer in.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/phone-correct/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Er ging iets mis.');
        setSubmitting(false);
        return;
      }
      setStep('done');
    } catch {
      setFormError('Verbindingsfout. Probeer het opnieuw.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1e2028', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#252732', borderRadius: 12, border: '1px solid #363848', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#14151b', padding: '20px 32px', borderBottom: '1px solid #363848', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'rgba(104,176,166,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            <span role="img" aria-label="bird">&#x1F426;</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>ZwaluwNest</div>
            <div style={{ color: '#68b0a6', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const }}>Veilig Douchen</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 32 }}>
          {step === 'loading' && (
            <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>Laden...</p>
          )}

          {step === 'form' && (
            <>
              <h1 style={{ color: '#fff', fontSize: 20, margin: '0 0 8px', fontWeight: 600 }}>
                Telefoonnummer corrigeren
              </h1>
              <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 24px' }}>
                Hoi {firstName}, vul hieronder je correcte telefoonnummer in.
              </p>

              <form onSubmit={handleSubmit}>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 6 }}>
                  Telefoonnummer
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12345678"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#1e2028',
                    border: '1px solid #363848',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box' as const,
                  }}
                />

                {formError && (
                  <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{formError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 20,
                    padding: '12px 24px',
                    background: submitting ? '#4a8a82' : '#68b0a6',
                    color: '#14151b',
                    fontSize: 14,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 8,
                    cursor: submitting ? 'default' : 'pointer',
                  }}
                >
                  {submitting ? 'Verzenden...' : 'Nummer opslaan'}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2705;</div>
              <h1 style={{ color: '#fff', fontSize: 20, margin: '0 0 8px', fontWeight: 600 }}>
                Bedankt, {firstName}!
              </h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>
                Je telefoonnummer is bijgewerkt. We nemen snel contact met je op.
              </p>
            </div>
          )}

          {step === 'expired' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#x23F3;</div>
              <h1 style={{ color: '#fff', fontSize: 20, margin: '0 0 8px', fontWeight: 600 }}>
                Link verlopen
              </h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>
                Deze link is niet meer geldig. Neem contact op met ons via e-mail.
              </p>
            </div>
          )}

          {step === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#x26A0;&#xFE0F;</div>
              <h1 style={{ color: '#fff', fontSize: 20, margin: '0 0 8px', fontWeight: 600 }}>
                Ongeldige link
              </h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>
                Deze link is niet geldig of al gebruikt.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: '#1e2028', padding: '16px 32px', borderTop: '1px solid #363848', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>
            Veilig Douchen &mdash; Zwaluw Comfortsanitair
          </p>
        </div>
      </div>
    </div>
  );
}
