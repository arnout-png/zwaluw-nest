import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if ('title' in body) updates.title = body.title;
  if ('slug' in body) updates.slug = body.slug;
  if ('description' in body) updates.description = body.description;
  if ('requirements' in body) updates.requirements = body.requirements ?? null;
  if ('location' in body) updates.location = body.location ?? null;
  if ('hoursPerWeek' in body) updates.hoursPerWeek = body.hoursPerWeek ?? null;
  if ('salaryRange' in body) updates.salaryRange = body.salaryRange ?? null;
  if ('imageUrl' in body) updates.imageUrl = body.imageUrl ?? null;
  if ('roleType' in body) updates.roleType = body.roleType ?? null;
  if ('isActive' in body) updates.isActive = body.isActive;

  const { data, error } = await supabaseAdmin
    .from('JobOpening')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
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

  return NextResponse.json({ ok: true });
}
