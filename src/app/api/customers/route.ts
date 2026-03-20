import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  let query = supabaseAdmin
    .from('Customer')
    .select('id, name, email, phone, address, city, postalCode, createdAt')
    .order('name')
    .limit(20);

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Kan klanten niet ophalen.' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, phone, address, city, postalCode, notes } = body;

  if (!name || !address) {
    return NextResponse.json(
      { error: 'Naam en adres zijn verplicht.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('Customer')
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      address,
      city: city || '',
      postalCode: postalCode || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Kan klant niet aanmaken.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
