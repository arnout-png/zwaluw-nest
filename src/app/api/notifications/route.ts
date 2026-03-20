import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('Notification')
    .select('id, userId, type, title, message, isRead, linkUrl, createdAt')
    .eq('userId', session.userId)
    .order('createdAt', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Kan meldingen niet ophalen.' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function PATCH() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('Notification')
    .update({ isRead: true })
    .eq('userId', session.userId)
    .eq('isRead', false);

  if (error) {
    return NextResponse.json({ error: 'Kan meldingen niet bijwerken.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
