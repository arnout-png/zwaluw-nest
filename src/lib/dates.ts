/**
 * Datum-hulpjes. De server draait in UTC, de gebruikers in Europe/Amsterdam.
 *
 * Let op: een deel van de kolommen is `timestamp without time zone` waarin UTC
 * staat (createdAt, updatedAt). PostgREST levert die zonder zone-aanduiding
 * ("2026-10-08T20:29:01.999"); `new Date()` in de browser leest dat als lokale
 * tijd en toont het dan 1–2 uur te vroeg. Gebruik `parseDbTimestamp` voor
 * zulke kolommen.
 */

export const TZ = 'Europe/Amsterdam';

/** Interpreteert een tijdstempel zonder zone als UTC. */
export function parseDbTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const d = new Date(hasZone ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Kalenderdatum (YYYY-MM-DD) in Amsterdam voor het gegeven moment. */
export function amsterdamDateString(d: Date = new Date()): string {
  // en-CA geeft ISO-volgorde YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Uur (0–23) in Amsterdam. */
export function amsterdamHour(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d));
}

/** Neemt het datumdeel (YYYY-MM-DD) van een datum-/tijdwaarde uit de database. */
export function datePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1] : null;
}

/** Aantal kalenderdagen van `from` naar `to` (beide YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Telt `days` kalenderdagen op bij een YYYY-MM-DD-datum. */
export function addDays(date: string, days: number): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Telt `months` kalendermaanden op bij een YYYY-MM-DD-datum. */
export function addMonths(date: string, months: number): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Werkdagen (ma–vr) tussen twee YYYY-MM-DD-datums, grenzen inbegrepen.
 * Feestdagen worden (nog) niet afgetrokken.
 */
export function countWorkdays(start: string, end: string): number {
  if (end < start) return 0;
  let count = 0;
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) {
    const dow = new Date(`${cur}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Het UTC-moment waarop de gegeven Amsterdamse kalenderdag (YYYY-MM-DD) begint. */
export function amsterdamMidnightUtc(date: string): Date {
  for (const offsetHours of [-2, -1, 0]) {
    const d = new Date(Date.parse(`${date}T00:00:00Z`) + offsetHours * 3_600_000);
    if (amsterdamDateString(d) === date && amsterdamHour(d) === 0) return d;
  }
  return new Date(`${date}T00:00:00Z`);
}
