/**
 * Shared helpers for recruitment logic.
 * Imported by API routes — do NOT import client-side.
 */

import { supabaseAdmin } from '@/lib/supabase';

/**
 * Look up RoleAssignment for the given job opening's roleType and, if one
 * exists, set candidateId.assignedToId + send an in-app notification.
 *
 * Returns the assigned user id (or null when nothing was assigned), so callers
 * can e-mail the recruiter as well.
 *
 * Safe to call even if the job has no roleType or no assignment is configured.
 */
export async function autoAssignCandidate(
  candidateId: string,
  candidateName: string,
  jobOpeningId: string,
  opts: { notificationTitle?: string; notificationMessage?: string } = {}
): Promise<string | null> {
  // Fetch the job's roleType
  const { data: job } = await supabaseAdmin
    .from('JobOpening')
    .select('roleType, title')
    .eq('id', jobOpeningId)
    .single();

  if (!job?.roleType) return null;

  // Look up the assignment for this role
  const { data: assignment } = await supabaseAdmin
    .from('RoleAssignment')
    .select('userId')
    .eq('roleType', job.roleType)
    .maybeSingle();

  if (!assignment?.userId) return null;

  // Assign the candidate
  const { error } = await supabaseAdmin
    .from('Candidate')
    .update({ assignedToId: assignment.userId, updatedAt: new Date().toISOString() })
    .eq('id', candidateId);

  if (error) {
    console.error('[recruitment] auto-assign mislukt:', candidateId, error.message);
    return null;
  }

  // Notify the assigned recruiter
  await supabaseAdmin.from('Notification').insert({
    userId: assignment.userId,
    type: 'NEW_CANDIDATE',
    title: opts.notificationTitle ?? `Nieuwe kandidaat toegewezen: ${candidateName}`,
    message:
      opts.notificationMessage ??
      `${candidateName} heeft gesolliciteerd op "${job.title}" en is aan jou toegewezen.`,
    isRead: false,
    linkUrl: `/dashboard/werving/${candidateId}`,
  });

  return assignment.userId as string;
}

/**
 * Wie moet weten dat er iets met deze kandidaat gebeurt? De toegewezen
 * recruiter; zonder toewijzing alle actieve ADMIN's (vangnet).
 */
export async function candidateRecipients(assignedToId: string | null | undefined): Promise<string[]> {
  if (assignedToId) return [assignedToId];
  const { data } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('role', 'ADMIN')
    .eq('isActive', true);
  return ((data ?? []) as { id: string }[]).map((u) => u.id);
}

/** Eerste actieve ADMIN — auteur van systeemnotities (CandidateNote.authorId is verplicht). */
export async function systemNoteAuthorId(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('role', 'ADMIN')
    .eq('isActive', true)
    .order('createdAt', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Emit a CANDIDATE_STAGE_ALERT notification when a candidate moves to a new stage.
 * Sends to the assigned recruiter, or all ADMIN/PLANNER users if unassigned.
 */
export async function notifyStageChange(
  candidateId: string,
  candidateName: string,
  newStatus: string,
  assignedToId: string | null
): Promise<void> {
  const stageLabels: Record<string, string> = {
    CONTACTED: 'Gecontacteerd',
    PRE_SCREENING: 'Pre-screening',
    SCREENING_DONE: 'Screening klaar',
    INTERVIEW: 'Sollicitatiegesprek',
    RESERVE_BANK: 'Reserve Bank',
    HIRED: 'Aangenomen',
    REJECTED: 'Afgewezen',
    WITHDRAWN: 'Teruggetrokken',
  };

  const label = stageLabels[newStatus];
  if (!label) return; // Skip NEW_LEAD and unknown statuses

  let recipientIds: string[] = [];

  if (assignedToId) {
    recipientIds = [assignedToId];
  } else {
    const { data: staff } = await supabaseAdmin
      .from('User')
      .select('id')
      .in('role', ['ADMIN', 'PLANNER'])
      .eq('isActive', true);
    recipientIds = (staff ?? []).map((u: { id: string }) => u.id);
  }

  if (recipientIds.length === 0) return;

  const rows = recipientIds.map((uid) => ({
    userId: uid,
    type: 'CANDIDATE_STAGE_ALERT',
    title: `${candidateName} → ${label}`,
    message: `${candidateName} is verplaatst naar de fase "${label}".`,
    isRead: false,
    linkUrl: `/dashboard/werving/${candidateId}`,
  }));

  await supabaseAdmin.from('Notification').insert(rows);
}

/**
 * Facebook-imports zonder e-mailadres krijgen een placeholder
 * (fb-…@sheets.local, lead-…@facebook-lead.local). Daar mailen we niet naartoe.
 */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  const e = (email ?? '').trim();
  return !!e && e.includes('@') && !/\.local$/i.test(e);
}

export interface MatchableJob {
  id: string;
  slug: string;
  title: string;
  roleType: string | null;
}

/**
 * Koppelt een Facebook-formulier/campagnenaam aan een actieve vacature.
 *
 * 1. Slug of volledige titel komt letterlijk in de naam voor ("Callcenter
 *    Medewerker – okt" → callcenter-medewerker). Langste match wint, zodat
 *    "Commercieel Medewerker Binnendienst" niet als "Binnendienst" telt.
 * 2. Anders trefwoorden per rol. Volgorde is belangrijk: commercieel/callcenter
 *    vóór de generieke "binnendienst" (dat is anders Technische Binnendienst).
 */
export function matchJobForCampaign(name: string, jobs: MatchableJob[]): MatchableJob | null {
  const haystack = name.toLowerCase();
  if (!haystack.trim()) return null;

  const literal = jobs
    .filter((j) => haystack.includes(j.slug.toLowerCase()) || haystack.includes(j.title.toLowerCase()))
    .sort((a, b) => b.title.length - a.title.length);
  if (literal[0]) return literal[0];

  const rules: { keywords: string[]; roleType: string }[] = [
    { keywords: ['commercieel', 'commerciële', 'callcenter', 'call center', 'klantcontact', 'telefonisch'], roleType: 'BINNENDIENST_CALLCENTER' },
    { keywords: ['technische binnendienst', 'tbm', 'werkvoorbereid'], roleType: 'BINNENDIENST_TECHNISCH' },
    { keywords: ['monteur', 'installatie'], roleType: 'MONTEUR' },
    { keywords: ['adviseur', 'sales', 'verkoop', 'buitendienst'], roleType: 'ADVISEUR' },
    { keywords: ['magazijn', 'warehouse', 'logistiek'], roleType: 'WAREHOUSE' },
    { keywords: ['backoffice', 'back office', 'administratie'], roleType: 'BACKOFFICE' },
    { keywords: ['binnendienst'], roleType: 'BINNENDIENST_TECHNISCH' },
  ];
  for (const rule of rules) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      const job = jobs.find((j) => j.roleType === rule.roleType);
      if (job) return job;
    }
  }
  return null;
}
