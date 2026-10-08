import { redirect } from 'next/navigation';
import { queryString } from '@/lib/site-url';

/**
 * /vacatures → /vacature (het overzicht). Mensen typen beide; de querystring
 * (utm-tags, fbclid) gaat mee zodat de herkomst niet verloren raakt.
 */
export default async function VacaturesAlias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(`/vacature${queryString(await searchParams)}`);
}
