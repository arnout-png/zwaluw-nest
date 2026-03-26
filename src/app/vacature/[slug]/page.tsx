import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { JobOpening } from '@/types';
import { ApplyForm } from './apply-form';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

const DEFAULT_BENEFITS = [
  'Competitief salaris conform CAO',
  '25 vakantiedagen + pensioenopbouw',
  'Gezellig team en moderne werkplek',
];

const DEFAULT_PERKS = ['Lease Auto', 'Flexibele Uren', 'Opleidingen', 'Teamuitjes'];

const DEFAULT_IMPACT = 'Word onderdeel van een gespecialiseerd team dat senioren dagelijks helpt met hun veiligheid en comfort.';

export default async function ApplyDetailPage({ params }: Props) {
  const { slug } = await params;

  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .select('id, slug, title, description, requirements, location, hoursPerWeek, salaryRange, imageUrl, benefits, perks, impact, isActive')
    .eq('slug', slug)
    .eq('isActive', true)
    .single();

  if (error || !data) {
    notFound();
  }

  const job = data as unknown as JobOpening;
  const requirements = job.requirements
    ? job.requirements.split('\n').filter(Boolean).map((r) => r.replace(/^[-•*]\s*/, ''))
    : [];

  const benefits = job.benefits
    ? job.benefits.split('\n').filter(Boolean)
    : DEFAULT_BENEFITS;

  const perks = job.perks
    ? job.perks.split(',').map((p) => p.trim()).filter(Boolean)
    : DEFAULT_PERKS;

  const impact = job.impact ?? DEFAULT_IMPACT;

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex items-center overflow-hidden bg-[#fbf9f8] py-10 md:py-14">
        {/* Background blobs */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#196961] rounded-full blur-[120px] opacity-[0.07]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#f7a247] rounded-full blur-[100px] opacity-[0.07]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center relative z-10 w-full">
          {/* Text */}
          <div className="order-2 md:order-1">
            <div className="inline-block px-3 py-1 bg-[#a7f0e5] text-[#00413b] text-[0.75rem] font-bold tracking-widest uppercase mb-5 rounded-full">
              Vacature openstaand
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1b1c1c] leading-tight mb-4">
              {job.title.split(' ').length > 2
                ? <>
                    {job.title.split(' ').slice(0, -1).join(' ')}{' '}
                    <span className="text-[#196961]">{job.title.split(' ').slice(-1)}</span>
                  </>
                : <span className="text-[#196961]">{job.title}</span>}
            </h1>
            <p className="text-base md:text-lg text-[#3f4947] max-w-lg mb-6 leading-relaxed">
              {job.description.slice(0, 180)}{job.description.length > 180 ? '…' : ''}
            </p>

            {/* Meta pills */}
            {(job.location || job.hoursPerWeek || job.salaryRange) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {job.location && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#f0eded] px-3 py-1 text-xs text-[#3f4947]">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {job.location}
                  </span>
                )}
                {job.hoursPerWeek && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#f0eded] px-3 py-1 text-xs text-[#3f4947]">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {job.hoursPerWeek} uur
                  </span>
                )}
                {job.salaryRange && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#ffdcbf] px-3 py-1 text-xs text-[#703f00] font-medium">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    € {job.salaryRange}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <a
                href="#solliciteren"
                className="bg-[#196961] text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 shadow-lg shadow-[#196961]/20 hover:bg-[#145a54] transition-colors"
              >
                Bekijk vacature
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </a>
              <div className="flex items-center gap-3 px-4 py-3 bg-[#f6f3f2] rounded-lg">
                <svg className="h-5 w-5 text-[#196961]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-sm font-medium text-[#1b1c1c]">Veiliger douchen begint hier</span>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="order-1 md:order-2">
            <div className="relative rounded-2xl overflow-hidden aspect-[16/10] shadow-xl bg-[#e4e2e1]">
              {job.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={job.imageUrl}
                  alt={job.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#196961]/20 to-[#68b0a6]/30 flex items-center justify-center">
                  <svg className="h-20 w-20 text-[#196961]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Details ───────────────────────────────────────────────────────── */}
      <section className="py-16 bg-[#f6f3f2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-10">

            {/* Left: Wat wij zoeken */}
            <div className="md:w-1/3">
              <h2 className="text-2xl font-bold tracking-tight text-[#196961] mb-3">Wat wij zoeken</h2>
              <p className="text-[#3f4947] leading-relaxed mb-6 text-sm">
                {job.description.slice(0, 200)}{job.description.length > 200 ? '…' : ''}
              </p>
              {requirements.length > 0 ? (
                <div className="space-y-3">
                  {requirements.map((req, i) => (
                    <div key={i} className="p-3 bg-white rounded-xl flex items-start gap-4 hover:bg-[#fbf9f8] transition-colors">
                      <svg className="h-5 w-5 text-[#8b5000] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-[#1b1c1c]">{req}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-xl flex items-start gap-4">
                    <svg className="h-5 w-5 text-[#8b5000] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-bold text-[#1b1c1c] text-sm">MBO+ werk- en denkniveau</p>
                      <p className="text-[10px] text-[#3f4947]">Affiniteit met administratie en planning.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-xl flex items-start gap-4">
                    <svg className="h-5 w-5 text-[#8b5000] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-bold text-[#1b1c1c] text-sm">Klantvriendelijke instelling</p>
                      <p className="text-[10px] text-[#3f4947]">Senioren te woord staan met geduld en zorg.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Benefits grid */}
            <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Wat we bieden */}
              <div className="bg-white p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                  <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-3 text-[#1b1c1c]">Wat we bieden</h3>
                <ul className="space-y-2">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-[#3f4947]">
                      <span className="w-1.5 h-1.5 bg-[#196961] rounded-full shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Extra Perks */}
              <div className="bg-[#196961] p-6 rounded-2xl text-white">
                <h3 className="text-lg font-bold mb-3">Extra Perks</h3>
                <div className="flex flex-wrap gap-2">
                  {perks.map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-bold tracking-widest uppercase">
                      {p}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-[11px] opacity-80 italic">
                  &ldquo;Samen maken we senioren blij door hun veiligheid en comfort te vergroten.&rdquo;
                </p>
              </div>

              {/* Jouw dagelijkse impact */}
              <div className="sm:col-span-2 bg-[#eae8e7] p-6 rounded-2xl border border-[#bec9c6]/20">
                <h3 className="text-lg font-bold mb-4 text-[#1b1c1c]">Jouw dagelijkse impact</h3>
                <div className="relative pl-6 border-l-2 border-[#68b0a6]">
                  <span className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full bg-[#196961] border-4 border-[#eae8e7]" />
                  <p className="text-[#3f4947] text-sm leading-relaxed whitespace-pre-line">{impact}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Application form ─────────────────────────────────────────────── */}
      <section className="py-16 bg-[#fbf9f8]" id="solliciteren">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3 text-[#1b1c1c]">Direct Solliciteren</h2>
            <p className="text-sm text-[#3f4947]">
              Vul het formulier in en we nemen binnen 48 uur contact met je op.
            </p>
          </div>
          <div className="bg-[#f6f3f2] p-6 md:p-10 rounded-3xl shadow-sm">
            <ApplyForm jobId={job.id} jobTitle={job.title} slug={job.slug} />
          </div>
        </div>
      </section>

      {/* ── Website preview ──────────────────────────────────────────────── */}
      <section className="py-16 bg-[#f6f3f2] border-t border-[#bec9c6]/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-[#8b5000] font-bold text-xs uppercase tracking-widest mb-3 block">
                Ontdek onze wereld
              </span>
              <h2 className="text-3xl font-bold mb-4 text-[#1b1c1c]">Bezoek onze website</h2>
              <p className="text-[#3f4947] text-base mb-6 leading-relaxed">
                Wil je zien wat we voor onze klanten betekenen? Neem een kijkje op{' '}
                <span className="font-bold text-[#196961]">veiligdouchen.nl</span> en ontdek onze
                innovatieve sanitair-oplossingen voor senioren.
              </p>
              <a
                href="https://veiligdouchen.nl"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-[#196961] font-bold hover:gap-5 transition-all text-sm"
              >
                Ga naar veiligdouchen.nl
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-tr from-[#196961] to-[#8b5000] rounded-[2rem] opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#bec9c6]/20">
                {/* Browser chrome */}
                <div className="bg-[#eae8e7] px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                  <div className="mx-auto bg-[#f6f3f2] px-6 py-1 rounded-full text-[9px] text-[#3f4947] flex items-center gap-2">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    veiligdouchen.nl
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://image.thum.io/get/width/1200/https://veiligdouchen.nl"
                  alt="veiligdouchen.nl website preview"
                  className="w-full aspect-video object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
