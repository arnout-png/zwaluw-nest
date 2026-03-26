import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readAllSheetLeads } from '@/lib/google-sheets';

/**
 * GET /api/cron/sync-sheets
 *
 * Runs every 15 minutes via Vercel Cron.
 * Reads all configured Google Sheets and imports new Facebook leads into ZwaluwNest.
 * Deduplicates by Facebook Lead ID. Adds leadStatus as a CandidateNote.
 *
 * Secured via CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization');
  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const leads = await readAllSheetLeads();
    if (leads.length === 0) {
      return NextResponse.json({ ok: true, message: 'Geen sheets geconfigureerd of leeg.', imported: 0 });
    }

    // Collect existing Facebook Lead IDs
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

    const { data: adminUser } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('role', 'ADMIN')
      .eq('isActive', true)
      .limit(1)
      .maybeSingle();

    const noteAuthorId = adminUser?.id ?? null;

    let importedCount = 0;

    for (const lead of leads) {
      if (lead.facebookLeadId && existingFbIds.has(lead.facebookLeadId)) continue;

      const emailKey = lead.email.toLowerCase().trim();
      if (lead.email && existingEmails.has(emailKey)) continue;
      if (!lead.fullName && !lead.email) continue;

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
          name:             lead.fullName.trim(),
          email:            lead.email || `fb-${lead.facebookLeadId || Date.now()}@sheets.local`,
          phone:            lead.phone || null,
          status:           'NEW_LEAD',
          source:           'Google Sheets (Facebook Leads)',
          leadSource:       'FACEBOOK',
          leadCampaignId:   lead.facebookLeadId || null,
          consentGiven:     true,
          consentDate:      consentDate.toISOString(),
          consentExpiresAt: consentExpiry.toISOString(),
        })
        .select('id')
        .single();

      if (insertErr || !newCandidate) {
        console.error('[cron/sync-sheets] Insert error:', insertErr?.message, lead.fullName);
        continue;
      }

      if (lead.facebookLeadId) existingFbIds.add(lead.facebookLeadId);
      if (lead.email) existingEmails.add(emailKey);
      importedCount++;

      // Add note from sheet status
      const noteParts: string[] = [];
      if (lead.leadStatus?.trim())
        noteParts.push(`**Status uit sheet:** ${lead.leadStatus.trim()}`);
      if (lead.customAnswer?.trim() && lead.customQuestion?.trim())
        noteParts.push(`**${lead.customQuestion}:** ${lead.customAnswer.trim()}`);
      if (lead.campaignName?.trim())
        noteParts.push(`**Campagne:** ${lead.campaignName.trim()}`);
      if (lead.platform?.trim())
        noteParts.push(`**Platform:** ${lead.platform.toUpperCase()}`);

      if (noteParts.length > 0 && noteAuthorId) {
        await supabaseAdmin.from('CandidateNote').insert({
          candidateId: newCandidate.id,
          authorId:    noteAuthorId,
          content:     noteParts.join('\n'),
        });
      }
    }

    console.log(`[cron/sync-sheets] ${importedCount} nieuwe kandidaten geïmporteerd`);
    return NextResponse.json({ ok: true, imported: importedCount });

  } catch (err) {
    console.error('[cron/sync-sheets] Fout:', err);
    return NextResponse.json({ error: 'Sync mislukt.' }, { status: 500 });
  }
}
