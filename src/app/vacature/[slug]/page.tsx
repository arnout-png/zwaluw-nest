import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getActiveJob, getActiveJobs, COMPANY, type PublicJob } from '@/lib/vacature';
import { PUBLIC_SITE_URL, publicUrl } from '@/lib/site-url';
import {
  clean,
  employmentTypes,
  formatHours,
  formatSalary,
  parseSalary,
  teaser,
  toBlocks,
  toLines,
  toTags,
} from '@/lib/vacature-format';
import { FormattedText } from '../formatted-text';
import { ApplyForm } from './apply-form';

export const revalidate = 60;

/** Actieve vacatures alvast renderen (snelle eerste klik vanaf Facebook); nieuwe slugs werken ook. */
export async function generateStaticParams() {
  const jobs = await getActiveJobs();
  return jobs.map((j) => ({ slug: j.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_NAME = 'Werken bij Zwaluw Comfortsanitair';

const DEFAULT_IMPACT =
  'Word onderdeel van een gespecialiseerd team dat mensen dagelijks helpt om veilig en comfortabel zelfstandig thuis te blijven wonen.';

/** "Callcenter Medewerker in Zeewolde" */
function pageTitle(job: PublicJob): string {
  const place = clean(job.location);
  return place ? `${job.title} in ${place}` : job.title;
}

/** Korte beschrijving voor zoekmachines en de Facebook-preview. */
function metaDescription(job: PublicJob): string {
  const facts = [clean(job.location), formatHours(job.hoursPerWeek), formatSalary(job.salaryRange)]
    .filter(Boolean)
    .join(' · ');
  return facts ? `${facts} — ${teaser(job.description, 150)}` : teaser(job.description, 200);
}

/**
 * og:image: de vacaturefoto (absolute Supabase-URL) of, zonder foto, een
 * gegenereerde 1200×630 merkafbeelding met de functietitel.
 */
function ogImage(job: PublicJob): { url: string; width?: number; height?: number; alt: string } {
  const img = clean(job.imageUrl);
  if (img && /^https:\/\//.test(img)) return { url: img, alt: job.title };
  return {
    url: `/vacature/og?slug=${encodeURIComponent(job.slug)}`,
    width: 1200,
    height: 630,
    alt: `${job.title} — ${SITE_NAME}`,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getActiveJob(slug);
  if (!job) {
    return {
      title: 'Vacature niet gevonden',
      robots: { index: false, follow: true },
    };
  }

  const title = pageTitle(job);
  const fullTitle = `${title} | ${SITE_NAME}`;
  const description = metaDescription(job);
  const url = `/vacature/${job.slug}`;
  const image = ogImage(job);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'nl_NL',
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image.url],
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** De vacaturetekst als eenvoudige HTML voor schema.org (Google wil HTML). */
function descriptionHtml(job: PublicJob): string {
  const parts: string[] = [];
  for (const block of toBlocks(job.description)) {
    if (block.type === 'heading') parts.push(`<p><strong>${escapeHtml(block.text)}</strong></p>`);
    else if (block.type === 'list') parts.push(`<ul>${block.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`);
    else parts.push(`<p>${escapeHtml(block.text).replace(/\n/g, '<br>')}</p>`);
  }
  const requirements = toLines(job.requirements);
  if (requirements.length) {
    parts.push('<p><strong>Wat wij vragen</strong></p>');
    parts.push(`<ul>${requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`);
  }
  const benefits = toLines(job.benefits);
  if (benefits.length) {
    parts.push('<p><strong>Wat we bieden</strong></p>');
    parts.push(`<ul>${benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`);
  }
  return parts.join('');
}

/** schema.org JobPosting — maakt de vacature geschikt voor Google for Jobs. */
function jobPostingJsonLd(job: PublicJob) {
  const salary = parseSalary(job.salaryRange);
  const types = employmentTypes(job.hoursPerWeek);
  const location = clean(job.location);
  const atHeadOffice = !location || /zeewolde/i.test(location);
  const validThrough = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const image = ogImage(job);

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: descriptionHtml(job),
    datePosted: (Number.isNaN(Date.parse(job.createdAt)) ? new Date() : new Date(job.createdAt)).toISOString().slice(0, 10),
    validThrough: validThrough.toISOString(),
    ...(types.length ? { employmentType: types.length === 1 ? types[0] : types } : {}),
    hiringOrganization: {
      '@type': 'Organization',
      name: COMPANY.name,
      legalName: COMPANY.legalName,
      sameAs: COMPANY.website,
      logo: `${PUBLIC_SITE_URL}/logo.png`,
    },
    jobLocation: {
      '@type': 'Place',
      address: atHeadOffice
        ? { '@type': 'PostalAddress', ...COMPANY.address }
        : { '@type': 'PostalAddress', addressLocality: location, addressCountry: 'NL' },
    },
    ...(salary
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'EUR',
            value: {
              '@type': 'QuantitativeValue',
              ...(salary.max !== undefined
                ? { minValue: salary.min, maxValue: salary.max }
                : { value: salary.min }),
              unitText: salary.unit,
            },
          },
        }
      : {}),
    directApply: true,
    identifier: { '@type': 'PropertyValue', name: COMPANY.name, value: job.id },
    url: publicUrl(`/vacature/${job.slug}`),
    image: image.url.startsWith('http') ? image.url : publicUrl(image.url),
  };
}

export default async function ApplyDetailPage({ params }: Props) {
  const { slug } = await params;
  const job = await getActiveJob(slug);
  if (!job) notFound();

  const requirements = toLines(job.requirements);
  const benefits = toLines(job.benefits);
  const perks = toTags(job.perks);
  const impact = clean(job.impact) ?? DEFAULT_IMPACT;
  const hours = formatHours(job.hoursPerWeek);
  const salary = formatSalary(job.salaryRange);
  const location = clean(job.location);
  const titleWords = job.title.split(' ');

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd(job)).replace(/</g, '\\u003c') }}
      />

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
              Vacature · {COMPANY.name}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1b1c1c] leading-tight mb-4">
              {titleWords.length > 1
                ? <>
                    {titleWords.slice(0, -1).join(' ')}{' '}
                    <span className="text-[#196961]">{titleWords.slice(-1)}</span>
                  </>
                : <span className="text-[#196961]">{job.title}</span>}
            </h1>
            <p className="text-base md:text-lg text-[#3f4947] max-w-lg mb-6 leading-relaxed">
              {teaser(job.description, 200)}
            </p>

            {/* Meta pills */}
            {(location || hours || salary) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {location && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#f0eded] px-3 py-1 text-xs text-[#3f4947]">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {location}
                  </span>
                )}
                {hours && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#f0eded] px-3 py-1 text-xs text-[#3f4947]">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {hours}
                  </span>
                )}
                {salary && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#ffdcbf] px-3 py-1 text-xs text-[#703f00] font-medium">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {salary}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <a
                href="#solliciteren"
                className="bg-[#8b5000] text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 shadow-lg shadow-[#8b5000]/20 hover:bg-[#703f00] transition-colors"
              >
                Direct solliciteren
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </a>
              <a
                href="#over-de-functie"
                className="bg-white text-[#196961] border border-[#196961]/30 px-6 py-3 rounded-lg font-semibold hover:bg-[#f6f3f2] transition-colors"
              >
                Lees de vacature
              </a>
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
                  fetchPriority="high"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#196961]/20 to-[#68b0a6]/30 flex items-center justify-center">
                  <svg className="h-20 w-20 text-[#196961]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── De functie ───────────────────────────────────────────────────── */}
      <section id="over-de-functie" className="scroll-mt-20 py-14 bg-[#f6f3f2]">
        <div className="max-w-7xl mx-auto px-6 grid gap-10 lg:grid-cols-5">
          {/* Volledige functiebeschrijving */}
          <div className={requirements.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}>
            <h2 className="text-2xl font-bold tracking-tight text-[#196961] mb-5">Over de functie</h2>
            <div className="bg-white rounded-2xl p-6 md:p-8">
              <FormattedText text={job.description} className="text-[15px]" />
            </div>
          </div>

          {requirements.length > 0 && (
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold tracking-tight text-[#196961] mb-5">Wat wij vragen</h2>
              <div className="space-y-2.5">
                {requirements.map((req, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl flex items-start gap-3">
                    <svg className="h-5 w-5 text-[#8b5000] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-[#1b1c1c]">{req}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Voorwaarden, perks en impact */}
        <div className="max-w-7xl mx-auto px-6 mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {benefits.length > 0 && (
            <div className="bg-white p-6 rounded-2xl">
              <h3 className="text-lg font-bold mb-3 text-[#1b1c1c]">Wat we bieden</h3>
              <ul className="space-y-2">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#3f4947]">
                    <span className="mt-2 w-1.5 h-1.5 bg-[#196961] rounded-full shrink-0" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {perks.length > 0 && (
            <div className="bg-[#196961] p-6 rounded-2xl text-white">
              <h3 className="text-lg font-bold mb-3">Extra&apos;s</h3>
              <div className="flex flex-wrap gap-2">
                {perks.map((p) => (
                  <span key={p} className="px-2.5 py-1 bg-white/20 rounded-full text-[11px] font-bold tracking-wide uppercase">
                    {p}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs opacity-80 italic">
                &ldquo;Samen helpen we mensen om veilig en zelfstandig thuis te blijven wonen.&rdquo;
              </p>
            </div>
          )}

          <div className={`bg-[#eae8e7] p-6 rounded-2xl border border-[#bec9c6]/20 ${benefits.length > 0 && perks.length > 0 ? 'md:col-span-2' : ''}`}>
            <h3 className="text-lg font-bold mb-4 text-[#1b1c1c]">Jouw dagelijkse impact</h3>
            <div className="relative pl-6 border-l-2 border-[#68b0a6]">
              <span className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full bg-[#196961] border-4 border-[#eae8e7]" />
              <p className="text-[#3f4947] text-sm leading-relaxed whitespace-pre-line">{impact}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Application form ─────────────────────────────────────────────── */}
      <section className="scroll-mt-16 py-16 bg-[#fbf9f8]" id="solliciteren">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3 text-[#1b1c1c]">Direct solliciteren</h2>
            <p className="text-sm text-[#3f4947]">
              Solliciteren als {job.title} duurt 2 minuten. We bellen je binnen twee werkdagen.
            </p>
          </div>
          <div className="bg-[#f6f3f2] p-5 md:p-10 rounded-3xl shadow-sm">
            <ApplyForm jobId={job.id} jobTitle={job.title} slug={job.slug} privacyUrl={COMPANY.privacyUrl} />
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
                oplossingen voor een veilige, comfortabele badkamer.
              </p>
              <a
                href={COMPANY.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-[#196961] font-bold hover:gap-5 transition-all text-sm"
              >
                Ga naar veiligdouchen.nl
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
                    veiligdouchen.nl
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://image.thum.io/get/width/1200/https://veiligdouchen.nl"
                  alt="Voorbeeld van de website veiligdouchen.nl"
                  className="w-full aspect-video object-cover object-top"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
