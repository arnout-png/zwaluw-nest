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
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-poppins text-3xl font-bold text-[#2b2b2b] mb-3">
          Werken bij Veilig Douchen
        </h1>
        <p className="text-[#363636] max-w-xl mx-auto">
          Sluit je aan bij ons team en help mensen veilig te douchen. Bekijk onze openstaande functies hieronder.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#9ca3af] text-lg">Er zijn momenteel geen openstaande vacatures.</p>
          <p className="text-sm text-[#9ca3af] mt-2">Kom later terug of stuur een open sollicitatie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {job.imageUrl && (
                <div className="h-44 overflow-hidden bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={job.imageUrl}
                    alt={job.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="p-5">
                <h2 className="font-poppins text-lg font-semibold text-[#2b2b2b] mb-2">{job.title}</h2>

                <div className="flex flex-wrap gap-2 mb-4">
                  {job.location && (
                    <span className="rounded-full border border-[#68b0a6] px-3 py-0.5 text-xs text-[#68b0a6]">
                      {job.location}
                    </span>
                  )}
                  {job.hoursPerWeek && (
                    <span className="rounded-full border border-[#68b0a6] px-3 py-0.5 text-xs text-[#68b0a6]">
                      {job.hoursPerWeek}
                    </span>
                  )}
                  {job.salaryRange && (
                    <span className="rounded-full border border-[#68b0a6] px-3 py-0.5 text-xs text-[#68b0a6]">
                      {job.salaryRange}
                    </span>
                  )}
                </div>

                <p className="text-sm text-[#363636] line-clamp-3 mb-5">
                  {job.description}
                </p>

                <Link
                  href={`/apply/${job.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f7a247] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e5932e] transition-colors"
                >
                  Solliciteer →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
