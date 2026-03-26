/**
 * Shared helpers for recruitment logic.
 * Imported by API routes — do NOT import client-side.
 */

import { supabaseAdmin } from '@/lib/supabase';

/**
 * Look up RoleAssignment for the given job opening's roleType and, if one
 * exists, set candidateId.assignedToId + send an in-app notification.
 *
 * Safe to call even if the job has no roleType or no assignment is configured.
 */
export async function autoAssignCandidate(
  candidateId: string,
  candidateName: string,
  jobOpeningId: string
): Promise<void> {
  // Fetch the job's roleType
  const { data: job } = await supabaseAdmin
    .from('JobOpening')
    .select('roleType, title')
    .eq('id', jobOpeningId)
    .single();

  if (!job?.roleType) return;

  // Look up the assignment for this role
  const { data: assignment } = await supabaseAdmin
    .from('RoleAssignment')
    .select('userId')
    .eq('roleType', job.roleType)
    .single();

  if (!assignment?.userId) return;

  // Assign the candidate
  await supabaseAdmin
    .from('Candidate')
    .update({ assignedToId: assignment.userId, updatedAt: new Date().toISOString() })
    .eq('id', candidateId);

  // Notify the assigned recruiter
  await supabaseAdmin.from('Notification').insert({
    userId: assignment.userId,
    type: 'NEW_CANDIDATE',
    title: `Nieuwe kandidaat toegewezen: ${candidateName}`,
    message: `${candidateName} heeft gesolliciteerd op "${job.title}" en is aan jou toegewezen.`,
    isRead: false,
    linkUrl: `/dashboard/werving/${candidateId}`,
  });
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
