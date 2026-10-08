import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from('RoleAssignment')
    .select('roleType, userId');

  const rows = (data ?? []) as { roleType: string; userId: string }[];
  const userIds = [...new Set(rows.map(r => r.userId).filter(Boolean))];
  let usersMap: Record<string, { id: string; name: string }> = {};
  if (userIds.length) {
    const { data: users } = await supabaseAdmin.from('User').select('id, name').in('id', userIds);
    usersMap = Object.fromEntries(((users ?? []) as { id: string; name: string }[]).map(u => [u.id, u]));
  }

  const enriched = rows.map(r => ({ ...r, user: r.userId ? usersMap[r.userId] ?? null : null }));
  return NextResponse.json({ data: enriched });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  // Body: Array<{ roleType: VacatureRol, userId: string | null }>
  const body = await req.json() as Array<{ roleType: string; userId: string | null }>;

  const VACATURE_ROLLEN = ['MONTEUR', 'ADVISEUR', 'BINNENDIENST_TECHNISCH', 'BINNENDIENST_CALLCENTER', 'WAREHOUSE', 'BACKOFFICE'];
  if (!Array.isArray(body) || body.some((r) => !VACATURE_ROLLEN.includes(r?.roleType))) {
    return NextResponse.json({ error: 'Ongeldig formaat.' }, { status: 400 });
  }

  // Delete entries where userId is null (clearing assignment)
  const toDelete = body.filter((r) => !r.userId).map((r) => r.roleType);
  const toUpsert = body
    .filter((r) => r.userId)
    .map((r) => ({ roleType: r.roleType, userId: r.userId! }));

  if (toUpsert.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('User')
      .select('id')
      .in('id', toUpsert.map((r) => r.userId))
      .eq('isActive', true);
    const valid = new Set(((users ?? []) as { id: string }[]).map((u) => u.id));
    if (toUpsert.some((r) => !valid.has(r.userId))) {
      return NextResponse.json({ error: 'Onbekende of inactieve gebruiker.' }, { status: 400 });
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabaseAdmin
      .from('RoleAssignment')
      .delete()
      .in('roleType', toDelete);
    if (error) return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabaseAdmin
      .from('RoleAssignment')
      .upsert(toUpsert, { onConflict: 'roleType' });
    if (error) return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  await logAudit({ userId: session.userId, action: 'UPDATE', entity: 'RoleAssignment', details: { assignments: body } });

  return NextResponse.json({ ok: true });
}
