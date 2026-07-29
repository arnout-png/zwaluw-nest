/**
 * Meta Conversions API — server-side dispatch voor verzonden sollicitaties.
 *
 * Vult de browser-Pixel aan: die mist bezoekers met een adblocker, ITP/Safari
 * of een afgebroken pagina-unload. Het serverevent draagt hetzelfde `event_id`
 * als het browserevent, zodat Meta dedupliceert en de conversie één keer telt.
 *
 * Volgt de canonieke referentie in SwiftFlow (supabase/functions/meta-capi):
 * SHA-256 over lowercase+trim, Graph API v21.0, falen is nooit fataal voor de
 * sollicitatie zelf. Aanvullend sturen we hier client_ip_address,
 * client_user_agent en fbp/fbc mee — die verhogen de match quality flink.
 *
 * Zet META_CAPI_ACCESS_TOKEN in Vercel; zonder token is dit een no-op.
 */
import { createHash } from 'crypto';
import { META_PIXEL_ID } from './meta-pixel';

const GRAPH_API_VERSION = 'v21.0';

/** True zodra de Conversions API bruikbaar is. */
export function isCapiConfigured(): boolean {
  return !!process.env.META_CAPI_ACCESS_TOKEN;
}

/** SHA-256 hex over de genormaliseerde waarde. Meta verwacht lowercase + trim. */
function hash(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

/**
 * Nederlandse nummers naar E.164-cijfers zonder plus: 06 12345678 -> 31612345678.
 * Meta matcht slecht op nummers zonder landcode.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0031')) return `31${digits.slice(4)}`;
  if (digits.startsWith('31')) return digits;
  if (digits.startsWith('0')) return `31${digits.slice(1)}`;
  return digits;
}

/**
 * Meta's `fbc`-formaat reconstrueren uit een rauwe fbclid, voor het geval de
 * _fbc-cookie ontbreekt (bijv. als de Pixel geblokkeerd werd).
 */
function fbcFromFbclid(fbclid: string): string {
  return `fb.1.${Date.now()}.${fbclid}`;
}

export interface ApplicationCapiEvent {
  /** Gedeeld met het browserevent — zonder dit telt Meta de conversie dubbel. */
  eventId: string;
  /** Volledige naam zoals ingevuld; wordt gesplitst in fn/ln. */
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  postalCode?: string | null;
  /** URL van de vacaturepagina waar gesolliciteerd is. */
  sourceUrl: string;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
}

/**
 * Stuurt één SubmitApplication-event naar de Conversions API.
 * Gooit nooit: een mislukte conversie mag een sollicitatie niet blokkeren.
 */
export async function sendApplicationCapiEvent(event: ApplicationCapiEvent): Promise<void> {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken) return;

  const parts = event.name.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ');

  const userData: Record<string, string> = { country: hash('nl') };

  if (event.email) userData.em = hash(event.email);
  if (firstName) userData.fn = hash(firstName);
  if (lastName) userData.ln = hash(lastName);
  if (event.city) userData.ct = hash(event.city.replace(/\s/g, ''));
  if (event.postalCode) userData.zp = hash(event.postalCode.replace(/\s/g, ''));

  if (event.phone) {
    const phone = normalizePhone(event.phone);
    if (phone) userData.ph = hash(phone);
  }

  // Niet gehasht — Meta verwacht deze als platte tekst.
  if (event.clientIp) userData.client_ip_address = event.clientIp;
  if (event.clientUserAgent) userData.client_user_agent = event.clientUserAgent;
  if (event.fbp) userData.fbp = event.fbp;

  const fbc = event.fbc ?? (event.fbclid ? fbcFromFbclid(event.fbclid) : null);
  if (fbc) userData.fbc = fbc;

  // META_CAPI_TEST_EVENT_CODE: alleen zetten om te verifieren. Events met een
  // testcode landen uitsluitend in het tabblad Test Events van Events Manager
  // en tellen niet mee in rapportage of optimalisatie. Weer weghalen na de test,
  // anders verdwijnen echte conversies uit je cijfers.
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE;

  const payload = {
    data: [
      {
        event_name: 'SubmitApplication',
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: 'website',
        event_source_url: event.sourceUrl,
        user_data: userData,
      },
    ],
    access_token: accessToken,
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      console.error('[MetaCAPI] Verzenden mislukt:', res.status, await res.text());
      return;
    }

    const json = (await res.json()) as { events_received?: number };
    console.log(`[MetaCAPI] SubmitApplication verzonden, events_received=${json.events_received ?? '?'}`);
  } catch (err) {
    console.error('[MetaCAPI] Verzenden mislukt:', err);
  }
}
