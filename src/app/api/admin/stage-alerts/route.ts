import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const STAGE_KEYS = [
  'STAGE_ALERT_NEW_LEAD',
  'STAGE_ALERT_PRE_SCREENING',
  'STAGE_ALERT_SCREENING_DONE',
  'STAGE_ALERT_INTERVIEW',
  'STAGE_ALERT_RESERVE_BANK',
] as const;

const DEFAULTS: Record<string, number> = {
  STAGE_ALERT_NEW_LEAD: 3,
  STAGE_ALERT_PRE_SCREENING: 5,
  STAGE_ALERT_SCREENING_DONE: 3,
  STAGE_ALERT_INTERVIEW: 7,
  STAGE_ALERT_RESERVE_BANK: 30,
};

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from('AppSetting')
    .select('key, value')
    .in('key', STAGE_KEYS as unknown as string[]);

  const result: Record<string, number> = { ...DEFAULTS };
  for (const row of data ?? []) {
    result[row.key] = Number(row.value) || 0;
  }

  // Return stage-name-only keys for convenience
  return NextResponse.json({
    NEW_LEAD: result.STAGE_ALERT_NEW_LEAD,
    PRE_SCREENING: result.STAGE_ALERT_PRE_SCREENING,
    SCREENING_DONE: result.STAGE_ALERT_SCREENING_DONE,
    INTERVIEW: result.STAGE_ALERT_INTERVIEW,
    RESERVE_BANK: result.STAGE_ALERT_RESERVE_BANK,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const body = await req.json();

  const rows = [
    { key: 'STAGE_ALERT_NEW_LEAD', value: String(Number(body.NEW_LEAD) || 0) },
    { key: 'STAGE_ALERT_PRE_SCREENING', value: String(Number(body.PRE_SCREENING) || 0) },
    { key: 'STAGE_ALERT_SCREENING_DONE', value: String(Number(body.SCREENING_DONE) || 0) },
    { key: 'STAGE_ALERT_INTERVIEW', value: String(Number(body.INTERVIEW) || 0) },
    { key: 'STAGE_ALERT_RESERVE_BANK', value: String(Number(body.RESERVE_BANK) || 0) },
  ].map((r) => ({ ...r, updatedAt: new Date().toISOString() }));

  await supabaseAdmin.from('AppSetting').upsert(rows, { onConflict: 'key' });

  return NextResponse.json({ ok: true });
}
