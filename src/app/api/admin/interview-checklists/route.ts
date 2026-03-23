import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const { data: checklists, error } = await supabaseAdmin
    .from('InterviewChecklist')
    .select('id, name, description, isActive, roleType, createdById, createdAt, updatedAt')
    .order('createdAt', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (checklists ?? []).map((c: Record<string, unknown>) => c.id);
  const { data: items } = ids.length
    ? await supabaseAdmin.from('InterviewChecklistItem').select('id, checklistId, label, description, order').in('checklistId', ids)
    : { data: [] };

  const result = (checklists ?? []).map((c: Record<string, unknown>) => ({
    ...c,
    items: ((items ?? []) as { checklistId: unknown; order: number }[])
      .filter(i => i.checklistId === c.id)
      .sort((a, b) => a.order - b.order),
  }));

  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const body = await request.json();
  const { name, description, isActive = false, roleType = null, items = [] } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Naam is verplicht.' }, { status: 400 });

  // Deactivate only checklists of the same roleType (scoped — not a global wipe)
  if (isActive) {
    let deactivateQ = supabaseAdmin.from('InterviewChecklist').update({ isActive: false });
    if (roleType) deactivateQ = deactivateQ.eq('roleType', roleType) as typeof deactivateQ;
    else deactivateQ = deactivateQ.is('roleType', null) as typeof deactivateQ;
    await deactivateQ;
  }

  const { data: checklist, error } = await supabaseAdmin
    .from('InterviewChecklist')
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      isActive,
      roleType: roleType ?? null,
      createdById: session.userId,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (items.length > 0) {
    const rows = items.map((item: { label: string; description?: string }, i: number) => ({
      checklistId: checklist.id,
      label: item.label,
      description: item.description ?? null,
      order: i + 1,
    }));
    await supabaseAdmin.from('InterviewChecklistItem').insert(rows);
  }

  return NextResponse.json({ data: { id: checklist.id } }, { status: 201 });
}
