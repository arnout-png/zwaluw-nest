import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import type { JobOpening } from '@/types';

export const revalidate = 60;

export default async function ApplyListPage() {
  const { data } = await supabaseAdmin
    .from('JobOpening')
    .select('id, slug, title, description, location, hoursPerWeek, salaryRange, imageUrl, isActive')
    .eq('isActive', true)
    .order('createdAt', { ascending: false });

  const jobs = (data ?? []) as unknown as JobOpening[];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 bg-[#fbf9f8]">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#196961] rounded-full blur-[120px] opacity-[0.06]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-block px-3 py-1 bg-[#a7f0e5] text-[#00413b] text-[0.75rem] font-bold tracking-widest uppercase mb-5 rounded-full">
            Werken bij ons
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1b1c1c] mb-4">
            Bouw mee aan <span className="text-[#196961]">veilig wonen</span>
          </h1>
          <p className="text-lg text-[#3f4947] max-w-xl mx-auto leading-relaxed">
            Sluit je aan bij ons team en help senioren zo lang mogelijk zelfstandig thuis te blijven wonen.
            Bekijk onze openstaande functies hieronder.
          </p>
        </div>
      </section>

      {/* Job list */}
      <section className="py-12 bg-[#f6f3f2]">
        <div className="max-w-5xl mx-auto px-6">
          {jobs.length === 0 ? (
            <div className="text-center py-20">
              <div className="mx-auto w-16 h-16 rounded-full bg-[#196961]/10 flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-[#196961]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[#1b1c1c] text-lg font-semibold">Geen openstaande vacatures</p>
              <p className="text-sm text-[#6f7977] mt-2">Kom later terug of stuur een open sollicitatie.</p>
              <a
                href="https://veiligdouchen.nl"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 text-[#196961] font-semibold text-sm hover:underline"
              >
                Bezoek veiligdouchen.nl
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-[#bec9c6]/20"
                >
                  {job.imageUrl ? (
                    <div className="h-44 overflow-hidden bg-[#eae8e7]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={job.imageUrl}
                        alt={job.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-44 bg-gradient-to-br from-[#196961]/10 to-[#68b0a6]/20 flex items-center justify-center">
                      <svg className="h-12 w-12 text-[#196961]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="mb-3 inline-block px-2 py-0.5 bg-[#a7f0e5] text-[#00413b] text-[9px] font-bold tracking-widest uppercase rounded-full">
                      Vacature openstaand
                    </div>
                    <h2 className="text-lg font-bold text-[#1b1c1c] mb-3">{job.title}</h2>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {job.location && (
                        <span className="rounded-full bg-[#f0eded] px-3 py-0.5 text-xs text-[#3f4947] flex items-center gap-1">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {job.location}
                        </span>
                      )}
                      {job.hoursPerWeek && (
                        <span className="rounded-full bg-[#f0eded] px-3 py-0.5 text-xs text-[#3f4947]">
                          {job.hoursPerWeek} uur
                        </span>
                      )}
                      {job.salaryRange && (
                        <span className="rounded-full bg-[#ffdcbf] px-3 py-0.5 text-xs text-[#703f00] font-medium">
                          € {job.salaryRange}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[#3f4947] line-clamp-2 mb-5 leading-relaxed">
                      {job.description}
                    </p>

                    <Link
                      href={`/vacature/${job.slug}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#196961] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#145a54] transition-colors"
                    >
                      Bekijk & Solliciteer
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA banner */}
      <section className="py-16 bg-[#196961]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Staat jouw functie er niet bij?
          </h2>
          <p className="text-[#a7f0e5] mb-6 leading-relaxed">
            Stuur een open sollicitatie en we nemen contact op zodra er een passende plek vrij is.
          </p>
          <a
            href="mailto:info@veiligdouchen.nl"
            className="inline-flex items-center gap-2 bg-white text-[#196961] font-bold px-6 py-3 rounded-lg hover:bg-[#a7f0e5] transition-colors"
          >
            Open sollicitatie sturen
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
