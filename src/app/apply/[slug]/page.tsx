import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { JobOpening } from '@/types';
import { ApplyForm } from './apply-form';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

const USP_ITEMS = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Eigen monteursteam',
    text: 'We werken uitsluitend met eigen, gecertificeerde monteurs — geen onderaannemers.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    title: 'Zinvol werk',
    text: 'Jij helpt mensen thuis te blijven wonen. Elke dag maak jij een concreet verschil.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Groeiend bedrijf',
    text: 'Opgericht in 2019 en sindsdien flink gegroeid — er is volop ruimte voor jouw ambitie.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    title: 'Volledig ontzorgd',
    text: 'Van ontwerp tot nazorg — wij bieden een compleet service concept aan onze klanten.',
  },
];

export default async function ApplyDetailPage({ params }: Props) {
  const { slug } = await params;

  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .select('id, slug, title, description, requirements, location, hoursPerWeek, salaryRange, imageUrl, isActive')
    .eq('slug', slug)
    .eq('isActive', true)
    .single();

  if (error || !data) {
    notFound();
  }

  const job = data as unknown as JobOpening;

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#3A4141]" style={{ minHeight: '260px' }}>
        {job.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={job.imageUrl}
            alt={job.title}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: 0.35 }}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#3A4141]/80 via-[#3A4141]/50 to-transparent" />

        <div className="relative mx-auto max-w-5xl px-6 py-14">
          <div className="max-w-xl">
            <span className="inline-block rounded-full bg-[#68b0a6]/20 border border-[#68b0a6]/40 px-3 py-0.5 text-xs font-medium text-[#68b0a6] mb-3">
              Veilig Douchen — Open vacature
            </span>
            <h1 className="font-poppins text-3xl font-bold text-white leading-tight">{job.title}</h1>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              {job.location && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
              )}
              {job.hoursPerWeek && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {job.hoursPerWeek} uur
                </span>
              )}
              {job.salaryRange && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#f7a247]/20 border border-[#f7a247]/30 px-3 py-1 text-xs text-[#f7a247]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  € {job.salaryRange}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">

          {/* ── Left column ─────────────────────────────────────────── */}
          <div className="space-y-10">

            {/* Job description */}
            <section>
              <h2 className="font-poppins text-lg font-semibold text-[#2b2b2b] mb-4 flex items-center gap-2">
                <span className="h-1 w-5 rounded-full bg-[#68b0a6] inline-block" />
                Over de functie
              </h2>
              <div className="text-[#363636] leading-relaxed text-sm whitespace-pre-wrap">
                {job.description}
              </div>
            </section>

            {/* Requirements */}
            {job.requirements && (
              <section>
                <h2 className="font-poppins text-lg font-semibold text-[#2b2b2b] mb-4 flex items-center gap-2">
                  <span className="h-1 w-5 rounded-full bg-[#68b0a6] inline-block" />
                  Wat we zoeken
                </h2>
                <ul className="space-y-2.5">
                  {job.requirements.split('\n').filter(Boolean).map((req, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#363636]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f7a247]" />
                      <span>{req.replace(/^[-•*]\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── About us ──────────────────────────────────────────── */}
            <section className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="h-10 w-10 rounded-xl bg-[#3A4141] flex items-center justify-center shrink-0">
                  <svg className="h-5 w-5 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-poppins text-lg font-semibold text-[#2b2b2b]">Werken bij Veilig Douchen</h2>
                  <p className="text-xs text-[#9ca3af]">Onderdeel van Zwaluw Comfortsanitair</p>
                </div>
              </div>

              <p className="text-sm text-[#363636] leading-relaxed mb-5">
                Bij Veilig Douchen helpen we mensen zo lang mogelijk zelfstandig thuis te blijven wonen.
                We installeren comfortdouches, lopen-in-douches en complete badkamerrenovaties —
                altijd op maat, altijd met oog voor veiligheid, comfort én design.
                Opgericht in 2019 en sindsdien uitgegroeid tot een landelijk werkend team van enthousiaste vakmensen.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {USP_ITEMS.map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-xl bg-white border border-gray-100 p-3.5">
                    <span className="mt-0.5 text-[#68b0a6] shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-[#2b2b2b]">{item.title}</p>
                      <p className="text-xs text-[#6b7280] leading-relaxed mt-0.5">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* ── Right column: form ──────────────────────────────────── */}
          <div className="lg:sticky lg:top-8 self-start">
            <ApplyForm jobId={job.id} jobTitle={job.title} slug={job.slug} />
          </div>

        </div>
      </div>
    </div>
  );
}
