import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from('ContractGuideline')
    .select('roleType, content, updatedAt');

  return NextResponse.json({ data: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const body = await req.json() as { roleType: string; content: string };

  if (!body.roleType) {
    return NextResponse.json({ error: 'roleType is verplicht.' }, { status: 400 });
  }

  await supabaseAdmin
    .from('ContractGuideline')
    .upsert(
      { roleType: body.roleType, content: body.content ?? '', updatedAt: new Date().toISOString() },
      { onConflict: 'roleType' }
    );

  return NextResponse.json({ ok: true });
}
