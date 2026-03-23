import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendContractExpiryEmail,
  sendPoortwachterEmail,
} from '@/lib/email';

/**
 * POST /api/cron/daily-checks
 * Runs every day at 07:00 (configured in vercel.json).
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Onbevoegd.' }, { status: 401 });
  }

  const results: string[] = [];

  // ─── Fetch admin users for notifications ──────────────────────────────────
  const { data: admins } = await supabaseAdmin
    .from('User')
    .select('id, email, name')
    .eq('role', 'ADMIN')
    .eq('isActive', true);

  const adminIds = (admins ?? []).map((a: { id: string }) => a.id);

  // ─── 1. Contract expiry checks ────────────────────────────────────────────
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  for (const threshold of [30, 60]) {
    const targetDate = new Date(today.getTime() + threshold * 24 * 60 * 60 * 1000);
    const targetStr = targetDate.toISOString().split('T')[0];

    // Get contracts expiring soon via EmployeeProfile → User join
    const { data: contracts } = await supabaseAdmin
      .from('Contract')
      .select(
        `id, employeeProfileId, endDate,
         employeeProfile:EmployeeProfile!Contract_employeeProfileId_fkey (
           userId,
           user:User!EmployeeProfile_userId_fkey (id, name, email)
         )`
      )
      .eq('status', 'ACTIVE')
      .not('endDate', 'is', null)
      .gte('endDate', todayStr)
      .lte('endDate', targetStr);

    for (const contract of contracts ?? []) {
      const profileRaw = (contract as Record<string, unknown>).employeeProfile;
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
      const userRaw = (profile as Record<string, unknown> | undefined)?.user;
      const user = Array.isArray(userRaw)
        ? (userRaw[0] as { id: string; name: string; email: string } | undefined)
        : (userRaw as { id: string; name: string; email: string } | undefined);
      if (!user) continue;

      const daysLeft = Math.ceil(
        (new Date(contract.endDate as string).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Deduplicate
      const { count } = await supabaseAdmin
        .from('Notification')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'CONTRACT_EXPIRING')
        .like('message', `%${contract.id}%`)
        .gte('createdAt', todayStr + 'T00:00:00');

      if ((count ?? 0) > 0) continue;

      const notifRows = adminIds.map((adminId: string) => ({
        userId: adminId,
        type: 'CONTRACT_EXPIRING',
        title: `Contract verloopt over ${daysLeft} dagen`,
        message: `Contract van ${user.name} (ID: ${contract.id}) verloopt over ${daysLeft} dagen op ${contract.endDate}.`,
        isRead: false,
        linkUrl: '/dashboard/personeel',
      }));

      if (notifRows.length > 0) {
        await supabaseAdmin.from('Notification').insert(notifRows);
      }

      if (threshold === 30 && process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
        try {
          await sendContractExpiryEmail({
            to: process.env.ADMIN_EMAIL,
            employeeName: user.name,
            endDate: contract.endDate as string,
            daysLeft,
          });
        } catch (err) {
          console.error('Contract expiry email failed:', err);
        }
      }

      results.push(`Contract ${contract.id} (${user.name}): ${daysLeft} dagen`);
    }
  }

  // ─── 2. Poortwachter week checks ─────────────────────────────────────────
  const poortwachterMilestones = [
    {
      week: 6,
      days: 42,
      field: 'week6ProblemAnalysis',
      action: 'Plan de probleemanalyse en het plan van aanpak (UWV eis week 8).',
    },
    {
      week: 8,
      days: 56,
      field: 'week8ActionPlan',
      action: 'Stel het plan van aanpak op samen met de medewerker (verplicht voor UWV).',
    },
    {
      week: 42,
      days: 294,
      field: 'week42UwvNotification',
      action: 'Dien de ziekmelding in bij het UWV. Dit is wettelijk verplicht uiterlijk in week 42.',
    },
  ];

  const { data: activeSick } = await supabaseAdmin
    .from('SickTracker')
    .select(
      `id, employeeProfileId, sicknessStartDate, week6ProblemAnalysis, week8ActionPlan, week42UwvNotification,
       employeeProfile:EmployeeProfile!SickTracker_employeeProfileId_fkey (
         userId,
         user:User!EmployeeProfile_userId_fkey (id, name, email)
       )`
    )
    .is('sicknessEndDate', null);

  for (const sick of activeSick ?? []) {
    const profileRaw = (sick as Record<string, unknown>).employeeProfile;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    const userRaw = (profile as Record<string, unknown> | undefined)?.user;
    const user = Array.isArray(userRaw)
      ? (userRaw[0] as { id: string; name: string; email: string } | undefined)
      : (userRaw as { id: string; name: string; email: string } | undefined);
    if (!user) continue;

    const sickStart = new Date(sick.sicknessStartDate as string);
    const daysIll = Math.floor((today.getTime() - sickStart.getTime()) / (1000 * 60 * 60 * 24));

    for (const milestone of poortwachterMilestones) {
      if (daysIll < milestone.days || daysIll > milestone.days + 1) continue;
      if ((sick as Record<string, unknown>)[milestone.field]) continue;

      const { count } = await supabaseAdmin
        .from('Notification')
        .select('id', { count: 'exact', head: true })
        .like('title', `%Week ${milestone.week}%`)
        .like('message', `%${sick.id}%`)
        .gte('createdAt', todayStr + 'T00:00:00');

      if ((count ?? 0) > 0) continue;

      const sickDateNL = new Date(sick.sicknessStartDate as string).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'long', year: 'numeric',
      });

      const notifRows = adminIds.map((adminId: string) => ({
        userId: adminId,
        type: 'SICK_REPORT',
        title: `Poortwachter Week ${milestone.week} — ${user.name}`,
        message: `${user.name} is ${daysIll} dagen ziek (ID: ${sick.id}). Actie vereist: ${milestone.action}`,
        isRead: false,
        linkUrl: '/dashboard/verzuim',
      }));

      if (notifRows.length > 0) {
        await supabaseAdmin.from('Notification').insert(notifRows);
      }

      if (process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
        try {
          await sendPoortwachterEmail({
            to: process.env.ADMIN_EMAIL,
            employeeName: user.name,
            week: milestone.week,
            sickSince: sickDateNL,
            action: milestone.action,
          });
        } catch (err) {
          console.error('Poortwachter email failed:', err);
        }
      }

      results.push(`Poortwachter week ${milestone.week}: ${user.name}`);
    }
  }

  // ─── 3. AVG consent expiry (3 days) ──────────────────────────────────────
  const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiringConsent } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, consentExpiresAt, status')
    .not('status', 'in', '("HIRED","REJECTED")')
    .not('consentExpiresAt', 'is', null)
    .gte('consentExpiresAt', today.toISOString())
    .lte('consentExpiresAt', in3Days);

  for (const candidate of expiringConsent ?? []) {
    const { count } = await supabaseAdmin
      .from('Notification')
      .select('id', { count: 'exact', head: true })
      .like('message', `%${candidate.id}%`)
      .gte('createdAt', todayStr + 'T00:00:00');

    if ((count ?? 0) > 0) continue;

    const notifRows = adminIds.map((adminId: string) => ({
      userId: adminId,
      type: 'SYSTEM',
      title: 'AVG toestemming verloopt binnenkort',
      message: `AVG toestemming van kandidaat ${(candidate as { name: string }).name} (${candidate.id}) verloopt binnenkort. Verlengen of verwijderen.`,
      isRead: false,
      linkUrl: '/dashboard/werving',
    }));

    if (notifRows.length > 0) {
      await supabaseAdmin.from('Notification').insert(notifRows);
    }

    results.push(`AVG consent: ${(candidate as { name: string }).name}`);
  }

  // ─── 4. Stage duration alerts ─────────────────────────────────────────────
  const stageKeys = [
    'STAGE_ALERT_NEW_LEAD',
    'STAGE_ALERT_PRE_SCREENING',
    'STAGE_ALERT_SCREENING_DONE',
    'STAGE_ALERT_INTERVIEW',
    'STAGE_ALERT_RESERVE_BANK',
  ];

  const stageDefaults: Record<string, number> = {
    STAGE_ALERT_NEW_LEAD: 3,
    STAGE_ALERT_PRE_SCREENING: 5,
    STAGE_ALERT_SCREENING_DONE: 3,
    STAGE_ALERT_INTERVIEW: 7,
    STAGE_ALERT_RESERVE_BANK: 30,
  };

  const stageStatusMap: Record<string, string> = {
    STAGE_ALERT_NEW_LEAD: 'NEW_LEAD',
    STAGE_ALERT_PRE_SCREENING: 'PRE_SCREENING',
    STAGE_ALERT_SCREENING_DONE: 'SCREENING_DONE',
    STAGE_ALERT_INTERVIEW: 'INTERVIEW',
    STAGE_ALERT_RESERVE_BANK: 'RESERVE_BANK',
  };

  const stageLabels: Record<string, string> = {
    NEW_LEAD: 'Nieuw',
    PRE_SCREENING: 'Pre-screening',
    SCREENING_DONE: 'Screening klaar',
    INTERVIEW: 'Interview',
    RESERVE_BANK: 'Reserve Bank',
  };

  const { data: thresholdRows } = await supabaseAdmin
    .from('AppSetting')
    .select('key, value')
    .in('key', stageKeys);

  const thresholds: Record<string, number> = { ...stageDefaults };
  for (const row of thresholdRows ?? []) {
    thresholds[row.key] = Number(row.value) || 0;
  }

  for (const key of stageKeys) {
    const days = thresholds[key];
    if (!days || days <= 0) continue;

    const status = stageStatusMap[key];
    const cutoff = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleCandidates } = await supabaseAdmin
      .from('Candidate')
      .select('id, name, status, assignedToId, stageUpdatedAt, updatedAt')
      .eq('status', status)
      .or(`stageUpdatedAt.lte.${cutoff},and(stageUpdatedAt.is.null,updatedAt.lte.${cutoff})`);

    for (const candidate of staleCandidates ?? []) {
      const cand = candidate as {
        id: string; name: string; status: string;
        assignedToId: string | null; stageUpdatedAt: string | null; updatedAt: string;
      };

      // Dedup: skip if already notified today for this candidate
      const { count: existingCount } = await supabaseAdmin
        .from('Notification')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'CANDIDATE_STAGE_ALERT')
        .eq('linkUrl', `/dashboard/werving/${cand.id}`)
        .gte('createdAt', todayStr + 'T00:00:00');

      if ((existingCount ?? 0) > 0) continue;

      const since = cand.stageUpdatedAt ?? cand.updatedAt;
      const daysInStage = Math.floor(
        (today.getTime() - new Date(since).getTime()) / (1000 * 60 * 60 * 24)
      );

      const label = stageLabels[status] ?? status;
      const recipientIds: string[] = cand.assignedToId ? [cand.assignedToId] : adminIds;

      const notifRows = recipientIds.map((uid: string) => ({
        userId: uid,
        type: 'CANDIDATE_STAGE_ALERT',
        title: `Kandidaat al ${daysInStage} dagen in "${label}"`,
        message: `${cand.name} staat al ${daysInStage} dagen in de fase "${label}". Actie vereist.`,
        isRead: false,
        linkUrl: `/dashboard/werving/${cand.id}`,
      }));

      if (notifRows.length > 0) {
        await supabaseAdmin.from('Notification').insert(notifRows);
      }

      results.push(`Stage alert: ${cand.name} (${daysInStage} dagen in ${label})`);
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    items: results,
    ran: new Date().toISOString(),
  });
}
