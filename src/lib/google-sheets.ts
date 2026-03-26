import { google } from 'googleapis';

/**
 * Google Sheets integration for ZwaluwNest
 *
 * Reads Facebook Lead Ads exports from Google Sheets.
 * Sheet columns (from Facebook export):
 *   id | created_time | ad_id | ad_name | adset_id | adset_name |
 *   campaign_id | campaign_name | form_id | form_name | is_organic | platform |
 *   <custom question> | email | full_name | phone_number | lead_status
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_CREDENTIALS  — base64-encoded service account JSON
 *   GOOGLE_SHEETS_IDS                   — comma-separated spreadsheet IDs
 *                                         e.g. "id1,id2,id3"
 *                                         (falls back to GOOGLE_SHEETS_ID for single sheet)
 */

function getClient() {
  const credBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS not set');
  const credentials = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function getSheetIds(): string[] {
  const raw = process.env.GOOGLE_SHEETS_IDS ?? process.env.GOOGLE_SHEETS_ID ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function stripPhonePrefix(raw: string): string {
  // Facebook exports phone as "p:+31612345678" — strip the prefix
  return raw.replace(/^p:/, '').trim();
}

export interface FacebookSheetLead {
  facebookLeadId: string;     // id column — unique Facebook lead ID
  createdTime: string;        // created_time
  campaignName: string;       // campaign_name — identifies the vacancy
  formName: string;           // form_name
  platform: string;           // ig / fb
  customAnswer: string;       // e.g. experience question answer
  customQuestion: string;     // the question label itself
  email: string;
  fullName: string;
  phone: string;              // normalized (p: prefix stripped)
  leadStatus: string;         // notes/status added by recruiter in sheet
  spreadsheetId: string;
}

/**
 * Read all leads from all configured Google Sheets.
 */
export async function readAllSheetLeads(): Promise<FacebookSheetLead[]> {
  const sheetIds = getSheetIds();
  if (sheetIds.length === 0) return [];

  const sheets = getClient();
  const allLeads: FacebookSheetLead[] = [];

  for (const spreadsheetId of sheetIds) {
    try {
      // Auto-detect first tab name
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const firstTab = meta.data.sheets?.[0]?.properties?.title ?? 'Blad1';

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${firstTab}!A:S`,
      });

      const rows = response.data.values ?? [];
      if (rows.length < 2) continue;

      const headers = rows[0].map((h: string) => (h ?? '').toString().toLowerCase().trim());

      // Standard Facebook column names
      const STANDARD_COLS = new Set([
        'id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name',
        'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic',
        'platform', 'email', 'full_name', 'phone_number', 'lead_status',
      ]);

      function colIdx(key: string) {
        return headers.findIndex((h: string) => h === key || h.startsWith(key));
      }

      const idCol        = colIdx('id');
      const timeCol      = colIdx('created_time');
      const campaignCol  = colIdx('campaign_name');
      const formCol      = colIdx('form_name');
      const platformCol  = colIdx('platform');
      const emailCol     = colIdx('email');
      const nameCol      = colIdx('full_name');
      const phoneCol     = colIdx('phone_number');
      const statusCol    = colIdx('lead_status');

      // Custom question = first non-standard column
      const customCol    = headers.findIndex(
        (h: string) => !STANDARD_COLS.has(h) && h.length > 3
      );
      const customQuestion = customCol >= 0 ? (rows[0][customCol] ?? '') : '';

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
          customQuestion: customQuestion as string,
          email,
          fullName:       name,
          phone:          stripPhonePrefix(row[phoneCol] ?? ''),
          leadStatus:     row[statusCol]   ?? '',
          spreadsheetId,
        });
      }
    } catch (err) {
      console.error(`[Sheets] Fout bij lezen ${spreadsheetId}:`, err);
    }
  }

  return allLeads;
}

/**
 * @deprecated — use readAllSheetLeads() instead.
 * Kept for backward compatibility with older import route.
 */
export async function readLeadsFromSheet(): Promise<SheetLead[]> {
  const leads = await readAllSheetLeads();
  return leads.map((l) => ({
    date: l.createdTime,
    name: l.fullName,
    email: l.email,
    phone: l.phone,
    campaign: l.campaignName,
    status: l.leadStatus,
    zwaluwId: '',
  }));
}

/**
 * Append a new lead row to a specific Google Sheet.
 */
export async function appendLeadToSheet(
  spreadsheetId: string,
  row: { date: string; name: string; email: string; phone: string; campaign: string; status: string; zwaluwId: string }
) {
  if (!spreadsheetId) return;
  const sheets = getClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = meta.data.sheets?.[0]?.properties?.title ?? 'Blad1';

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:G`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[row.date, row.name, row.email, row.phone, row.campaign, row.status, row.zwaluwId]],
    },
  });
}

export interface SheetLead {
  date: string;
  name: string;
  email: string;
  phone: string;
  campaign: string;
  status: string;
  zwaluwId: string;
}
