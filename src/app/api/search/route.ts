import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ data: [] });

  // Search candidates by name, email, phone (case-insensitive)
  // Try with deletedAt filter first, fallback without
  let result = await supabaseAdmin
    .from('Candidate')
    .select('id, name, email, phone, status, jobOpeningId')
    .is('deletedAt', null)
    .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    .order('createdAt', { ascending: false })
    .limit(8);

  if (result.error) {
    // deletedAt might not exist
    result = await supabaseAdmin
      .from('Candidate')
      .select('id, name, email, phone, status, jobOpeningId')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .order('createdAt', { ascending: false })
      .limit(8);
  }

  const { data, error } = result;
  if (error) {
    console.error('[Search] Query error:', error.message);
    return NextResponse.json({ data: [] });
  }

  const rows = (data ?? []) as { id: string; name: string; email: string; phone?: string | null; status: string; jobOpeningId?: string | null }[];

  // Enrich with job opening titles
  const jobIds = [...new Set(rows.map(r => r.jobOpeningId).filter(Boolean))] as string[];
  let jobMap: Record<string, string> = {};
  if (jobIds.length) {
    const { data: jobs } = await supabaseAdmin.from('JobOpening').select('id, title').in('id', jobIds);
    jobMap = Object.fromEntries(((jobs ?? []) as { id: string; title: string }[]).map(j => [j.id, j.title]));
  }

  const results = rows.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    status: r.status,
    jobTitle: r.jobOpeningId ? jobMap[r.jobOpeningId] ?? null : null,
  }));

  return NextResponse.json({ data: results });
}
