import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface PhaseMetric {
  phase: string;
  label: string;
  median: number;
  average: number;
  p90: number;
  count: number;
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function median(arr: number[]): number {
  return percentile(arr, 50);
}

function average(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const url = new URL(request.url);
  const days = Number(url.searchParams.get('days') || 90);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  type CandRow = { id: string; status: string; createdAt: string; stageUpdatedAt: string | null };

  // Fetch candidates created in the period
  const { data: withFilter, error: filterError } = await supabaseAdmin
    .from('Candidate')
    .select('id, status, createdAt, stageUpdatedAt')
    .gte('createdAt', since)
    .is('deletedAt', null)
    .order('createdAt', { ascending: false });

  let candidates: CandRow[];
  if (filterError) {
    const { data: noFilter } = await supabaseAdmin
      .from('Candidate')
      .select('id, status, createdAt, stageUpdatedAt')
      .gte('createdAt', since)
      .order('createdAt', { ascending: false });
    candidates = (noFilter ?? []) as CandRow[];
  } else {
    candidates = (withFilter ?? []) as CandRow[];
  }

  if (!candidates?.length) {
    return NextResponse.json({ phases: [], totalCandidates: 0 });
  }

  const candidateIds = candidates.map(c => c.id);

  // Fetch all audit logs for these candidates (STATUS_CHANGE + CALL)
  const { data: auditLogs } = await supabaseAdmin
    .from('AuditLog')
    .select('entityId, action, details, createdAt')
    .in('entityId', candidateIds)
    .eq('entity', 'Candidate')
    .in('action', ['STATUS_CHANGE', 'CALL', 'CREATE'])
    .order('createdAt', { ascending: true });

  // Fetch call logs for first contact timing
  const { data: callLogs } = await supabaseAdmin
    .from('CallLog')
    .select('candidateId, status, createdAt')
    .in('candidateId', candidateIds)
    .in('status', ['BEREIKT', 'VOICEMAIL', 'TERUGBELLEN'])
    .order('createdAt', { ascending: true });

  // Build timeline per candidate
  const timeline = new Map<string, { createdAt: string; firstContact?: string; preScreening?: string; screeningDone?: string; interview?: string; outcome?: string; outcomeStatus?: string }>();

  for (const c of candidates) {
    timeline.set(c.id, { createdAt: c.createdAt });
  }

  // From call logs: first non-GEEN_GEHOOR contact
  for (const cl of callLogs ?? []) {
    const t = timeline.get(cl.candidateId);
    if (t && !t.firstContact) {
      t.firstContact = cl.createdAt;
    }
  }

  // From audit logs: status transitions
  for (const log of auditLogs ?? []) {
    const t = timeline.get(log.entityId!);
    if (!t) continue;

    let details: Record<string, unknown> = {};
    if (log.details) {
      try { details = JSON.parse(log.details as string); } catch { /* ignore */ }
    }

    const toStatus = details.to as string;
    if (log.action === 'STATUS_CHANGE') {
      if (toStatus === 'PRE_SCREENING' && !t.preScreening) t.preScreening = log.createdAt;
      if (toStatus === 'SCREENING_DONE' && !t.screeningDone) t.screeningDone = log.createdAt;
      if (toStatus === 'INTERVIEW' && !t.interview) t.interview = log.createdAt;
      if (['HIRED', 'REJECTED', 'RESERVE_BANK'].includes(toStatus) && !t.outcome) {
        t.outcome = log.createdAt;
        t.outcomeStatus = toStatus;
      }
    }

    // CALL actions as first contact fallback
    if (log.action === 'CALL' && !t.firstContact) {
      const callStatus = details.callStatus as string;
      if (callStatus && callStatus !== 'GEEN_GEHOOR') {
        t.firstContact = log.createdAt;
      }
    }
  }

  // Fallback: use candidate status + stageUpdatedAt for candidates without audit history
  for (const c of candidates) {
    const t = timeline.get(c.id)!;
    const status = c.status as string;
    const stages = ['PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW', 'HIRED', 'REJECTED', 'RESERVE_BANK'];
    const stageIndex = stages.indexOf(status);

    // If we have no audit data but candidate is in a later stage, approximate with stageUpdatedAt
    if (stageIndex >= 0 && c.stageUpdatedAt) {
      if (stageIndex >= 0 && !t.preScreening && stageIndex > 0) {
        // Can't reliably infer earlier stages from just stageUpdatedAt
      }
      if (['HIRED', 'REJECTED', 'RESERVE_BANK'].includes(status) && !t.outcome) {
        t.outcome = c.stageUpdatedAt;
        t.outcomeStatus = status;
      }
    }
  }

  // Calculate phase durations in hours
  function diffHours(a?: string, b?: string): number | null {
    if (!a || !b) return null;
    return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60);
  }

  const phaseDurations: Record<string, number[]> = {
    entry_to_contact: [],
    contact_to_prescreening: [],
    prescreening_to_done: [],
    done_to_interview: [],
    interview_to_outcome: [],
    total: [],
  };

  for (const [, t] of timeline) {
    const d1 = diffHours(t.createdAt, t.firstContact);
    if (d1 !== null && d1 >= 0) phaseDurations.entry_to_contact.push(d1);

    const d2 = diffHours(t.firstContact, t.preScreening);
    if (d2 !== null && d2 >= 0) phaseDurations.contact_to_prescreening.push(d2);

    const d3 = diffHours(t.preScreening, t.screeningDone);
    if (d3 !== null && d3 >= 0) phaseDurations.prescreening_to_done.push(d3);

    const d4 = diffHours(t.screeningDone, t.interview);
    if (d4 !== null && d4 >= 0) phaseDurations.done_to_interview.push(d4);

    const d5 = diffHours(t.interview, t.outcome);
    if (d5 !== null && d5 >= 0) phaseDurations.interview_to_outcome.push(d5);

    const total = diffHours(t.createdAt, t.outcome);
    if (total !== null && total >= 0) phaseDurations.total.push(total);
  }

  const PHASE_LABELS: Record<string, string> = {
    entry_to_contact: 'Entry → Eerste contact',
    contact_to_prescreening: 'Contact → Pre-screening verstuurd',
    prescreening_to_done: 'Pre-screening → Ingevuld',
    done_to_interview: 'Ingevuld → Gesprek gepland',
    interview_to_outcome: 'Gesprek → Uitkomst',
    total: 'Totaal (entry → uitkomst)',
  };

  const phases: PhaseMetric[] = Object.entries(phaseDurations).map(([phase, values]) => ({
    phase,
    label: PHASE_LABELS[phase] ?? phase,
    median: Math.round(median(values) * 10) / 10,
    average: Math.round(average(values) * 10) / 10,
    p90: Math.round(percentile(values, 90) * 10) / 10,
    count: values.length,
  }));

  return NextResponse.json({
    phases,
    totalCandidates: candidates.length,
    period: days,
  });
}
