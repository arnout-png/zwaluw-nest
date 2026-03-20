import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { name, description, isActive, items } = body;

  if (isActive === true) {
    await supabaseAdmin.from('InterviewChecklist').update({ isActive: false }).neq('id', id);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() ?? null;
  if (isActive !== undefined) updates.isActive = isActive;

  await supabaseAdmin.from('InterviewChecklist').update(updates).eq('id', id);

  if (Array.isArray(items)) {
    await supabaseAdmin.from('InterviewChecklistItem').delete().eq('checklistId', id);
    if (items.length > 0) {
      const rows = items.map((item: { label: string; description?: string }, i: number) => ({
        checklistId: id,
        label: item.label,
        description: item.description ?? null,
        order: i + 1,
      }));
      await supabaseAdmin.from('InterviewChecklistItem').insert(rows);
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
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const { id } = await params;
  await supabaseAdmin.from('InterviewChecklist').update({ isActive: false, updatedAt: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ ok: true });
}
