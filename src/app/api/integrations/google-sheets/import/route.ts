import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { readAllSheetLeads } from '@/lib/google-sheets';

/**
 * GET  /api/integrations/google-sheets/import
 *   Preview all leads from all configured sheets.
 *
 * POST /api/integrations/google-sheets/import
 *   Import new leads into ZwaluwNest as Candidates.
 *   Deduplicates by Facebook Lead ID and by email.
 *   Adds leadStatus column content as a CandidateNote.
 */

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  try {
    const leads = await readAllSheetLeads();
    return NextResponse.json({ data: leads, total: leads.length });
  } catch (err) {
    console.error('Google Sheets read error:', err);
    return NextResponse.json(
      { error: 'Kan Google Sheet niet lezen. Controleer de instellingen.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun === true;

  try {
    const leads = await readAllSheetLeads();

    // Collect existing Facebook Lead IDs for deduplication
    const { data: existingByFbId } = await supabaseAdmin
      .from('Candidate')
      .select('leadCampaignId')
      .not('leadCampaignId', 'is', null)
      .like('leadCampaignId', 'l:%');

    const existingFbIds = new Set(
      (existingByFbId ?? []).map((c: { leadCampaignId: string }) => c.leadCampaignId)
    );

    const { data: existingByEmail } = await supabaseAdmin
      .from('Candidate')
      .select('email');

    const existingEmails = new Set(
      (existingByEmail ?? []).map((c: { email: string }) => c.email.toLowerCase().trim())
    );

    // Use first ADMIN user as note author for automated imports
    const { data: adminUser } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('role', 'ADMIN')
      .eq('isActive', true)
      .limit(1)
      .maybeSingle();

    const noteAuthorId = adminUser?.id ?? null;

    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const lead of leads) {
      // Deduplicate by Facebook Lead ID
      if (lead.facebookLeadId && existingFbIds.has(lead.facebookLeadId)) {
        skipped.push(`${lead.fullName} (al geïmporteerd)`);
        continue;
      }

      // Deduplicate by email
      const emailKey = lead.email.toLowerCase().trim();
      if (lead.email && existingEmails.has(emailKey)) {
        skipped.push(`${lead.fullName} (e-mail bestaat al)`);
        continue;
      }

      if (!lead.fullName && !lead.email) {
        skipped.push('Lege rij');
        continue;
      }

      if (dryRun) {
        imported.push(lead.fullName || lead.email);
        continue;
      }

      const nameParts  = lead.fullName.trim().split(' ');
      const firstName  = nameParts[0] ?? 'Onbekend';
      const lastName   = nameParts.slice(1).join(' ') || '';

      const consentDate   = new Date();
      const consentExpiry = new Date(consentDate);
      consentExpiry.setFullYear(consentExpiry.getFullYear() + 1);

      const { data: newCandidate, error: insertErr } = await supabaseAdmin
        .from('Candidate')
        .insert({
          firstName,
          lastName,
          name:            lead.fullName.trim(),
          email:           lead.email || `fb-${lead.facebookLeadId || Date.now()}@sheets.local`,
          phone:           lead.phone || null,
          status:          'NEW_LEAD',
          source:          'Google Sheets (Facebook Leads)',
          leadSource:      'FACEBOOK',
          leadCampaignId:  lead.facebookLeadId || null,
          consentGiven:    true,
          consentDate:     consentDate.toISOString(),
          consentExpiresAt: consentExpiry.toISOString(),
        })
        .select('id')
        .single();

      if (insertErr || !newCandidate) {
        console.error('[Sheets import] Insert error:', insertErr, lead.fullName);
        errors.push(lead.fullName || lead.email);
        continue;
      }

      // Track for session dedup
      if (lead.facebookLeadId) existingFbIds.add(lead.facebookLeadId);
      if (lead.email) existingEmails.add(emailKey);
      imported.push(lead.fullName || lead.email);

      // Build note from sheet status column + custom answer + meta
      const noteParts: string[] = [];

      if (lead.leadStatus?.trim()) {
        noteParts.push(`**Status uit sheet:** ${lead.leadStatus.trim()}`);
      }
      if (lead.customAnswer?.trim() && lead.customQuestion?.trim()) {
        noteParts.push(`**${lead.customQuestion}:** ${lead.customAnswer.trim()}`);
      }
      if (lead.campaignName?.trim()) {
        noteParts.push(`**Campagne:** ${lead.campaignName.trim()}`);
      }
      if (lead.platform?.trim()) {
        noteParts.push(`**Platform:** ${lead.platform.toUpperCase()}`);
      }

      if (noteParts.length > 0 && noteAuthorId) {
        await supabaseAdmin.from('CandidateNote').insert({
          candidateId: newCandidate.id,
          authorId:    noteAuthorId,
          content:     noteParts.join('\n'),
        });
      }
    }

    return NextResponse.json({
      ok:           true,
      dryRun,
      imported:     imported.length,
      skipped:      skipped.length,
      errors:       errors.length,
      names:        imported,
      skippedNames: skipped,
    });
  } catch (err) {
    console.error('Google Sheets import error:', err);
    return NextResponse.json(
      { error: 'Import mislukt. Controleer de Google Sheets instellingen.' },
      { status: 500 }
    );
  }
}
