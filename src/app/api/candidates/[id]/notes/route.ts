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

  const { id: candidateId } = await params;
  const body = await request.json();
  const content = (body.content ?? '').trim();
  const mentionedUserIds: string[] = Array.isArray(body.mentionedUserIds) ? body.mentionedUserIds : [];

  if (!content) {
    return NextResponse.json({ error: 'Notitie mag niet leeg zijn.' }, { status: 400 });
  }

  // 1. Insert the note
  const { data: note, error } = await supabaseAdmin
    .from('CandidateNote')
    .insert({
      candidateId,
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

  // 2. Insert @mention rows
  let mentions: { id: string; noteId: string; userId: string; user?: { id: string; name: string } }[] = [];
  if (mentionedUserIds.length > 0) {
    const mentionRows = mentionedUserIds.map(userId => ({
      noteId: note.id,
      userId,
    }));
    const { data: mentionData } = await supabaseAdmin
      .from('CandidateNoteMention')
      .insert(mentionRows)
      .select('id, noteId, userId, user:User!CandidateNoteMention_userId_fkey (id, name)');
    mentions = (mentionData ?? []) as typeof mentions;

    // 3. Fetch candidate name for notifications
    const { data: candidateData } = await supabaseAdmin
      .from('Candidate')
      .select('name')
      .eq('id', candidateId)
      .single();
    const candidateName = (candidateData as { name: string } | null)?.name ?? 'een kandidaat';

    // 4. Create notifications for each tagged user (excluding the author)
    const notifRows = mentionedUserIds
      .filter(uid => uid !== session.userId)
      .map(userId => ({
        userId,
        type: 'MENTION' as const,
        title: 'Je bent getagd in een notitie',
        message: `${session.name} heeft je getagd in een notitie bij ${candidateName}.`,
        linkUrl: `/dashboard/werving/${candidateId}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      }));
    if (notifRows.length > 0) {
      await supabaseAdmin.from('Notification').insert(notifRows);
    }
  }

  return NextResponse.json({ data: { ...note, mentions } }, { status: 201 });
}
