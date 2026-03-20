import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }
  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const content = (body.content ?? '').trim();

  if (!content) {
    return NextResponse.json({ error: 'Notitie mag niet leeg zijn.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('CandidateNote')
    .insert({
      candidateId: id,
      content,
      authorId: session.userId,
      createdAt: new Date().toISOString(),
    })
    .select(
      `id, candidateId, content, authorId, createdAt,
       author:User!CandidateNote_authorId_fkey (id, name, role)`
    )
    .single();

  if (error) {
    console.error('POST /api/candidates/[id]/notes error:', error.message);
    return NextResponse.json({ error: 'Kan notitie niet opslaan.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
