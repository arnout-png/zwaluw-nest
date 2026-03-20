import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Alleen beheerders kunnen dossierentries aanmaken.' }, { status: 403 });
  }

  const body = await request.json();
  // Accept either userId (old) or employeeProfileId (new)
  const { userId, employeeProfileId: directEPId, type, title, content, description } = body;

  if (!type || !title || !(content || description)) {
    return NextResponse.json(
      { error: 'Type, titel en inhoud zijn verplicht.' },
      { status: 400 }
    );
  }

  const validTypes = ['NOTE', 'WARNING', 'COMPLIMENT', 'INCIDENT', 'PERFORMANCE', 'OTHER'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Ongeldig type.' }, { status: 400 });
  }

  // Resolve employeeProfileId
  let epId = directEPId;
  if (!epId && userId) {
    const { data: ep } = await supabaseAdmin
      .from('EmployeeProfile')
      .select('id')
      .eq('userId', userId)
      .single();
    epId = ep?.id;
  }

  if (!epId) {
    return NextResponse.json({ error: 'Medewerker niet gevonden.' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('DossierEntry')
    .insert({
      employeeProfileId: epId,
      loggedById: session.userId,
      type,
      title,
      description: content || description,
      date: new Date().toISOString(),
    })
    .select(
      `id, employeeProfileId, date, type, title, description, loggedById, createdAt,
       loggedBy:User!DossierEntry_loggedById_fkey (id, name, role)`
    )
    .single();

  if (error) {
    console.error('Dossier insert error:', error.message);
    return NextResponse.json({ error: 'Kan dossierentry niet aanmaken.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
