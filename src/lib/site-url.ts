/**
 * Publieke basis-URL's.
 *
 * Het portal en de werken-bij-site draaien op hetzelfde Vercel-project. Alles
 * wat bij een sollicitant of op Facebook terechtkomt (canonical, og:url,
 * links in mails/sms) moet naar het publieke domein wijzen — nooit naar
 * localhost of een *.vercel.app-deploy-URL.
 */

export const PUBLIC_SITE_URL = 'https://www.werkenbijzwaluwcomfortsanitair.nl';

/** Hosts waarop de publieke werken-bij-site draait (zonder poort). */
export const PUBLIC_SITE_HOSTS = [
  'www.werkenbijzwaluwcomfortsanitair.nl',
  'werkenbijzwaluwcomfortsanitair.nl',
];

/**
 * Basis-URL voor links die naar buiten gaan (mails, sms, Meta CAPI).
 * NEXT_PUBLIC_APP_URL heeft voorrang, maar alleen als het een echte https-URL
 * is — een lokaal gedraaid script mag geen localhost-links naar kandidaten
 * sturen.
 */
export function externalBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
  if (/^https:\/\//.test(env) && !/localhost|127\.0\.0\.1/.test(env)) return env;
  return PUBLIC_SITE_URL;
}

/** Absolute URL op het publieke domein voor een pad als `/vacature/x`. */
export function publicUrl(path: string): string {
  return `${PUBLIC_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Next searchParams → "?a=1&b=2" (of "" als er niets is). Voor redirects die
 * utm-tags en fbclid moeten doorgeven.
 */
export function queryString(params: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const query = qs.toString();
  return query ? `?${query}` : '';
}
