import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('ScreeningScript')
    .select(
      `id, name, description, isActive, createdById, createdAt, updatedAt,
       createdBy:User!ScreeningScript_createdById_fkey (id, name),
       questions:ScreeningQuestion (id, scriptId, question, placeholder, required, order)`
    )
    .order('createdAt', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const scripts = (data ?? []).map((s: { questions?: { order: number }[] } & Record<string, unknown>) => ({
    ...s,
    questions: (s.questions ?? []).sort((a: { order: number }, b: { order: number }) => a.order - b.order),
  }));

  return NextResponse.json({ data: scripts });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const body = await request.json();
  const { name, description, isActive = false, questions = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Naam is verplicht.' }, { status: 400 });
  }

  // If activating this script, deactivate all others first
  if (isActive) {
    await supabaseAdmin.from('ScreeningScript').update({ isActive: false }).neq('id', 'none');
  }

  const { data: script, error } = await supabaseAdmin
    .from('ScreeningScript')
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      isActive,
      createdById: session.userId,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (questions.length > 0) {
    const qRows = questions.map((q: { question: string; placeholder?: string; required?: boolean }, i: number) => ({
      scriptId: script.id,
      question: q.question,
      placeholder: q.placeholder ?? null,
      required: q.required ?? false,
      order: i + 1,
    }));
    await supabaseAdmin.from('ScreeningQuestion').insert(qRows);
  }

  return NextResponse.json({ data: { id: script.id } }, { status: 201 });
}
