import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/employees/list
 * Returns a minimal list of active users for pickers (assignee, mention, etc.)
 * Accessible by ADMIN and PLANNER.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('User')
    .select('id, name, role')
    .eq('isActive', true)
    .order('name');

  if (error) {
    return NextResponse.json({ error: 'Kan medewerkers niet ophalen.' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
