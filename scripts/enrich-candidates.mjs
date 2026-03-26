/**
 * enrich-candidates.mjs
 *
 * Leest alle kandidaten + hun notities, en:
 *  1. Koppelt de juiste JobOpening op basis van campagnenaam
 *  2. Wijst de juiste medewerker toe (op basis van RoleAssignment)
 *  3. Zet de juiste pijplijnstatus op basis van lead status tekst
 *
 * Gebruik: node scripts/enrich-candidates.mjs
 */

import pg from 'pg';

const { Client } = pg;

const DB_URL = 'postgresql://postgres:Zwaluwwelzijn2%40@db.oygbjxzpwnuyxgycofil.supabase.co:5432/postgres';

// ─── Mappings ─────────────────────────────────────────────────────────────────

// Campagnenaam → { jobOpeningId, assignedToId }
const CAMPAIGN_MAP = {
  'vacature adviseur vlaanderen':       { jobOpeningId: 'jo-adviseur',               assignedToId: '3f4157fd-f461-4728-a5c4-7369ce7a43e9' }, // Vincent
  'vacature medewerker service':        { jobOpeningId: 'jo-binnendienst-technisch', assignedToId: 'e554ba6a-cfd5-4574-9391-27ba21794843' }, // Niels
  'vacature monteur':                   { jobOpeningId: 'jo-monteur',                assignedToId: 'e554ba6a-cfd5-4574-9391-27ba21794843' }, // Niels
};

// Patronen die duiden op INTERVIEW (afspraak ingepland)
const INTERVIEW_PATTERNS = [
  /afspraak/i,
  /gesprek/i,
  /\d{1,2}[:\-\.]\d{2}\s*(uur)?/,         // tijdsnotatie: 10:00, 15:30, 10.00
  /\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\b/i,
  /\b(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)\b/i,
  /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/,     // datum: 12/03/2026
  /positief/i,
  /^(ja|ja!)$/i,
];

// Patronen die duiden op REJECTED
const REJECTED_PATTERNS = [
  /geen interesse/i,
  /niet (meer )?geïnteresseerd/i,
  /niet capabel/i,
  /niet geschikt/i,
  /te ver/i,
  /te oud/i,
  /foutief nummer/i,
  /fout nummer/i,
  /verkeerd nummer/i,
  /zzp/i,
  /zelfstandig/i,
  /woont niet in nederland/i,
  /buitenland/i,
  /al werk/i,
  /heeft werk/i,
  /gevonden werk/i,
  /ander werk/i,
  /doet het niet meer/i,
  /komt niet opdagen/i,
  /no show/i,
  /dubbel/i,
  /spam/i,
  /nep/i,
  /minderjarig/i,
  /student/i,
  /geen rijbewijs/i,
  /taalbarrière/i,
  /niet bereikbaar na/i,
  /niet meer bellen/i,
  /uitgeschreven/i,
  /teruggetrokken/i,
  /afgezegd/i,
  /annuleer/i,
  /gecanceld/i,
  /cancel/i,
  /withdrawn/i,
];

// Patronen die duiden op PRE_SCREENING (screeningsformulier verstuurd)
const PRE_SCREENING_PATTERNS = [
  /formulier/i,
  /screening/i,
  /vragenlijst/i,
];

// ─── Status bepalen ───────────────────────────────────────────────────────────

function determineStatus(leadStatus) {
  if (!leadStatus || !leadStatus.trim()) return null; // behoud huidige status

  const s = leadStatus.trim();

  // Eerst op REJECTED checken
  for (const pat of REJECTED_PATTERNS) {
    if (pat.test(s)) return 'REJECTED';
  }

  // Dan INTERVIEW
  for (const pat of INTERVIEW_PATTERNS) {
    if (pat.test(s)) return 'INTERVIEW';
  }

  // Dan PRE_SCREENING
  for (const pat of PRE_SCREENING_PATTERNS) {
    if (pat.test(s)) return 'PRE_SCREENING';
  }

  // Lege/generieke statussen → NEW_LEAD
  const genericStatuses = ['created', 'gg', 'vm', 'voicemail', 'ig', 'nieuw', 'new',
    'donderdag terugbellen', 'vrijdag terugbellen', 'maandag terugbellen',
    'direct persoon niet beschikbaar', 'terugbellen', 'callback', 'later',
    'geen gehoor', 'bezet', 'niet opgenomen'];
  const sLower = s.toLowerCase();
  for (const g of genericStatuses) {
    if (sLower.includes(g)) return 'NEW_LEAD';
  }

  // Default: behoud wat er al staat (null = geen update)
  return null;
}

