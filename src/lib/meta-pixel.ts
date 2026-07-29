/**
 * Meta Pixel — gedeeld over de Zwaluw-properties (zelfde pixel als de
 * BrochureFlow-sites / veiligdouchen.nl). Alleen actief op de publieke
 * /vacature-sectie; NIET op het interne portal (dat is `noindex` en hoort
 * geen marketing-pixel te dragen — zie src/app/layout.tsx).
 *
 * Bewust "kaal": browser-Pixel met PageView + één conversie-event bij een
 * verzonden sollicitatie. GEEN Advanced Matching (gehashte PII naar Meta) en
 * GEEN server-side Conversions API. Beide zijn de logische vervolgstap voor
 * betere match-quality/attributie — zie de BrochureFlow-referentie in
 * packages/brochure-ui (BrochureForm.tsx + lib/lead-api.ts).
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
 */
export function trackApplicationSubmit(): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', 'SubmitApplication');
}
