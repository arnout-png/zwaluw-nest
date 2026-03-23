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
  const { name, description, isActive, roleType, questions } = body;

  // Deactivate only scripts of the same roleType (scoped — not a global wipe)
  if (isActive === true) {
    // Fetch current roleType if not provided in body
    let rt = roleType !== undefined ? (roleType ?? null) : undefined;
    if (rt === undefined) {
      const { data: current } = await supabaseAdmin
        .from('ScreeningScript').select('roleType').eq('id', id).single();
      rt = current?.roleType ?? null;
    }
    let deactivateQ = supabaseAdmin.from('ScreeningScript').update({ isActive: false }).neq('id', id);
    if (rt) deactivateQ = deactivateQ.eq('roleType', rt) as typeof deactivateQ;
    else deactivateQ = deactivateQ.is('roleType', null) as typeof deactivateQ;
    await deactivateQ;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() ?? null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (roleType !== undefined) updates.roleType = roleType ?? null;

  await supabaseAdmin.from('ScreeningScript').update(updates).eq('id', id);

  // Replace questions if provided
  if (Array.isArray(questions)) {
    await supabaseAdmin.from('ScreeningQuestion').delete().eq('scriptId', id);
    if (questions.length > 0) {
      const qRows = questions.map((q: { question: string; placeholder?: string; required?: boolean }, i: number) => ({
        scriptId: id,
        question: q.question,
        placeholder: q.placeholder ?? null,
        required: q.required ?? false,
        order: i + 1,
      }));
      await supabaseAdmin.from('ScreeningQuestion').insert(qRows);
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
  // Soft delete: set isActive to false
  await supabaseAdmin.from('ScreeningScript').update({ isActive: false, updatedAt: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ ok: true });
}
