/**
 * Meta Pixel — gedeeld over de Zwaluw-properties (zelfde pixel als de
 * BrochureFlow-sites / veiligdouchen.nl). Alleen actief op de publieke
 * /vacature-sectie; NIET op het interne portal (dat is `noindex` en hoort
 * geen marketing-pixel te dragen — zie src/app/layout.tsx).
 *
 * Browser-Pixel met PageView + één conversie-event (SubmitApplication) bij een
 * verzonden sollicitatie. Geen Advanced Matching in de browser; de gehashte
 * gegevens gaan server-side via de Conversions API mee (src/lib/meta-capi.ts),
 * met hetzelfde event_id zodat Meta dedupliceert.
 *
 * Pixel-ID komt uit env met een hardcoded fallback zodat de Pixel altijd
 * laadt, ook zonder Vercel-env — identiek aan hoe BrochureFlow het doet.
 */
export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? '723848618020987';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Vuurt de Meta-conversie voor een verzonden sollicitatie.
 *
 * Standaard-event `SubmitApplication` — semantisch de juiste voor een
 * sollicitatie (i.p.v. het generieke `Lead`), en Meta accepteert 'm zonder
 * whitelisting. No-op bij SSR of als de Pixel nog niet geladen is.
 *
 * `eventId` moet dezelfde waarde zijn als het `event_id` dat de sollicitatie-API
 * server-side naar de Conversions API stuurt. Meta dedupliceert daarop, zodat de
 * conversie één keer telt ook als beide kanalen aankomen. Zie src/lib/meta-capi.ts.
 */
export function trackApplicationSubmit(eventId: string, jobTitle?: string): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  try {
    window.fbq('track', 'SubmitApplication', jobTitle ? { content_name: jobTitle } : {}, { eventID: eventId });
  } catch {
    /* een kapotte Pixel mag de bedankpagina niet breken */
  }
}

/**
 * Uniek event-id voor Pixel/CAPI-deduplicatie. `crypto.randomUUID` bestaat
 * niet in oudere Android-WebViews (o.a. de Facebook in-app browser op oudere
 * toestellen) — zonder vangnet brak daar het hele verzenden van het formulier.
 */
export function makeEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* val terug op de variant hieronder */
  }
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}-${rand()}`;
}

/**
 * Leest een cookie in de browser. Gebruikt voor `_fbp` en `_fbc`, die de Pixel
 * zet en die de Conversions API nodig heeft om een serverevent aan dezelfde
 * bezoeker te koppelen.
 */
export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
