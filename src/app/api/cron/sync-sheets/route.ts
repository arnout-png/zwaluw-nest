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
type CandidateKey = { email: string | null; leadCampaignId: string | null };

/**
 * Facebook lead-id's komen uit de sheet als "l:123...". Ze zijn historisch opgeslagen
 * met een extra prefix ("l:l:123..."), dus vergelijk altijd op de kale id.
 */
function canonicalLeadId(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/^(?:l:)+/, '');
}

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

    // Bestaande kandidaten in pagina's ophalen. Zonder range kapt PostgREST de lijst
    // af op db.max_rows; dan lijkt de database leeg en importeert de sync alles opnieuw.
    const existing: CandidateKey[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('Candidate')
        .select('email, leadCampaignId')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);

      // Bij een fout stoppen: doorgaan met een halve lijst maakt duplicaten.
      if (error) throw new Error(`Kan bestaande kandidaten niet laden: ${error.message}`);

      const batch = (data ?? []) as CandidateKey[];
      existing.push(...batch);
      if (batch.length < PAGE) break;
    }

    const existingFbIds = new Set(
      existing.map(c => canonicalLeadId(c.leadCampaignId)).filter(Boolean)
    );

    const existingEmails = new Set(
      existing.map(c => (c.email ?? '').toLowerCase().trim()).filter(Boolean)
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

    let skippedUnidentifiable = 0;

    for (const lead of leads) {
      if (!lead.fullName && !lead.email) continue;

      const fbId = canonicalLeadId(lead.facebookLeadId);
      if (fbId && existingFbIds.has(fbId)) continue;

      // Zonder e-mailadres een vaste sleutel afleiden uit het lead-id; met Date.now()
      // was die elke run anders en kwam dezelfde lead telkens opnieuw binnen.
      const email = (lead.email ?? '').trim();
      const finalEmail = email || (fbId ? `fb-${fbId}@sheets.local` : '');
      if (!finalEmail) { skippedUnidentifiable++; continue; }

      const emailKey = finalEmail.toLowerCase();
      if (existingEmails.has(emailKey)) continue;

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
          email:            finalEmail,
          phone:            lead.phone || null,
          status:           'NEW_LEAD',
          leadSource:       'FACEBOOK',
          leadCampaignId:   fbId ? `l:${fbId}` : null,
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

      if (fbId) existingFbIds.add(fbId);
      existingEmails.add(emailKey);
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

    console.log(`[cron/sync-sheets] ${importedCount} nieuwe, ${assignedCount} gekoppeld, ${backfilledCount} backfilled, ${skippedUnidentifiable} zonder e-mail/lead-id overgeslagen`);
    return NextResponse.json({ ok: true, imported: importedCount, assigned: assignedCount, backfilled: backfilledCount, skipped: skippedUnidentifiable });

  } catch (err) {
    console.error('[cron/sync-sheets] Fout:', err);
    return NextResponse.json({ error: 'Sync mislukt.' }, { status: 500 });
  }
}
