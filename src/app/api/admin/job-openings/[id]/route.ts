import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { SLUG_RE, nullable, slugError } from '@/lib/job-opening-input';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if ('slug' in body && !SLUG_RE.test(String(body.slug))) {
    return NextResponse.json(
      { error: 'De slug mag alleen kleine letters, cijfers en streepjes bevatten (bijv. callcenter-medewerker).' },
      { status: 400 }
    );
  }
  if (('title' in body && !String(body.title ?? '').trim()) || ('description' in body && !String(body.description ?? '').trim())) {
    return NextResponse.json({ error: 'Titel en beschrijving mogen niet leeg zijn.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if ('title' in body) updates.title = String(body.title).trim();
  if ('slug' in body) updates.slug = String(body.slug);
  if ('description' in body) updates.description = String(body.description);
  if ('requirements' in body) updates.requirements = nullable(body.requirements);
  if ('location' in body) updates.location = nullable(body.location);
  if ('hoursPerWeek' in body) updates.hoursPerWeek = nullable(body.hoursPerWeek);
  if ('salaryRange' in body) updates.salaryRange = nullable(body.salaryRange);
  if ('imageUrl' in body) updates.imageUrl = nullable(body.imageUrl);
  if ('benefits' in body) updates.benefits = nullable(body.benefits);
  if ('perks' in body) updates.perks = nullable(body.perks);
  if ('impact' in body) updates.impact = nullable(body.impact);
  if ('roleType' in body) updates.roleType = body.roleType || null;
  if ('isActive' in body) updates.isActive = body.isActive === true;

  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return slugError(error);
  }

  // Publieke vacaturepagina's (ISR) direct verversen.
  revalidatePath('/vacature', 'layout');

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;

  // Soft delete — set isActive to false
  const { error } = await supabaseAdmin
    .from('JobOpening')
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath('/vacature', 'layout');

  return NextResponse.json({ ok: true });
}
