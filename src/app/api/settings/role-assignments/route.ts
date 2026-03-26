import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from('RoleAssignment')
    .select('roleType, userId, user:User!RoleAssignment_userId_fkey(id, name)');

  return NextResponse.json({ data: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  // Body: Array<{ roleType: VacatureRol, userId: string | null }>
  const body = await req.json() as Array<{ roleType: string; userId: string | null }>;

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Ongeldig formaat.' }, { status: 400 });
  }

  // Delete entries where userId is null (clearing assignment)
  const toDelete = body.filter((r) => !r.userId).map((r) => r.roleType);
  const toUpsert = body
    .filter((r) => r.userId)
    .map((r) => ({ roleType: r.roleType, userId: r.userId! }));

  if (toDelete.length > 0) {
    await supabaseAdmin
      .from('RoleAssignment')
      .delete()
      .in('roleType', toDelete);
  }

  if (toUpsert.length > 0) {
    await supabaseAdmin
      .from('RoleAssignment')
      .upsert(toUpsert, { onConflict: 'roleType' });
  }

  return NextResponse.json({ ok: true });
}
