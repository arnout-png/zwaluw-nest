/**
 * Data-toegang voor de publieke vacaturepagina's. Alleen server-side.
 *
 * `cache` dedupliceert de query tussen generateMetadata en de pagina zelf, zodat
 * een render (en een Facebook-scrape) één databasecall kost.
 */
import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import type { JobOpening } from '@/types';
import { clean } from '@/lib/vacature-format';

const DETAIL_COLUMNS =
  'id, slug, title, description, requirements, location, hoursPerWeek, salaryRange, imageUrl, benefits, perks, impact, roleType, isActive, createdAt, updatedAt';

export type PublicJob = Pick<
  JobOpening,
  | 'id' | 'slug' | 'title' | 'description' | 'requirements' | 'location' | 'hoursPerWeek'
  | 'salaryRange' | 'imageUrl' | 'benefits' | 'perks' | 'impact' | 'roleType' | 'isActive'
  | 'createdAt' | 'updatedAt'
>;

function normalize(job: PublicJob): PublicJob {
  // imageUrl staat soms als lege string in de database; behandel dat als "geen".
  return { ...job, imageUrl: clean(job.imageUrl) ?? undefined };
}

/** Eén actieve vacature op slug, of null. */
export const getActiveJob = cache(async (slug: string): Promise<PublicJob | null> => {
  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .select(DETAIL_COLUMNS)
    .eq('slug', slug)
    .eq('isActive', true)
    .maybeSingle();

  if (error) {
    console.error('[vacature] ophalen mislukt:', slug, error.message);
    return null;
  }
  return data ? normalize(data as unknown as PublicJob) : null;
});

/** Alle actieve vacatures, nieuwste eerst. */
export const getActiveJobs = cache(async (): Promise<PublicJob[]> => {
  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .select(DETAIL_COLUMNS)
    .eq('isActive', true)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('[vacature] lijst ophalen mislukt:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as PublicJob[]).map(normalize);
});

/** Vestigingsadres voor schema.org en de vacaturetekst. */
export const COMPANY = {
  name: 'Zwaluw Comfortsanitair',
  legalName: 'Zwaluw Comfortsanitair B.V.',
  website: 'https://veiligdouchen.nl',
  privacyUrl: 'https://veiligdouchen.nl/privacybeleid/',
  email: 'info@veiligdouchen.nl',
  address: {
    streetAddress: 'Nijverheidsweg 25',
    postalCode: '3899 AD',
    addressLocality: 'Zeewolde',
    addressRegion: 'Flevoland',
    addressCountry: 'NL',
  },
} as const;
