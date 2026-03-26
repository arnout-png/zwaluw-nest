/**
 * reset-and-import-candidates.mjs
 *
 * 1. Verwijdert alle bestaande kandidaten (+ cascade: notes, scores, etc.)
 * 2. Leest alle leads uit de geconfigureerde Google Sheets
 * 3. Importeert ze als nieuwe kandidaten zonder notificaties te versturen
 *
 * Gebruik: node scripts/reset-and-import-candidates.mjs
 */

import 'dotenv/config';
import pg from 'pg';
import { google } from 'googleapis';

const { Client } = pg;

const DB_URL = 'postgresql://postgres:Zwaluwwelzijn2%40@db.oygbjxzpwnuyxgycofil.supabase.co:5432/postgres';

// ─── DB helper ───────────────────────────────────────────────────────────────

async function getClient() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

// ─── Sheets helper ───────────────────────────────────────────────────────────

function getSheetsClient() {
  const credBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS not set');
  const credentials = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function getSheetIds() {
  const raw = process.env.GOOGLE_SHEETS_IDS ?? process.env.GOOGLE_SHEETS_ID ?? '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function stripPhonePrefix(raw) {
  return (raw ?? '').replace(/^p:/, '').trim();
}

const STANDARD_COLS = new Set([
  'id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name',
  'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic',
  'platform', 'email', 'full_name', 'phone_number', 'lead_status',
]);

async function readAllLeads() {
  const sheetIds = getSheetIds();
  console.log(`📊 Sheets geconfigureerd: ${sheetIds.length}`);
  if (sheetIds.length === 0) return [];

  const sheets = getSheetsClient();
  const allLeads = [];

  for (const spreadsheetId of sheetIds) {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const firstTab = meta.data.sheets?.[0]?.properties?.title ?? 'Blad1';
      console.log(`  → Sheet "${firstTab}" (${spreadsheetId.slice(0, 8)}...)`);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${firstTab}!A:S`,
      });

      const rows = response.data.values ?? [];
      if (rows.length < 2) { console.log(`     (leeg)`); continue; }

      const headers = rows[0].map(h => (h ?? '').toString().toLowerCase().trim());

      function colIdx(key) {
        return headers.findIndex(h => h === key || h.startsWith(key));
      }

      const idCol       = colIdx('id');
      const timeCol     = colIdx('created_time');
      const campaignCol = colIdx('campaign_name');
      const formCol     = colIdx('form_name');
      const platformCol = colIdx('platform');
      const emailCol    = colIdx('email');
      const nameCol     = colIdx('full_name');
      const phoneCol    = colIdx('phone_number');
      const statusCol   = colIdx('lead_status');
      const customCol   = headers.findIndex(h => !STANDARD_COLS.has(h) && h.length > 3);
      const customQuestion = customCol >= 0 ? (rows[0][customCol] ?? '') : '';

      let sheetCount = 0;
      for (const row of rows.slice(1)) {
        const name  = row[nameCol]  ?? '';
        const email = row[emailCol] ?? '';
        if (!name && !email) continue;

        allLeads.push({
          facebookLeadId: row[idCol]       ?? '',
          createdTime:    row[timeCol]     ?? '',
          campaignName:   row[campaignCol] ?? '',
          formName:       row[formCol]     ?? '',
          platform:       row[platformCol] ?? '',
          customAnswer:   customCol >= 0 ? (row[customCol] ?? '') : '',
          customQuestion,
          email,
          fullName:       name,
          phone:          stripPhonePrefix(row[phoneCol] ?? ''),
          leadStatus:     row[statusCol]   ?? '',
          spreadsheetId,
        });
        sheetCount++;
      }
      console.log(`     ${sheetCount} leads gelezen`);
    } catch (err) {
      console.error(`  ❌ Fout bij lezen ${spreadsheetId}:`, err.message);
    }
  }

  return allLeads;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getClient();

  try {
    // ── Stap 1: Opschonen ──────────────────────────────────────────────────
    console.log('\n🗑️  Kandidaten opschonen...');

    const { rows: countRows } = await db.query('SELECT COUNT(*) FROM "Candidate"');
    const before = parseInt(countRows[0].count);
    console.log(`   ${before} kandidaten gevonden`);

    if (before > 0) {
      // CASCADE verwijdert automatisch: CandidateNote, CandidateNoteMention,
      // InterviewScore, ScreeningAnswer, InterviewChecklistResult, CallLog, etc.
      await db.query('TRUNCATE TABLE "Candidate" CASCADE');
      console.log(`   ✓ ${before} kandidaten + alle gekoppelde records verwijderd`);
    } else {
      console.log('   (al leeg)');
    }

    // ── Stap 2: Sheets lezen ───────────────────────────────────────────────
    console.log('\n📥 Leads ophalen uit Google Sheets...');
    const leads = await readAllLeads();
    console.log(`   Totaal: ${leads.length} leads`);

    if (leads.length === 0) {
      console.log('\n⚠️  Geen leads gevonden. Klaar.');
      return;
    }

    // ── Stap 3: Admin user ophalen voor notities ───────────────────────────
    const { rows: adminRows } = await db.query(
      `SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" = true LIMIT 1`
    );
    const noteAuthorId = adminRows[0]?.id ?? null;

    // ── Stap 4: Importeren ─────────────────────────────────────────────────
    console.log('\n📤 Kandidaten importeren...');

    const seenFbIds  = new Set();
    const seenEmails = new Set();
    let imported = 0;
    let skipped  = 0;

    for (const lead of leads) {
      // Dedupliceer binnen deze batch
      if (lead.facebookLeadId && seenFbIds.has(lead.facebookLeadId)) { skipped++; continue; }
      const emailKey = (lead.email ?? '').toLowerCase().trim();
      if (emailKey && seenEmails.has(emailKey)) { skipped++; continue; }
      if (!lead.fullName && !lead.email) { skipped++; continue; }

      const nameParts   = (lead.fullName ?? '').trim().split(' ');
      const firstName   = nameParts[0] || 'Onbekend';
      const lastName    = nameParts.slice(1).join(' ') || '';
      const consentDate = new Date();
      const consentExp  = new Date(consentDate);
      consentExp.setFullYear(consentExp.getFullYear() + 1);

      // Bepaal status op basis van leadStatus uit sheet
      const sheetStatus = (lead.leadStatus ?? '').toLowerCase();
      let status = 'NEW_LEAD';
      if (sheetStatus.includes('screening') || sheetStatus.includes('pre')) status = 'PRE_SCREENING';
      else if (sheetStatus.includes('interview') || sheetStatus.includes('gesprek')) status = 'INTERVIEW';
      else if (sheetStatus.includes('reserve')) status = 'RESERVE_BANK';
      else if (sheetStatus.includes('aangenomen') || sheetStatus.includes('hired')) status = 'HIRED';
      else if (sheetStatus.includes('afgewezen') || sheetStatus.includes('reject')) status = 'REJECTED';

      try {
        const { rows: [newCand] } = await db.query(
          `INSERT INTO "Candidate" (
            id, name, email, phone, status,
            "leadSource", "leadCampaignId",
            "consentGiven", "consentDate", "consentExpiresAt",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            $5, $6,
            true, $7, $8,
            now(), now()
          ) RETURNING id`,
          [
            lead.fullName.trim(),
            lead.email || `fb-${lead.facebookLeadId || Date.now()}@sheets.local`,
            lead.phone || null,
            status,
            'FACEBOOK',
            lead.facebookLeadId || null,
            consentDate.toISOString(),
            consentExp.toISOString(),
          ]
        );

        if (lead.facebookLeadId) seenFbIds.add(lead.facebookLeadId);
        if (emailKey) seenEmails.add(emailKey);
        imported++;

        // Voeg notitie toe met context uit de sheet
        const noteParts = [];
        if (lead.leadStatus?.trim())
          noteParts.push(`**Status uit sheet:** ${lead.leadStatus.trim()}`);
        if (lead.customAnswer?.trim() && lead.customQuestion?.trim())
          noteParts.push(`**${lead.customQuestion}:** ${lead.customAnswer.trim()}`);
        if (lead.campaignName?.trim())
          noteParts.push(`**Campagne:** ${lead.campaignName.trim()}`);
        if (lead.platform?.trim())
          noteParts.push(`**Platform:** ${lead.platform.toUpperCase()}`);
        if (lead.createdTime?.trim())
          noteParts.push(`**Datum lead:** ${lead.createdTime.trim()}`);

        if (noteParts.length > 0 && noteAuthorId) {
          await db.query(
            `INSERT INTO "CandidateNote" (id, "candidateId", "authorId", content, "createdAt")
             VALUES (gen_random_uuid(), $1, $2, $3, now())`,
            [newCand.id, noteAuthorId, noteParts.join('\n')]
          );
        }

        process.stdout.write(`\r   ${imported} geïmporteerd...`);
      } catch (err) {
        console.error(`\n   ❌ Fout bij ${lead.fullName}: ${err.message}`);
      }
    }

    console.log(`\n\n✅ Klaar!`);
    console.log(`   Geïmporteerd : ${imported}`);
    console.log(`   Overgeslagen  : ${skipped} (dubbelen)`);
    console.log(`   Totaal leads  : ${leads.length}`);

  } finally {
    await db.end();
  }
}

main().catch(err => {
  console.error('\n💥 Script mislukt:', err);
  process.exit(1);
});
