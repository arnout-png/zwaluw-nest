'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Candidate } from '@/types';

const LEAD_SOURCE_OPTIONS = [
  { value: '', label: '— Geen —' },
  { value: 'FACEBOOK', label: 'Facebook Ads' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'INDEED', label: 'Indeed' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'GOOGLE', label: 'Google' },
  { value: 'MANUAL', label: 'Handmatig' },
  { value: 'OTHER', label: 'Overig' },
];

interface Props {
  candidate: Candidate;
}

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age: string;
  location: string;
  livingSituation: string;
  partnerEmployment: string;
  currentJob: string;
  reasonForLeaving: string;
  salaryExpectation: string;
  leadSource: string;
  leadCampaignId: string;
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[#9ca3af] mb-0.5">{label}</dt>
      <dd className="text-sm text-[#e8e9ed]">{value ?? <span className="text-[#9ca3af] italic">—</span>}</dd>
    </div>
  );
}

function Input({ label, name, value, onChange, type = 'text', placeholder }: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#9ca3af] mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? '—'}
        className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white placeholder-[#4a4d60] focus:border-[#68b0a6] focus:outline-none"
      />
    </div>
  );
}

export function CandidatePersonalDetailsClient({ candidate }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<FormData>({
    firstName: candidate.firstName ?? '',
    lastName: candidate.lastName ?? '',
    email: candidate.email ?? '',
    phone: candidate.phone ?? '',
    age: candidate.age ? String(candidate.age) : '',
    location: candidate.location ?? '',
    livingSituation: candidate.livingSituation ?? '',
    partnerEmployment: candidate.partnerEmployment ?? '',
    currentJob: candidate.currentJob ?? '',
    reasonForLeaving: candidate.reasonForLeaving ?? '',
    salaryExpectation: candidate.salaryExpectation ?? '',
    leadSource: candidate.leadSource ?? '',
    leadCampaignId: candidate.leadCampaignId ?? '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleCancel() {
    setForm({
      firstName: candidate.firstName ?? '',
      lastName: candidate.lastName ?? '',
      email: candidate.email ?? '',
      phone: candidate.phone ?? '',
      age: candidate.age ? String(candidate.age) : '',
      location: candidate.location ?? '',
      livingSituation: candidate.livingSituation ?? '',
      partnerEmployment: candidate.partnerEmployment ?? '',
      currentJob: candidate.currentJob ?? '',
      reasonForLeaving: candidate.reasonForLeaving ?? '',
      salaryExpectation: candidate.salaryExpectation ?? '',
      leadSource: candidate.leadSource ?? '',
      leadCampaignId: candidate.leadCampaignId ?? '',
    });
    setEditing(false);
    setError('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || null,
          age: form.age ? Number(form.age) : null,
          location: form.location || null,
          livingSituation: form.livingSituation || null,
          partnerEmployment: form.partnerEmployment || null,
          currentJob: form.currentJob || null,
          reasonForLeaving: form.reasonForLeaving || null,
          salaryExpectation: form.salaryExpectation || null,
          leadSource: form.leadSource || null,
          leadCampaignId: form.leadCampaignId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Opslaan mislukt.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Verbinding mislukt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Persoonlijke gegevens</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white hover:border-[#68b0a6] transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bewerken
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-[#363848] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#68b0a6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-400">{error}</p>
      )}

      {!editing ? (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Voornaam" value={candidate.firstName} />
          <Field label="Achternaam" value={candidate.lastName} />
          <Field label="E-mailadres" value={candidate.email} />
          <Field label="Telefoon" value={candidate.phone} />
          <Field label="Leeftijd" value={candidate.age ? `${candidate.age} jaar` : null} />
          <Field label="Woonplaats" value={candidate.location} />
          <Field label="Woonsituatie" value={candidate.livingSituation} />
          <Field label="Partner werkt" value={candidate.partnerEmployment} />
          <Field label="Huidige baan" value={candidate.currentJob} />
          <Field label="Reden van vertrek" value={candidate.reasonForLeaving} />
          <Field label="Salarisverwachting" value={candidate.salaryExpectation ? `€${candidate.salaryExpectation}` : null} />
          <Field label="Lead bron" value={candidate.leadSource} />
          <Field label="Campagne ID" value={candidate.leadCampaignId} />
          <Field
            label="AVG toestemming"
            value={
              candidate.consentGiven
                ? `Gegeven op ${candidate.consentDate
                    ? new Date(candidate.consentDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'onbekende datum'}`
                : 'Niet gegeven'
            }
          />
        </dl>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Voornaam" name="firstName" value={form.firstName} onChange={handleChange} />
          <Input label="Achternaam" name="lastName" value={form.lastName} onChange={handleChange} />
          <Input label="E-mailadres" name="email" value={form.email} onChange={handleChange} type="email" />
          <Input label="Telefoon" name="phone" value={form.phone} onChange={handleChange} type="tel" placeholder="+31 6 12345678" />
          <Input label="Leeftijd" name="age" value={form.age} onChange={handleChange} type="number" placeholder="bijv. 32" />
          <Input label="Woonplaats" name="location" value={form.location} onChange={handleChange} placeholder="bijv. Oss" />
          <Input label="Woonsituatie" name="livingSituation" value={form.livingSituation} onChange={handleChange} placeholder="bijv. Samenwonend" />
          <Input label="Partner werkt" name="partnerEmployment" value={form.partnerEmployment} onChange={handleChange} placeholder="bijv. Ja, fulltime" />
          <Input label="Huidige baan" name="currentJob" value={form.currentJob} onChange={handleChange} placeholder="bijv. Loodgieter" />
          <Input label="Reden van vertrek" name="reasonForLeaving" value={form.reasonForLeaving} onChange={handleChange} placeholder="bijv. Meer uitdaging" />
          <Input label="Salarisverwachting (€)" name="salaryExpectation" value={form.salaryExpectation} onChange={handleChange} type="number" placeholder="bijv. 3500" />
          <div>
            <label className="block text-xs font-medium text-[#9ca3af] mb-1">Lead bron</label>
            <select
              name="leadSource"
              value={form.leadSource}
              onChange={handleChange}
              className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2 text-sm text-white focus:border-[#68b0a6] focus:outline-none"
            >
              {LEAD_SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Input label="Campagne ID" name="leadCampaignId" value={form.leadCampaignId} onChange={handleChange} placeholder="bijv. fb_monteur_2026" />
        </div>
      )}
    </div>
  );
}
