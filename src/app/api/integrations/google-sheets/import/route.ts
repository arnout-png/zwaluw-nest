import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { readLeadsFromSheet } from '@/lib/google-sheets';

/**
 * GET  /api/integrations/google-sheets/import
 *   Returns all leads from the Google Sheet as preview data.
 *
 * POST /api/integrations/google-sheets/import
 *   Body: { ids: string[] }  — array of ZwaluwNest IDs to skip (already exist)
 *   Imports all rows that don't already exist as Candidates.
 */

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  try {
    const leads = await readLeadsFromSheet();
    return NextResponse.json({ data: leads });
  } catch (err) {
    console.error('Google Sheets read error:', err);
    return NextResponse.json({ error: 'Kan Google Sheet niet lezen. Controleer de instellingen.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const body = await request.json();
  const { skipIds = [] }: { skipIds: string[] } = body;

  try {
    const leads = await readLeadsFromSheet();

    // Filter out leads that already exist or are in the skip list
    const toImport = leads.filter((l) => !l.zwaluwId || !skipIds.includes(l.zwaluwId));

    const inserted: string[] = [];
    const skipped: string[] = [];

    for (const lead of toImport) {
      if (!lead.email && !lead.name) {
        skipped.push(lead.name || 'Leeg');
        continue;
      }

      // Check if candidate with this email already exists
      if (lead.email) {
        const { count } = await supabaseAdmin
          .from('Candidate')
          .select('id', { count: 'exact', head: true })
          .eq('email', lead.email);

        if ((count ?? 0) > 0) {
          skipped.push(lead.name);
          continue;
        }
      }

      const nameParts = lead.name.trim().split(' ');
      const firstName = nameParts[0] ?? 'Onbekend';
      const lastName = nameParts.slice(1).join(' ') || '';

      const consentDate = new Date();
      const consentExpiry = new Date(consentDate);
      consentExpiry.setFullYear(consentExpiry.getFullYear() + 1);

      const { error } = await supabaseAdmin.from('Candidate').insert({
        firstName,
        lastName,
        email: lead.email || `import-${Date.now()}@sheets.local`,
        phone: lead.phone || null,
        status: 'NEW_LEAD',
        source: 'Google Sheets Import',
        leadSource: 'Google Sheets Import',
        leadCampaignId: lead.campaign || null,
        consentGivenAt: consentDate.toISOString(),
        consentExpiresAt: consentExpiry.toISOString(),
      });

      if (error) {
        console.error('Import insert error:', error, lead);
        skipped.push(lead.name);
      } else {
        inserted.push(lead.name);
      }
    }

    return NextResponse.json({
      ok: true,
      imported: inserted.length,
      skipped: skipped.length,
      names: inserted,
    });
  } catch (err) {
    console.error('Google Sheets import error:', err);
    return NextResponse.json({ error: 'Import mislukt. Controleer de Google Sheets instellingen.' }, { status: 500 });
  }
}
