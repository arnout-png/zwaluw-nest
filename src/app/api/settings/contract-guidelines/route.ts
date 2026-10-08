import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from('ContractGuideline')
    .select('roleType, content, updatedAt');

  return NextResponse.json({ data: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const body = await req.json() as { roleType: string; content: string };

  if (!['MONTEUR', 'ADVISEUR', 'BINNENDIENST_TECHNISCH', 'BINNENDIENST_CALLCENTER', 'WAREHOUSE', 'BACKOFFICE'].includes(body.roleType)) {
    return NextResponse.json({ error: 'roleType is verplicht.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('ContractGuideline')
    .upsert(
      { roleType: body.roleType, content: typeof body.content === 'string' ? body.content.slice(0, 20000) : '', updatedAt: new Date().toISOString() },
      { onConflict: 'roleType' }
    );
  if (error) {
    console.error('PUT contract-guidelines error:', error.message);
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
