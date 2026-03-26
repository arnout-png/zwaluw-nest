import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .select('id, slug, title, description, requirements, location, hoursPerWeek, salaryRange, imageUrl, roleType, isActive, createdById, createdAt, updatedAt')
    .order('createdAt', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const body = await request.json();

  if (!body.title || !body.slug || !body.description) {
    return NextResponse.json({ error: 'Titel, slug en beschrijving zijn verplicht.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .insert({
      id,
      slug: body.slug,
      title: body.title,
      description: body.description,
      requirements: body.requirements ?? null,
      location: body.location ?? null,
      hoursPerWeek: body.hoursPerWeek ?? null,
      salaryRange: body.salaryRange ?? null,
      imageUrl: body.imageUrl ?? null,
      benefits: body.benefits ?? null,
      perks: body.perks ?? null,
      impact: body.impact ?? null,
      roleType: body.roleType ?? null,
      isActive: body.isActive !== false,
      createdById: session.userId,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