// ─── Campagne → mapping ───────────────────────────────────────────────────────

function getCampaignMapping(campaignName) {
  if (!campaignName) return null;
  const lower = campaignName.toLowerCase();
  for (const [key, mapping] of Object.entries(CAMPAIGN_MAP)) {
    if (lower.includes(key)) return mapping;
  }
  return null;
}

// ─── Note parseren ────────────────────────────────────────────────────────────

function parseNote(content) {
  const result = { leadStatus: null, campaignName: null };

  const statusMatch = content.match(/\*\*Status uit sheet:\*\*\s*(.+)/);
  if (statusMatch) result.leadStatus = statusMatch[1].trim();

  const campMatch = content.match(/\*\*Campagne:\*\*\s*(.+)/);
  if (campMatch) result.campaignName = campMatch[1].trim();

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  try {
    // Haal alle kandidaten op met hun eerste notitie
    const { rows: candidates } = await db.query(`
      SELECT c.id, c.name, c.status, c."jobOpeningId", c."assignedToId",
             n.content AS note
      FROM "Candidate" c
      LEFT JOIN "CandidateNote" n ON n."candidateId" = c.id
      ORDER BY c."createdAt"
    `);

    console.log(`\n📋 ${candidates.length} kandidaatrecords opgehaald\n`);

    let updated = 0;
    let skipped = 0;
    const statusCounts = {};

    for (const cand of candidates) {
      if (!cand.note) { skipped++; continue; }

      const { leadStatus, campaignName } = parseNote(cand.note);

      // Campagne-mapping
      const campaignMapping = getCampaignMapping(campaignName);

      // Status bepalen
      const newStatus = determineStatus(leadStatus);

      // Bouw UPDATE op
      const updates = [];
      const params = [];
      let p = 1;

      if (campaignMapping) {
        if (!cand.jobOpeningId) {
          updates.push(`"jobOpeningId" = $${p++}`);
          params.push(campaignMapping.jobOpeningId);
        }
        if (!cand.assignedToId) {
          updates.push(`"assignedToId" = $${p++}`);
          params.push(campaignMapping.assignedToId);
        }
      }

      if (newStatus && newStatus !== cand.status) {
        updates.push(`status = $${p++}`, `"stageUpdatedAt" = now()`);
        params.push(newStatus);
        statusCounts[newStatus] = (statusCounts[newStatus] ?? 0) + 1;
      }

      if (updates.length === 0) { skipped++; continue; }

      params.push(cand.id);
      await db.query(
        `UPDATE "Candidate" SET ${updates.join(', ')}, "updatedAt" = now() WHERE id = $${p}`,
        params
      );
      updated++;
    }

    console.log(`✅ Klaar!`);
    console.log(`   Bijgewerkt : ${updated}`);
    console.log(`   Overgeslagen: ${skipped}`);
    console.log(`\n   Status-updates:`);
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`     ${status}: ${count}`);
    }

    // Verificatie: tel per status
    const { rows: counts } = await db.query(`
      SELECT status, COUNT(*) FROM "Candidate" GROUP BY status ORDER BY status
    `);
    console.log(`\n📊 Overzicht na update:`);
    counts.forEach(r => console.log(`   ${r.status}: ${r.count}`));

    // Overzicht per job opening
    const { rows: joCounts } = await db.query(`
      SELECT jo.title, COUNT(c.id) as cnt
      FROM "Candidate" c
      LEFT JOIN "JobOpening" jo ON jo.id = c."jobOpeningId"
      GROUP BY jo.title
      ORDER BY cnt DESC
    `);
    console.log(`\n📊 Per vacature:`);
    joCounts.forEach(r => console.log(`   ${r.title ?? '(geen)'}: ${r.cnt}`));

    // Overzicht per medewerker
    const { rows: userCounts } = await db.query(`
      SELECT u.name, COUNT(c.id) as cnt
      FROM "Candidate" c
      LEFT JOIN "User" u ON u.id = c."assignedToId"
      GROUP BY u.name
      ORDER BY cnt DESC
    `);
    console.log(`\n📊 Per medewerker:`);
    userCounts.forEach(r => console.log(`   ${r.name ?? '(niet toegewezen)'}: ${r.cnt}`));

  } finally {
    await db.end();
  }
}

main().catch(err => {
  console.error('\n💥 Script mislukt:', err);
  process.exit(1);
});
