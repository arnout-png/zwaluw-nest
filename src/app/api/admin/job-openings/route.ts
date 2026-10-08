import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { SLUG_RE, nullable, slugError } from '@/lib/job-opening-input';

export async function GET() {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .select('id, slug, title, description, requirements, location, hoursPerWeek, salaryRange, imageUrl, benefits, perks, impact, roleType, isActive, createdById, createdAt, updatedAt')
    .order('createdAt', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const body = await request.json();

  if (!body.title || !body.slug || !body.description) {
    return NextResponse.json({ error: 'Titel, slug en beschrijving zijn verplicht.' }, { status: 400 });
  }
  if (!SLUG_RE.test(String(body.slug))) {
    return NextResponse.json(
      { error: 'De slug mag alleen kleine letters, cijfers en streepjes bevatten (bijv. callcenter-medewerker).' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .insert({
      id,
      slug: String(body.slug),
      title: String(body.title).trim(),
      description: String(body.description),
      requirements: nullable(body.requirements),
      location: nullable(body.location),
      hoursPerWeek: nullable(body.hoursPerWeek),
      salaryRange: nullable(body.salaryRange),
      imageUrl: nullable(body.imageUrl),
      benefits: nullable(body.benefits),
      perks: nullable(body.perks),
      impact: nullable(body.impact),
      roleType: body.roleType || null,
      isActive: body.isActive !== false,
      createdById: session.userId,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    return slugError(error);
  }

  // Publieke vacaturepagina's (ISR) direct verversen.
  revalidatePath('/vacature', 'layout');

  return NextResponse.json({ data }, { status: 201 });
}
