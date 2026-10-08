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

  const { error: updateError } = await supabaseAdmin.from('ScreeningScript').update(updates).eq('id', id);
  if (updateError) {
    console.error('PATCH screening-script error:', updateError.message);
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  // Vragen bijwerken met behoud van ids (anders raken gegeven antwoorden los)
  if (Array.isArray(questions)) {
    const rows = questions
      .filter((q: { question?: string }) => typeof q?.question === 'string' && q.question.trim())
      .map((q: { question: string; placeholder?: string; required?: boolean }) => ({
        question: q.question.trim(),
        placeholder: q.placeholder ?? null,
        required: q.required ?? false,
      }));
    const { error } = await syncOrderedRows({
      table: 'ScreeningQuestion',
      parentColumn: 'scriptId',
      parentId: id,
      textColumn: 'question',
      rows,
    });
    if (error) {
      console.error('PATCH screening-script questions error:', error);
      return NextResponse.json({ error: 'Vragen opslaan mislukt.' }, { status: 500 });
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
  // Soft delete: set isActive to false
  await supabaseAdmin.from('ScreeningScript').update({ isActive: false, updatedAt: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ ok: true });
}
