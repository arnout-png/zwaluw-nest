/**
 * Voegt dubbele kandidaten samen tot één record.
 *
 *   node scripts/merge-duplicate-candidates.mjs            # dry-run (schrijft niets)
 *   node scripts/merge-duplicate-candidates.mjs --apply    # voert de samenvoeging uit
 *
 * Groepeert op genormaliseerd e-mailadres. Per groep blijft één record over
 * (verst in de pipeline, dan meeste activiteit, dan oudste). Onderliggende
 * records (notities, belpogingen, screening, scores, checklist, dossier)
 * worden omgehangen; lege velden op de blijver worden aangevuld vanuit de
 * duplicaten. De duplicaten krijgen deletedAt en verdwijnen uit de app —
 * ze blijven in de database staan, dus dit is terug te draaien.
 */
import fs from 'fs';
import path from 'path';

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'duplicaten-rapport');

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };

async function rest(pathname, init = {}) {
  const res = await fetch(`${U}/rest/v1/${pathname}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${pathname}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const get = p => rest(p);

// Alles pagineren; PostgREST kapt anders stilzwijgend af.
async function getAll(table, select) {
  const rows = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const batch = await rest(`${table}?select=${select}&order=id.asc&limit=${PAGE}&offset=${from}`);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

// De blijver is de kopie waaraan het laatst is gewerkt: een gekoppeld
// personeelsdossier gaat voor, dan een opgepakte kopie boven een kale NEW_LEAD,
// dan de meest recente statuswijziging, dan de meeste activiteit, dan de oudste rij.
const decidedAt = c => new Date(c.stageUpdatedAt ?? c.updatedAt ?? c.createdAt).getTime();

// Velden die van een duplicaat naar de blijver mogen worden overgenomen als die leeg is.
const FILLABLE = [
  'phone', 'street', 'postalCode', 'city', 'cvUrl', 'linkedinUrl', 'age', 'location',
  'livingSituation', 'partnerEmployment', 'currentJob', 'reasonForLeaving',
  'salaryExpectation', 'leadSource', 'leadCampaignId', 'jobOpeningId', 'assignedToId',
  'consentDate', 'consentExpiresAt', 'stageUpdatedAt',
];
const isEmpty = v => v === null || v === undefined || v === '';

// Kindtabellen; unieke sleutels moeten bij het omhangen gerespecteerd worden.
const CHILDREN = [
  { table: 'CandidateNote',            unique: null },
  { table: 'CallLog',                  unique: null },
  { table: 'InterviewScore',           unique: null },
  { table: 'ScreeningAnswer',          unique: 'questionId' },
  { table: 'InterviewChecklistResult', unique: 'itemId' },
];

const log = [];
const say = s => { console.log(s); log.push(s); };

const candidates = await getAll('Candidate', '*');
say(`kandidaten geladen: ${candidates.length}`);

const childRows = {};
for (const { table } of CHILDREN) {
  childRows[table] = await getAll(table, '*');
  say(`${table}: ${childRows[table].length} rijen`);
}
const employeeProfiles = await getAll('EmployeeProfile', 'id,candidateId');

// Groeperen op genormaliseerd e-mailadres
const groups = new Map();
for (const c of candidates) {
  const key = (c.email || '').toLowerCase().trim();
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
const dupGroups = [...groups.entries()].filter(([, g]) => g.length > 1);
say(`\nunieke e-mailadressen: ${groups.size} | groepen met duplicaten: ${dupGroups.length}`);

const activityCount = id =>
  CHILDREN.reduce((n, { table }) => n + childRows[table].filter(r => r.candidateId === id).length, 0);

const plan = [];
for (const [email, rows] of dupGroups) {
  const scored = rows.map(c => ({
    c,
    worked: c.status !== 'NEW_LEAD' ? 1 : 0,
    decided: decidedAt(c),
    act: activityCount(c.id),
    hasProfile: employeeProfiles.some(p => p.candidateId === c.id),
    live: c.deletedAt ? 0 : 1,
  }));
  // Een eerder verwijderde kopie mag nooit blijver worden: dan verdwijnt de kandidaat uit de app.
  scored.sort((a, b) =>
    (b.live - a.live) || (b.hasProfile - a.hasProfile) || (b.worked - a.worked) ||
    // Bij kale NEW_LEADs is stageUpdatedAt gewoon de importdatum; dan wint de oudste kopie.
    (a.worked && b.worked ? b.decided - a.decided : 0) ||
    (new Date(a.c.createdAt) - new Date(b.c.createdAt)) || (b.act - a.act)
  );
  const keep = scored[0].c;
  const drop = scored.slice(1).map(s => s.c);

  const fills = {};
  // De blijver houdt de datum van de eerste aanmelding, anders telt een heropgepakte
  // herimport als "nieuw".
  const firstCreated = rows.map(r => r.createdAt).sort()[0];
  if (keep.createdAt > firstCreated) fills.createdAt = firstCreated;

  // lege velden aanvullen vanuit de duplicaten (nieuwste eerst)
  const donors = [...drop].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  for (const f of FILLABLE) {
    if (!isEmpty(keep[f])) continue;
    const donor = donors.find(d => !isEmpty(d[f]));
    if (donor) fills[f] = donor[f];
  }

  // kindrijen die verhuizen, met botsingen op unieke sleutels
  const moves = [], conflicts = [];
  for (const { table, unique } of CHILDREN) {
    const keepKeys = new Set(
      unique ? childRows[table].filter(r => r.candidateId === keep.id).map(r => r[unique]) : []
    );
    for (const d of drop) {
      for (const r of childRows[table].filter(r => r.candidateId === d.id)) {
        if (unique && keepKeys.has(r[unique])) { conflicts.push({ table, id: r.id }); continue; }
        if (unique) keepKeys.add(r[unique]);
        moves.push({ table, id: r.id });
      }
    }
  }
  plan.push({ email, keep, drop, fills, moves, conflicts, statuses: rows.map(r => r.status) });
}

const totals = {
  groepen: plan.length,
  teVerwijderenRijen: plan.reduce((n, p) => n + p.drop.filter(d => !d.deletedAt).length, 0),
  alVerwijderd: plan.reduce((n, p) => n + p.drop.filter(d => d.deletedAt).length, 0),
  blijverWasVerwijderd: plan.filter(p => p.keep.deletedAt).length,
  omgehangenKindrijen: plan.reduce((n, p) => n + p.moves.length, 0),
  botsingen: plan.reduce((n, p) => n + p.conflicts.length, 0),
  veldenAangevuld: plan.reduce((n, p) => n + Object.keys(p.fills).length, 0),
  groepenMetMeerdereOpgepakt: plan.filter(p => p.statuses.filter(s => s !== 'NEW_LEAD').length > 1).length,
};
say('\n' + JSON.stringify(totals, null, 2));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'backup-kandidaten.json'), JSON.stringify(candidates, null, 1));
fs.writeFileSync(path.join(OUT, 'backup-kindrijen.json'), JSON.stringify(childRows, null, 1));
fs.writeFileSync(path.join(OUT, 'samenvoegplan.json'), JSON.stringify(
  plan.map(p => ({
    email: p.email, keep: p.keep.id, keepStatus: p.keep.status,
    drop: p.drop.map(d => ({ id: d.id, status: d.status, createdAt: d.createdAt })),
    fills: p.fills, moves: p.moves.length, conflicts: p.conflicts.length,
  })), null, 1));
say(`\nbackup + plan geschreven naar ${OUT}/`);

if (!APPLY) {
  say('\nDRY-RUN — er is niets gewijzigd. Draai met --apply om uit te voeren.');
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
  process.exit(0);
}

say('\n=== UITVOEREN ===');
let done = 0;
for (const p of plan) {
  for (const m of p.moves) {
    await rest(`${m.table}?id=eq.${m.id}`, { method: 'PATCH', body: JSON.stringify({ candidateId: p.keep.id }) });
  }
  if (Object.keys(p.fills).length) {
    await rest(`Candidate?id=eq.${p.keep.id}`, { method: 'PATCH', body: JSON.stringify(p.fills) });
  }
  const now = new Date().toISOString();
  for (const d of p.drop) {
    if (d.deletedAt) continue; // oorspronkelijke verwijderdatum behouden
    await rest(`Candidate?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ deletedAt: now }) });
  }
  if (++done % 25 === 0) say(`  ${done}/${plan.length} groepen verwerkt`);
}
say(`klaar: ${done} groepen samengevoegd`);
fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
