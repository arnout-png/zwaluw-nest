/**
 * Herkomst van een bezoeker (utm-tags, fbclid, referrer), vastgelegd op de
 * landingspagina en meegestuurd met de sollicitatie.
 *
 * Waarom opslaan: iemand klikt vanaf Facebook op /vacature?utm_source=facebook,
 * klikt door naar /vacature/callcenter-medewerker en solliciteert daar. Op dat
 * moment staan de utm-tags niet meer in de URL. We bewaren daarom de laatste
 * "touch" met een campagnesignaal 30 dagen in localStorage (sessionStorage en
 * geheugen als vangnet — in sommige in-app browsers is opslag geblokkeerd).
 *
 * Alleen client-side gebruiken.
 */

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  fbclid?: string;
  gclid?: string;
  referrer?: string;
  landingPage?: string;
  capturedAt?: number;
}

const KEY = 'zcs_attribution';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'gclid'] as const;

let memory: Attribution | null = null;

function safeGet(storage: () => Storage): Attribution | null {
  try {
    const raw = storage().getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    if (parsed.capturedAt && Date.now() - parsed.capturedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeSet(storage: () => Storage, value: Attribution) {
  try {
    storage().setItem(KEY, JSON.stringify(value));
  } catch {
    /* opslag geblokkeerd (privémodus / in-app browser) — geheugen volstaat */
  }
}

function clip(value: string | null | undefined, max = 300): string | undefined {
  const v = (value ?? '').trim();
  return v ? v.slice(0, max) : undefined;
}

/** Leest de URL en referrer van de huidige pagina en bewaart een nieuwe touch. */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;

  const search = new URLSearchParams(window.location.search);
  const fromUrl: Attribution = {};
  for (const p of PARAMS) {
    const v = clip(search.get(p));
    if (v) fromUrl[p] = v;
  }

  let referrer: string | undefined;
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.host !== window.location.host) referrer = clip(ref.origin + ref.pathname);
  } catch {
    referrer = undefined;
  }

  const hasCampaignSignal = Object.keys(fromUrl).length > 0;
  const existing = readAttribution();

  // Een touch met campagnesignaal overschrijft altijd; een kale externe
  // referrer alleen als we nog niets hebben (zo wint de advertentieklik
  // van een latere directe terugkeer).
  if (!hasCampaignSignal && (existing || !referrer)) return;

  const touch: Attribution = {
    ...fromUrl,
    referrer,
    landingPage: clip(window.location.origin + window.location.pathname),
    capturedAt: Date.now(),
  };

  memory = touch;
  safeSet(() => window.localStorage, touch);
  safeSet(() => window.sessionStorage, touch);
}

/** De bewaarde herkomst, of null. */
export function readAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  return memory ?? safeGet(() => window.localStorage) ?? safeGet(() => window.sessionStorage);
}
