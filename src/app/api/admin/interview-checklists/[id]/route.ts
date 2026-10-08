import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { syncOrderedRows } from '@/lib/template-sync';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER'].includes(session.role)) return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { name, description, isActive, roleType, items } = body;

  // Deactivate only checklists of the same roleType (scoped — not a global wipe)
  if (isActive === true) {
    let rt = roleType !== undefined ? (roleType ?? null) : undefined;
    if (rt === undefined) {
      const { data: current } = await supabaseAdmin
        .from('InterviewChecklist').select('roleType').eq('id', id).single();
      rt = current?.roleType ?? null;
    }
    let deactivateQ = supabaseAdmin.from('InterviewChecklist').update({ isActive: false }).neq('id', id);
    if (rt) deactivateQ = deactivateQ.eq('roleType', rt) as typeof deactivateQ;
    else deactivateQ = deactivateQ.is('roleType', null) as typeof deactivateQ;
    await deactivateQ;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() ?? null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (roleType !== undefined) updates.roleType = roleType ?? null;

  const { error: updateError } = await supabaseAdmin.from('InterviewChecklist').update(updates).eq('id', id);
  if (updateError) {
    console.error('PATCH interview-checklist error:', updateError.message);
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  // Punten bijwerken met behoud van ids (anders raken afgevinkte punten los)
  if (Array.isArray(items)) {
    const rows = items
      .filter((item: { label?: string }) => typeof item?.label === 'string' && item.label.trim())
      .map((item: { label: string; description?: string }) => ({
        label: item.label.trim(),
        description: item.description ?? null,
      }));
    const { error } = await syncOrderedRows({
      table: 'InterviewChecklistItem',
      parentColumn: 'checklistId',
      parentId: id,
      textColumn: 'label',
      rows,
    });
    if (error) {
      console.error('PATCH interview-checklist items error:', error);
      return NextResponse.json({ error: 'Checklistpunten opslaan mislukt.' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER'].includes(session.role)) return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const { id } = await params;
  await supabaseAdmin.from('InterviewChecklist').update({ isActive: false, updatedAt: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ ok: true });
}
