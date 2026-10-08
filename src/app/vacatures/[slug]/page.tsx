import { redirect } from 'next/navigation';
import { queryString } from '@/lib/site-url';

/** /vacatures/<slug> → /vacature/<slug>, met behoud van de querystring. */
export default async function VacatureAlias({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  redirect(`/vacature/${encodeURIComponent(slug)}${queryString(await searchParams)}`);
}
