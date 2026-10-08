/**
 * Ketenbepaling (art. 7:668a BW) en proeftijd (art. 7:652 BW).
 *
 * Ketenregeling: maximaal 3 contracten voor bepaalde tijd binnen maximaal
 * 36 maanden. Een tussenpoos van meer dan 6 maanden doorbreekt de keten.
 * Wordt één van beide grenzen overschreden, dan geldt het laatste contract
 * van rechtswege voor onbepaalde tijd. (Een cao kan afwijken; dit is de
 * wettelijke hoofdregel en bedoeld als signalering, niet als juridisch oordeel.)
 *
 * Datums zijn YYYY-MM-DD of een databasewaarde die daarmee begint.
 */
import { addDays, addMonths, datePart } from './dates';

export interface ContractLike {
  id?: string;
  startDate: string;
  endDate?: string | null;
  contractType?: string | null;
  status?: string | null;
}

export interface ChainInfo {
  /** Aantal contracten voor bepaalde tijd in de huidige keten. */
  count: number;
  /** Start van de huidige keten (YYYY-MM-DD) of null als er geen keten is. */
  start: string | null;
  /** Einddatum van het laatste contract in de keten. */
  end: string | null;
  /** Duur van de keten in maanden (afgerond naar beneden). */
  months: number;
  /** Er bestaat (al) een contract voor onbepaalde tijd. */
  hasPermanent: boolean;
  level: 'none' | 'ok' | 'warning' | 'exceeded';
  message: string | null;
}

export function isPermanentContract(c: ContractLike): boolean {
  return !c.endDate || /onbepaald/i.test(c.contractType ?? '');
}

function monthsBetween(from: string, to: string): number {
  let months = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7));
  if (+to.slice(8, 10) < +from.slice(8, 10)) months -= 1;
  return Math.max(0, months);
}

/** Langer dan 6 maanden tussen einde vorig contract en start volgend contract? */
function breaksChain(prevEnd: string, nextStart: string): boolean {
  return nextStart > addMonths(prevEnd, 6);
}

export function computeChain(contracts: ContractLike[]): ChainInfo {
  const terminated = (c: ContractLike) => c.status === 'TERMINATED' && !c.endDate;
  const all = contracts.filter((c) => !terminated(c) && datePart(c.startDate));
  const hasPermanent = all.some((c) => isPermanentContract(c) && c.status !== 'TERMINATED');

  const fixed = all
    .filter((c) => !isPermanentContract(c))
    .map((c) => ({ start: datePart(c.startDate)!, end: datePart(c.endDate)! }))
    .sort((a, b) => a.start.localeCompare(b.start));

  let count = 0;
  let start: string | null = null;
  let end: string | null = null;
  for (const c of fixed) {
    if (end && !breaksChain(end, c.start)) {
      count += 1;
      if (c.end > end) end = c.end;
    } else {
      count = 1;
      start = c.start;
      end = c.end;
    }
  }

  if (count === 0 || !start || !end) {
    return { count: 0, start: null, end: null, months: 0, hasPermanent, level: 'none', message: null };
  }

  // Contract loopt t/m de einddatum, dus duur = start → einddatum + 1 dag.
  const months = monthsBetween(start, addDays(end, 1));
  let level: ChainInfo['level'] = 'ok';
  let message: string | null = null;
  if (count > 3 || months > 36) {
    level = 'exceeded';
    message = `Keten overschreden (${count} contracten, ${months} maanden): het laatste contract geldt volgens de wet als contract voor onbepaalde tijd.`;
  } else if (count === 3 || months >= 30) {
    level = 'warning';
    message = `Let op: ${count} contract(en) in ${months} maanden. Een volgend tijdelijk contract binnen 6 maanden na afloop is niet meer mogelijk zonder vast dienstverband.`;
  }
  return { count, start, end, months, hasPermanent, level, message };
}

/** Ketenpositie die een nieuw tijdelijk contract met deze startdatum krijgt. */
export function nextChainPosition(existing: ContractLike[], newStart: string): number {
  const chain = computeChain(existing.filter((c) => (datePart(c.startDate) ?? '') < newStart));
  if (!chain.end || breaksChain(chain.end, newStart)) return 1;
  return chain.count + 1;
}

/**
 * Waarschuwingen bij de proeftijd van een nieuw contract (art. 7:652 BW):
 * geen proeftijd bij een contract van ≤ 6 maanden, max. 1 maand bij een
 * tijdelijk contract korter dan 2 jaar, max. 2 maanden bij ≥ 2 jaar of vast;
 * en in een opvolgend contract is een nieuwe proeftijd in de regel nietig.
 */
export function probationWarnings(opts: {
  startDate: string;
  endDate?: string | null;
  probationEndDate?: string | null;
  chainPosition: number;
}): string[] {
  const warnings: string[] = [];
  const { startDate, endDate, probationEndDate, chainPosition } = opts;
  if (!probationEndDate) return warnings;

  if (probationEndDate < startDate) {
    warnings.push('De proeftijd eindigt vóór de startdatum van het contract.');
    return warnings;
  }
  if (chainPosition > 1) {
    warnings.push('Dit is een opvolgend contract: een nieuwe proeftijd is dan in de regel nietig.');
  }

  // Contract loopt t/m endDate; "6 maanden of korter" = eindigt vóór start + 6 maanden.
  if (endDate && endDate < addMonths(startDate, 6)) {
    warnings.push('Bij een contract van 6 maanden of korter is geen proeftijd toegestaan.');
  } else {
    const twoYearsOrLonger = !endDate || endDate >= addDays(addMonths(startDate, 24), -1);
    const maxMonths = twoYearsOrLonger ? 2 : 1;
    if (probationEndDate >= addMonths(startDate, maxMonths)) {
      warnings.push(`De proeftijd is langer dan wettelijk toegestaan (maximaal ${maxMonths} maand${maxMonths > 1 ? 'en' : ''} voor dit contract).`);
    }
  }
  return warnings;
}
