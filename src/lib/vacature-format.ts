/**
 * Pure opmaak-helpers voor vacatureteksten (geen server-afhankelijkheden).
 *
 * De vacaturevelden zijn vrije tekst die in het portal wordt ingevuld, dus elke
 * helper moet tegen rommelige invoer kunnen: "€2.200 – €2.700",
 * "3.000 bruto p/m", "€ 3200,- / € 4000,-", "4500-7500", "32-40 uur", ...
 */

/** Lege strings en whitespace behandelen als "niet ingevuld". */
export function clean(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return v ? v : null;
}

/**
 * Salaris voor weergave. Voegt alleen een euroteken toe als de tekst met een
 * cijfer begint en er nog geen € in staat — zo nooit "€ €2.600".
 */
export function formatSalary(salaryRange: string | null | undefined): string | null {
  const s = clean(salaryRange);
  if (!s) return null;
  if (s.includes('€') || /eur/i.test(s)) return s;
  if (/^\d/.test(s)) return `€ ${s}`;
  return s;
}

/** Uren voor weergave: "24 - 40" → "24 - 40 uur"; laat "32 uur" ongemoeid. */
export function formatHours(hoursPerWeek: string | null | undefined): string | null {
  const h = clean(hoursPerWeek);
  if (!h) return null;
  return /uur/i.test(h) ? h : `${h} uur`;
}

/** Nederlandse getalnotatie naar number: "2.200" → 2200, "2.600,50" → 2600.5. */
function parseDutchNumber(token: string): number {
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(token)) {
    return Number(token.replace(/\./g, '').replace(',', '.'));
  }
  return Number(token.replace(',', '.'));
}

export interface ParsedSalary {
  min: number;
  max?: number;
  unit: 'HOUR' | 'MONTH' | 'YEAR';
}

/**
 * Probeert een salaristekst te lezen als bedrag(en) voor schema.org. Geeft null
 * als er geen plausibel bedrag in staat — dan laten we baseSalary liever weg
 * dan Google onzin te geven.
 */
export function parseSalary(salaryRange: string | null | undefined): ParsedSalary | null {
  const s = clean(salaryRange);
  if (!s) return null;

  const tokens = s.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) ?? [];
  const numbers = tokens.map(parseDutchNumber).filter((n) => Number.isFinite(n) && n >= 5);
  if (numbers.length === 0) return null;

  const unit: ParsedSalary['unit'] = /per uur|p\/u|\/u\b|uurloon|per hour/i.test(s)
    ? 'HOUR'
    : /jaar|p\/j|annual/i.test(s)
      ? 'YEAR'
      : 'MONTH';

  const [a, b] = numbers;
  const min = b !== undefined ? Math.min(a, b) : a;
  const max = b !== undefined ? Math.max(a, b) : undefined;

  const plausible =
    unit === 'HOUR' ? min >= 8 && min <= 150
      : unit === 'YEAR' ? min >= 12000 && min <= 300000
        : min >= 800 && min <= 25000;
  if (!plausible) return null;

  return { min, max: max !== undefined && max !== min ? max : undefined, unit };
}

/** schema.org employmentType op basis van "24 - 40" / "32" / "40 uur". */
export function employmentTypes(hoursPerWeek: string | null | undefined): string[] {
  const h = clean(hoursPerWeek);
  if (!h) return [];
  const nums = (h.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n <= 60);
  if (nums.length === 0) return [];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const types: string[] = [];
  if (max >= 36) types.push('FULL_TIME');
  if (min < 36) types.push('PART_TIME');
  return types;
}

/** Eerste alinea van een tekst, ingekort op een woordgrens. */
export function teaser(text: string | null | undefined, max = 180): string {
  const firstParagraph = (clean(text) ?? '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (firstParagraph.length <= max) return firstParagraph;
  const cut = firstParagraph.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

const BULLET_RE = /^\s*(?:[-*•–·✓✔]|\d+[.)])\s+/;

/** Regel-voor-regel lijst ("één per regel"), met opsommingstekens eraf. */
export function toLines(text: string | null | undefined): string[] {
  return (clean(text) ?? '')
    .split('\n')
    .map((l) => l.replace(BULLET_RE, '').trim())
    .filter(Boolean);
}

/** Kommagescheiden tags ("Bonusregeling, Pensioenregeling"). */
export function toTags(text: string | null | undefined): string[] {
  return (clean(text) ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export type TextBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

/**
 * Deelt een vrije tekst op in koppen, alinea's en opsommingen, zodat de
 * volledige functiebeschrijving leesbaar op de pagina komt zonder HTML of
 * markdown-renderer. Herkent:
 *   - lege regel = nieuwe alinea
 *   - regels die met •, -, *, ✓ of "1." beginnen = lijst
 *   - een korte losse regel die op ? of : eindigt (of met # begint) = kop
 */
export function toBlocks(text: string | null | undefined): TextBlock[] {
  const blocks: TextBlock[] = [];
  const paragraphs = (clean(text) ?? '').replace(/\r\n/g, '\n').split(/\n\s*\n/);

  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
    let buffer: string[] = [];
    let list: string[] = [];

    const flushBuffer = () => {
      if (buffer.length) blocks.push({ type: 'paragraph', text: buffer.join('\n') });
      buffer = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ type: 'list', items: list });
      list = [];
    };

    for (const raw of lines) {
      const line = raw.trim();
      const isHeading =
        /^#{1,4}\s+/.test(line) ||
        (line.length <= 60 && /[?:]$/.test(line) && !BULLET_RE.test(line) && lines.length > 1);
      if (BULLET_RE.test(line)) {
        flushBuffer();
        list.push(line.replace(BULLET_RE, '').trim());
      } else if (isHeading) {
        flushBuffer();
        flushList();
        blocks.push({ type: 'heading', text: line.replace(/^#{1,4}\s+/, '').replace(/:$/, '') });
      } else {
        flushList();
        buffer.push(line);
      }
    }
    flushBuffer();
    flushList();
  }

  return blocks;
}
