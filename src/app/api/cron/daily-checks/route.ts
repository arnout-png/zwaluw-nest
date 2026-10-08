import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendContractExpiryEmail,
  sendPoortwachterEmail,
  sendLeadSilenceEmail,
  isEmailConfigured,
} from '@/lib/email';
import { amsterdamDateString, addDays, datePart, daysBetween, parseDbTimestamp } from '@/lib/dates';
import { POORTWACHTER_MILESTONES } from '@/lib/verzuim';

export const maxDuration = 300;

/**
 * GET /api/cron/daily-checks
 * Draait elke dag om 07:00 UTC (vercel.json). Vercel Cron roept routes aan met
 * GET en `Authorization: Bearer $CRON_SECRET`. Tot oktober 2026 exporteerde
 * deze route alleen POST, waardoor elke cron-aanroep een 405 kreeg en geen
 * enkele controle (contracten, poortwachter, AVG, fase-alerts, stilte-alarm)
 * ooit heeft gedraaid.
 *
 * Elke controle is idempotent: dubbel draaien op één dag levert geen dubbele
 * meldingen op, en een gemiste dag wordt de volgende run ingehaald.
 */
export async function GET(request: NextRequest) {
  return runDailyChecks(request);
}

/** Handmatig starten (zelfde beveiliging). */
export async function POST(request: NextRequest) {
  return runDailyChecks(request);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed: zonder geheim kan niemand dit starten
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

type UserLite = { id: string; name: string; email: string };
type NotificationRow = {
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  linkUrl: string;
};

async function insertNotifications(rows: NotificationRow[]) {
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from('Notification').insert(rows);
  if (error) console.error('[cron/daily-checks] Notification insert failed:', error.message);
}

/** EmployeeProfile.id → gebruiker (alleen bestaande profielen/gebruikers). */
async function mapProfilesToUsers(profileIds: string[]): Promise<Record<string, UserLite>> {
  const result: Record<string, UserLite> = {};
  if (profileIds.length === 0) return result;
  const { data: eps } = await supabaseAdmin.from('EmployeeProfile').select('id, userId').in('id', profileIds);
  const profiles = (eps ?? []) as { id: string; userId: string }[];
  if (profiles.length === 0) return result;
  const { data: users } = await supabaseAdmin
    .from('User')
    .select('id, name, email')
    .in('id', profiles.map((p) => p.userId));
  const uMap = Object.fromEntries(((users ?? []) as UserLite[]).map((u) => [u.id, u]));
  for (const ep of profiles) {
    if (uMap[ep.userId]) result[ep.id] = uMap[ep.userId];
  }
  return result;
}

async function runDailyChecks(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Onbevoegd.' }, { status: 401 });
  }

  const results: string[] = [];
  const now = new Date();
  const today = amsterdamDateString(now);
  const emailOn = isEmailConfigured() && !!process.env.ADMIN_EMAIL;

  // ─── Admins + actieve gebruikers ─────────────────────────────────────────
  const { data: activeUsers } = await supabaseAdmin
    .from('User')
    .select('id, role')
    .eq('isActive', true);
  const activeUserIds = new Set(((activeUsers ?? []) as { id: string }[]).map((u) => u.id));
  const adminIds = ((activeUsers ?? []) as { id: string; role: string }[])
    .filter((u) => u.role === 'ADMIN')
    .map((u) => u.id);

  // ─── 1. Contracten ───────────────────────────────────────────────────────
  // 1a. Verlopen contracten op EXPIRED zetten (einddatum vóór vandaag).
  {
    const { data: expired, error } = await supabaseAdmin
      .from('Contract')
      .update({ status: 'EXPIRED', updatedAt: new Date().toISOString() })
      .eq('status', 'ACTIVE')
      .not('endDate', 'is', null)
      .lt('endDate', today)
      .select('id');
    if (error) console.error('[cron/daily-checks] Contract expire failed:', error.message);
    if (expired?.length) results.push(`${expired.length} contract(en) op verlopen gezet`);
  }

  // 1b. Signalen bij 60, 30, 14 en 7 dagen vóór de einddatum — elk signaal één keer.
  {
    const SIGNALS = [7, 14, 30, 60];
    const until = addDays(today, 60);
    const { data: contracts } = await supabaseAdmin
      .from('Contract')
      .select('id, employeeProfileId, endDate')
      .eq('status', 'ACTIVE')
      .not('endDate', 'is', null)
      .gte('endDate', today)
      .lte('endDate', `${until}T23:59:59`);

    const rows = (contracts ?? []) as { id: string; employeeProfileId: string; endDate: string }[];
    const userByProfile = await mapProfilesToUsers([...new Set(rows.map((c) => c.employeeProfileId))]);

    const { data: sent } = await supabaseAdmin
      .from('Notification')
      .select('message')
      .eq('type', 'CONTRACT_EXPIRING')
      .gte('createdAt', addDays(today, -75));
    const sentMessages = ((sent ?? []) as { message: string }[]).map((n) => n.message);

    for (const contract of rows) {
      const user = userByProfile[contract.employeeProfileId];
      const end = datePart(contract.endDate);
      if (!user || !end) continue;

      const daysLeft = daysBetween(today, end);
      const signal = SIGNALS.find((s) => daysLeft <= s);
      if (signal === undefined) continue;

      const tag = `(ID: ${contract.id}, signaal ${signal}d)`;
      if (sentMessages.some((m) => m.includes(tag))) continue;

      const endNL = new Date(`${end}T12:00:00Z`).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
      });

      await insertNotifications(adminIds.map((adminId) => ({
        userId: adminId,
        type: 'CONTRACT_EXPIRING',
        title: `Contract verloopt over ${daysLeft} dagen`,
        message: `Contract van ${user.name} verloopt over ${daysLeft} dagen op ${endNL}. ${tag}`,
        isRead: false,
        linkUrl: '/dashboard/personeel',
      })));

      if (signal <= 30 && emailOn) {
        try {
          await sendContractExpiryEmail({
            to: process.env.ADMIN_EMAIL!,
            employeeName: user.name,
            endDate: endNL,
            daysLeft,
          });
        } catch (err) {
          console.error('Contract expiry email failed:', err);
        }
      }

      results.push(`Contract ${user.name}: ${daysLeft} dagen (signaal ${signal}d)`);
    }
  }

  // ─── 2. Wet verbetering poortwachter ─────────────────────────────────────
  // Herinnering één week vóór elke deadline, en (als het te laat is) alsnog
  // één keer. Voorheen alleen op exact dag 42/56/294 (+1): één gemiste cron-run
  // en de melding kwam nooit.
  {
    const { data: activeSick } = await supabaseAdmin
      .from('SickTracker')
      .select('id, employeeProfileId, sicknessStartDate, sicknessEndDate, week6ProblemAnalysis, week8ActionPlan, week42UwvNotification')
      .or(`sicknessEndDate.is.null,sicknessEndDate.gte.${today}`);

    type SickRow = {
      id: string; employeeProfileId: string; sicknessStartDate: string; sicknessEndDate: string | null;
      week6ProblemAnalysis: boolean; week8ActionPlan: boolean; week42UwvNotification: boolean;
    };
    const trackers = (activeSick ?? []) as SickRow[];
    const userByProfile = await mapProfilesToUsers([...new Set(trackers.map((s) => s.employeeProfileId))]);

    const { data: sent } = await supabaseAdmin
      .from('Notification')
      .select('title, message')
      .eq('type', 'SICK_REPORT')
      .like('title', 'Poortwachter%');
    const sentRows = (sent ?? []) as { title: string; message: string }[];

    for (const sick of trackers) {
      const user = userByProfile[sick.employeeProfileId];
      const start = datePart(sick.sicknessStartDate);
      if (!user || !start) continue;

      const daysIll = daysBetween(start, today);
      const sickDateNL = new Date(`${start}T12:00:00Z`).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
      });

      for (const milestone of POORTWACHTER_MILESTONES) {
        if (daysIll < milestone.remindFromDay || sick[milestone.field]) continue;

        const already = sentRows.some(
          (n) => n.title.includes(`Week ${milestone.week} `) && n.message.includes(`(ID: ${sick.id})`)
        );
        if (already) continue;

        const overdue = daysIll > milestone.deadlineDay;
        const title = `Poortwachter Week ${milestone.week} ${overdue ? '(te laat) ' : ''}— ${user.name}`;

        await insertNotifications(adminIds.map((adminId) => ({
          userId: adminId,
          type: 'SICK_REPORT',
          title,
          message: `${user.name} is sinds ${sickDateNL} ziek (${daysIll} dagen). ${milestone.label}: ${milestone.action} (ID: ${sick.id})`,
          isRead: false,
          linkUrl: '/dashboard/verzuim',
        })));

        if (emailOn) {
          try {
            await sendPoortwachterEmail({
              to: process.env.ADMIN_EMAIL!,
              employeeName: user.name,
              week: milestone.week,
              sickSince: sickDateNL,
              action: milestone.action,
            });
          } catch (err) {
            console.error('Poortwachter email failed:', err);
          }
        }

        results.push(`Poortwachter week ${milestone.week}${overdue ? ' (te laat)' : ''}: ${user.name}`);
      }
    }
  }

  // ─── 3. AVG: toestemming verloopt binnen 3 dagen ─────────────────────────
  {
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiringConsent } = await supabaseAdmin
      .from('Candidate')
      .select('id, name, consentExpiresAt, status')
      .not('status', 'in', '("HIRED","REJECTED")')
      .is('deletedAt', null)
      .is('dataDeletedAt', null)
      .not('consentExpiresAt', 'is', null)
      .gte('consentExpiresAt', now.toISOString())
      .lte('consentExpiresAt', in3Days);

    const candidates = (expiringConsent ?? []) as { id: string; name: string }[];
    if (candidates.length > 0) {
      const { data: sent } = await supabaseAdmin
        .from('Notification')
        .select('message')
        .eq('type', 'SYSTEM')
        .like('title', 'AVG toestemming%')
        .gte('createdAt', addDays(today, -7));
      const sentMessages = ((sent ?? []) as { message: string }[]).map((n) => n.message);

      for (const candidate of candidates) {
        if (sentMessages.some((m) => m.includes(`(${candidate.id})`))) continue;

        await insertNotifications(adminIds.map((adminId) => ({
          userId: adminId,
          type: 'SYSTEM',
          title: 'AVG toestemming verloopt binnenkort',
          message: `AVG toestemming van kandidaat ${candidate.name} (${candidate.id}) verloopt binnenkort. Verlengen of verwijderen.`,
          isRead: false,
          linkUrl: `/dashboard/werving/${candidate.id}`,
        })));

        results.push(`AVG consent: ${candidate.name}`);
      }
    }
  }

  // ─── 4. Fase-alerts: kandidaat staat te lang in dezelfde fase ────────────
  // Hooguit één alert per kandidaat per 7 dagen, en nooit één van vóór de
  // laatste fasewissel. Verwijderde kandidaten (prullenbak) tellen niet mee.
  {
    const stageDefaults: Record<string, number> = {
      NEW_LEAD: 3,
      PRE_SCREENING: 5,
      SCREENING_DONE: 3,
      INTERVIEW: 7,
      RESERVE_BANK: 30,
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
      .in('key', Object.keys(stageDefaults).map((s) => `STAGE_ALERT_${s}`));

    const thresholds: Record<string, number> = { ...stageDefaults };
    for (const row of (thresholdRows ?? []) as { key: string; value: string }[]) {
      thresholds[row.key.replace('STAGE_ALERT_', '')] = Number(row.value) || 0;
    }

    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data: recentAlerts } = await supabaseAdmin
      .from('Notification')
      .select('linkUrl, createdAt')
      .eq('type', 'CANDIDATE_STAGE_ALERT')
      .like('title', 'Kandidaat al %')
      .gte('createdAt', weekAgo.toISOString());
    const lastAlertAt = new Map<string, number>();
    for (const n of (recentAlerts ?? []) as { linkUrl: string | null; createdAt: string }[]) {
      const t = parseDbTimestamp(n.createdAt)?.getTime() ?? 0;
      if (n.linkUrl && t > (lastAlertAt.get(n.linkUrl) ?? 0)) lastAlertAt.set(n.linkUrl, t);
    }

    for (const [status, days] of Object.entries(thresholds)) {
      if (!days || days <= 0) continue;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: staleCandidates } = await supabaseAdmin
        .from('Candidate')
        .select('id, name, status, assignedToId, stageUpdatedAt, updatedAt')
        .eq('status', status)
        .is('deletedAt', null)
        .or(`stageUpdatedAt.lte.${cutoff},and(stageUpdatedAt.is.null,updatedAt.lte.${cutoff})`);

      for (const cand of (staleCandidates ?? []) as {
        id: string; name: string; assignedToId: string | null; stageUpdatedAt: string | null; updatedAt: string;
      }[]) {
        const link = `/dashboard/werving/${cand.id}`;
        const since = parseDbTimestamp(cand.stageUpdatedAt ?? cand.updatedAt) ?? now;
        const previous = lastAlertAt.get(link);
        if (previous && previous >= Math.max(since.getTime(), weekAgo.getTime())) continue;

        const daysInStage = Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));
        const label = stageLabels[status] ?? status;
        const recipientIds =
          cand.assignedToId && activeUserIds.has(cand.assignedToId) ? [cand.assignedToId] : adminIds;

        await insertNotifications(recipientIds.map((uid) => ({
          userId: uid,
          type: 'CANDIDATE_STAGE_ALERT',
          title: `Kandidaat al ${daysInStage} dagen in "${label}"`,
          message: `${cand.name} staat al ${daysInStage} dagen in de fase "${label}". Actie vereist.`,
          isRead: false,
          linkUrl: link,
        })));

        results.push(`Stage alert: ${cand.name} (${daysInStage} dagen in ${label})`);
      }
    }
  }

  // ─── 5. Stilte-alarm: leadstroom gestopt ──────────────────────────────────
  // In april 2026 viel de aanvoer vanuit Meta stil zonder dat iemand het merkte;
  // het duurde drie maanden voor dat opviel. Deze check slaat aan zodra er
  // LEAD_SILENCE_DAYS dagen geen enkele nieuwe kandidaat is binnengekomen,
  // maar alleen zolang er nog een vacature openstaat.
  {
    const silenceDays = Number(process.env.LEAD_SILENCE_DAYS ?? 7);

    const { count: openVacancies } = await supabaseAdmin
      .from('JobOpening')
      .select('id', { count: 'exact', head: true })
      .eq('isActive', true);

    if ((openVacancies ?? 0) > 0) {
      // Alleen kandidaten die niet in de prullenbak staan: in september 2026
      // kwamen 552 oude leads opnieuw binnen via de sheet-sync (allemaal
      // verwijderd); die maskeerden dat er sinds juli geen echte sollicitant was.
      const { data: newest } = await supabaseAdmin
        .from('Candidate')
        .select('createdAt')
        .is('deletedAt', null)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastLeadAt = parseDbTimestamp(newest?.createdAt as string | undefined);
      const daysQuiet = lastLeadAt
        ? Math.floor((now.getTime() - lastLeadAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (lastLeadAt && daysQuiet !== null && daysQuiet >= silenceDays) {
        // Hoogstens één melding per week, anders wordt het dagelijkse ruis.
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count: recentAlert } = await supabaseAdmin
          .from('Notification')
          .select('id', { count: 'exact', head: true })
          .eq('type', 'SYSTEM')
          .like('title', 'Geen nieuwe kandidaten%')
          .gte('createdAt', weekAgo);

        if ((recentAlert ?? 0) === 0) {
          const lastLeadNL = lastLeadAt.toLocaleDateString('nl-NL', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
          });

          await insertNotifications(adminIds.map((adminId) => ({
            userId: adminId,
            type: 'SYSTEM',
            title: `Geen nieuwe kandidaten in ${daysQuiet} dagen`,
            message:
              `De laatste kandidaat kwam binnen op ${lastLeadNL}, ${daysQuiet} dagen geleden, ` +
              `terwijl er ${openVacancies} vacature(s) openstaan. De campagnes sturen verkeer naar ` +
              `de vacaturepagina's: controleer of de advertenties nog uitleveren, of de Meta Pixel ` +
              `nog SubmitApplication-events registreert, en of het sollicitatieformulier werkt.`,
            isRead: false,
            linkUrl: '/dashboard/werving',
          })));

          if (emailOn) {
            try {
              await sendLeadSilenceEmail({
                to: process.env.ADMIN_EMAIL!,
                daysQuiet,
                lastLeadDate: lastLeadNL,
                openVacancies: openVacancies ?? 0,
                portalUrl: new URL('/dashboard/werving', publicBaseUrl(request)).toString(),
              });
            } catch (err) {
              console.error('Lead silence email failed:', err);
            }
          }

          results.push(`Stilte-alarm: ${daysQuiet} dagen geen nieuwe kandidaten`);
        }
      }
    }
  }

  // Alleen het aantal loggen: de items bevatten namen (persoonsgegevens).
  console.log(`[cron/daily-checks] ${results.length} signalen`);
  return NextResponse.json({
    ok: true,
    processed: results.length,
    items: results,
    ran: new Date().toISOString(),
  });
}

/** Publieke basis-URL voor links in e-mails (nooit localhost of een vercel.app-adres). */
function publicBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && !/localhost|vercel\.app/.test(configured)) return configured;
  const host = new URL(request.url);
  if (!/localhost|vercel\.app/.test(host.hostname)) return host.origin;
  return 'https://www.werkenbijzwaluwcomfortsanitair.nl';
}
