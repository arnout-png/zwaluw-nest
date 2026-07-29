import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readAllSheetLeads, mapLeadStatusToCallStatus } from '@/lib/google-sheets';

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
  // Allow access via CRON_SECRET header OR authenticated ADMIN session
  const secret = request.headers.get('authorization');
  const cronOk = !process.env.CRON_SECRET || secret === `Bearer ${process.env.CRON_SECRET}`;

  if (!cronOk) {
    // Fallback: check if logged-in admin
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

    // Fetch all active job openings for campaign → vacature mapping
    const { data: jobOpenings } = await supabaseAdmin
      .from('JobOpening')
      .select('id, title, roleType')
      .eq('isActive', true);

    type JobRow = { id: string; title: string; roleType: string };
    const jobs = (jobOpenings ?? []) as JobRow[];

    // Map a campaign name to a job opening based on keywords
    function matchJobOpening(campaignName: string, formName: string): string | null {
      const haystack = `${campaignName} ${formName}`.toLowerCase();
      // Order matters: more specific first
      const rules: { keywords: string[]; roleType: string }[] = [
        { keywords: ['monteur', 'installatie', 'installatiemonteur'], roleType: 'MONTEUR' },
        { keywords: ['adviseur', 'sales', 'verkoop', 'buitendienst'], roleType: 'ADVISEUR' },
        { keywords: ['binnendienst', 'technische binnendienst', 'tbm'], roleType: 'BINNENDIENST_TECHNISCH' },
        { keywords: ['callcenter', 'call center', 'klantcontact'], roleType: 'BINNENDIENST_CALLCENTER' },
        { keywords: ['magazijn', 'warehouse', 'logistiek'], roleType: 'WAREHOUSE' },
        { keywords: ['backoffice', 'back office', 'administratie'], roleType: 'BACKOFFICE' },
      ];
      for (const rule of rules) {
        if (rule.keywords.some(kw => haystack.includes(kw))) {
          const job = jobs.find(j => j.roleType === rule.roleType);
          if (job) return job.id;
        }
      }
      return null;
    }

    let importedCount = 0;
    let assignedCount = 0;

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

      // Match to job opening based on campaign/form name
      const jobOpeningId = matchJobOpening(lead.campaignName ?? '', lead.formName ?? '');
      if (jobOpeningId) assignedCount++;

      const { data: newCandidate, error: insertErr } = await supabaseAdmin
        .from('Candidate')
        .insert({
          name:             lead.fullName.trim(),
          email:            lead.email || `fb-${lead.facebookLeadId || Date.now()}@sheets.local`,
          phone:            lead.phone || null,
          status:           'NEW_LEAD',
          leadSource:       'FACEBOOK',
          leadCampaignId:   lead.facebookLeadId ? `l:${lead.facebookLeadId}` : null,
          jobOpeningId:     jobOpeningId,
          consentGiven:     true,
          consentDate:      consentDate.toISOString(),
          consentExpiresAt: consentExpiry.toISOString(),
          stageUpdatedAt:   new Date().toISOString(),
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

      // Create CallLog entry if leadStatus indicates a call was made
      const callStatus = mapLeadStatusToCallStatus(lead.leadStatus);
      if (callStatus && noteAuthorId) {
        await supabaseAdmin.from('CallLog').insert({
          id:          crypto.randomUUID(),
          candidateId: newCandidate.id,
          userId:      noteAuthorId,
          status:      callStatus,
          notes:       lead.leadStatus.trim(),
          callbackAt:  null,
          createdAt:   new Date().toISOString(),
        });
      }
    }

    // Backfill: assign job openings to existing unassigned candidates based on their CandidateNote campaign info
    let backfilledCount = 0;
    const { data: unassigned } = await supabaseAdmin
      .from('Candidate')
      .select('id, name')
      .is('jobOpeningId', null)
      .eq('leadSource', 'FACEBOOK');

    if (unassigned?.length) {
      const candIds = (unassigned as { id: string }[]).map(c => c.id);
      // Fetch notes that contain campaign info
      const { data: notes } = await supabaseAdmin
        .from('CandidateNote')
        .select('candidateId, content')
        .in('candidateId', candIds)
        .like('content', '%Campagne:%');

      for (const note of (notes ?? []) as { candidateId: string; content: string }[]) {
        const match = note.content.match(/\*\*Campagne:\*\*\s*(.+?)(?:\n|$)/);
        if (!match) continue;
        const jobId = matchJobOpening(match[1], '');
        if (jobId) {
          await supabaseAdmin.from('Candidate').update({ jobOpeningId: jobId }).eq('id', note.candidateId);
          backfilledCount++;
        }
      }
    }

    console.log(`[cron/sync-sheets] ${importedCount} nieuwe, ${assignedCount} gekoppeld, ${backfilledCount} backfilled`);
    return NextResponse.json({ ok: true, imported: importedCount, assigned: assignedCount, backfilled: backfilledCount });

  } catch (err) {
    console.error('[cron/sync-sheets] Fout:', err);
    return NextResponse.json({ error: 'Sync mislukt.' }, { status: 500 });
  }
}
