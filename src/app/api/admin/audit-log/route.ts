import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const action = url.searchParams.get('action');
  const entity = url.searchParams.get('entity');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const offset = Number(url.searchParams.get('offset') || 0);

  let query = supabaseAdmin
    .from('AuditLog')
    .select('id, userId, action, entity, entityId, details, ipAddress, createdAt', { count: 'exact' })
    .order('createdAt', { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) query = query.eq('userId', userId);
  if (action) query = query.eq('action', action);
  if (entity) query = query.eq('entity', entity);
  if (from) query = query.gte('createdAt', new Date(from).toISOString());
  if (to) query = query.lte('createdAt', new Date(to + 'T23:59:59').toISOString());

  const { data, count, error } = await query;

  if (error) {
    console.error('[AuditLog] Query error:', error.message);
    return NextResponse.json({ error: 'Kan logboek niet ophalen.' }, { status: 500 });
  }

  const rows = (data ?? []) as { id: string; userId: string | null; action: string; entity: string; entityId: string | null; details: string | null; ipAddress: string | null; createdAt: string }[];

  // Enrich with user names
  const userIds = [...new Set(rows.map(r => r.userId).filter(Boolean))] as string[];
  let usersMap: Record<string, { id: string; name: string; email: string }> = {};
  if (userIds.length) {
    const { data: users } = await supabaseAdmin.from('User').select('id, name, email').in('id', userIds);
    usersMap = Object.fromEntries(((users ?? []) as { id: string; name: string; email: string }[]).map(u => [u.id, u]));
  }

  const enriched = rows.map(r => ({
    ...r,
    user: r.userId ? usersMap[r.userId] ?? null : null,
  }));

  return NextResponse.json({ data: enriched, total: count ?? 0 });
}
