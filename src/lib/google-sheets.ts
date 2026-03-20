import { google } from 'googleapis';

/**
 * Google Sheets helper for ZwaluwNest
 *
 * Uses a Google Service Account (JSON credentials) for server-to-server auth.
 * The service account must be granted Editor access to the target sheet.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_CREDENTIALS  — base64-encoded JSON of the service account key file
 *   GOOGLE_SHEETS_ID                    — the spreadsheet ID from the sheet URL
 *                                         e.g. for https://docs.google.com/spreadsheets/d/XXXX/edit
 *                                         the ID is XXXX
 *
 * Sheet layout (columns A–G):
 *   Datum | Naam | Email | Telefoon | Campagne | Status | ZwaluwNest ID
 */

// Sheet tab name and starting range
const SHEET_TAB = 'Leads';
const HEADER_ROW = ['Datum', 'Naam', 'Email', 'Telefoon', 'Campagne', 'Status', 'ZwaluwNest ID'];

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

/**
 * Ensure the Leads sheet exists with headers. Idempotent.
 */
export async function ensureSheetHeaders() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) return;

  const sheets = getClient();

  // Check if tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_TAB);

  if (!exists) {
    // Create the tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: SHEET_TAB },
            },
          },
        ],
      },
    });

    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER_ROW] },
    });
  }
}

/**
 * Append a new lead row to the Google Sheet.
 */
export async function appendLeadToSheet(row: {
  date: string;
  name: string;
  email: string;
  phone: string;
  campaign: string;
  status: string;
  zwaluwId: string;
}) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    console.warn('GOOGLE_SHEETS_ID not set — skipping sheet append');
    return;
  }

  const sheets = getClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_TAB}!A:G`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [
        [row.date, row.name, row.email, row.phone, row.campaign, row.status, row.zwaluwId],
      ],
    },
  });
}

/**
 * Update the status column (F) for an existing lead row identified by ZwaluwNest ID (column G).
 */
export async function updateLeadStatusInSheet(zwaluwId: string, newStatus: string) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) return;

  const sheets = getClient();

  // Find the row with this ZwaluwNest ID
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!G:G`,
  });

  const rows = response.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[0] === zwaluwId);

  if (rowIndex === -1) return; // Not found

  const sheetRow = rowIndex + 1; // 1-based
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB}!F${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[newStatus]] },
  });
}

/**
 * Read all leads from the Google Sheet for the import preview.
 * Returns an array of objects matching the header columns.
 */
export async function readLeadsFromSheet(): Promise<SheetLead[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) return [];

  const sheets = getClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A:G`,
  });

  const rows = response.data.values ?? [];
  if (rows.length < 2) return []; // Only header or empty

  return rows.slice(1).map((row) => ({
    date: row[0] ?? '',
    name: row[1] ?? '',
    email: row[2] ?? '',
    phone: row[3] ?? '',
    campaign: row[4] ?? '',
    status: row[5] ?? '',
    zwaluwId: row[6] ?? '',
  }));
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
