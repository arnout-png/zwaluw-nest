import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type Params = Promise<{ token: string }>;

/**
 * GET  /api/screening/[token]
 *   Public — returns candidate first name + whether token is valid (no sensitive data).
 *
 * POST /api/screening/[token]
 *   Public — submits the screening form.
 *   Body: { motivation, experience, availableFrom, salaryExpectation, notes }
 */

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const { token } = await params;

  const { data: candidate, error } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, status, prescreeningExpiresAt')
    .eq('prescreeningToken', token)
    .single();

  if (error || !candidate) {
    return NextResponse.json({ error: 'Ongeldige of verlopen link.' }, { status: 404 });
  }

  const expired =
    candidate.prescreeningExpiresAt &&
    new Date(candidate.prescreeningExpiresAt as string) < new Date();

  if (expired) {
    return NextResponse.json({ error: 'Deze link is verlopen. Neem contact op met ons.' }, { status: 410 });
  }

  // De database heeft alleen `name`; de UI toont een voornaam.
  const firstName = ((candidate.name as string) ?? '').split(' ')[0] ?? '';

  if (candidate.status === 'SCREENING_DONE') {
    return NextResponse.json({ alreadyDone: true, firstName });
  }

  return NextResponse.json({
    valid: true,
    firstName,
  });
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { token } = await params;

  const { data: candidate, error } = await supabaseAdmin
    .from('Candidate')
    .select('id, status, prescreeningExpiresAt')
    .eq('prescreeningToken', token)
    .single();

  if (error || !candidate) {
    return NextResponse.json({ error: 'Ongeldige of verlopen link.' }, { status: 404 });
  }

  const expired =
    candidate.prescreeningExpiresAt &&
    new Date(candidate.prescreeningExpiresAt as string) < new Date();

  if (expired) {
    return NextResponse.json({ error: 'Deze link is verlopen.' }, { status: 410 });
  }

  if (candidate.status === 'SCREENING_DONE') {
    return NextResponse.json({ error: 'Je hebt de screening al ingevuld.' }, { status: 409 });
  }

  const body = await request.json();
  const { motivation, experience, availableFrom, salaryExpectation, extraNotes } = body;

  if (!motivation || !experience) {
    return NextResponse.json({ error: 'Motivatie en werkervaring zijn verplicht.' }, { status: 400 });
  }

  const notesLines = [
    motivation ? `Motivatie: ${motivation}` : null,
    experience ? `Werkervaring: ${experience}` : null,
    extraNotes ? `Overige opmerkingen: ${extraNotes}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const now = new Date().toISOString();

  // Candidate heeft geen availableFrom- of notes-kolom; salaryExpectation is tekst.
  // De antwoorden bewaren we als CandidateNote, net als bij een sollicitatie.
  const { error: updateError } = await supabaseAdmin
    .from('Candidate')
    .update({
      status: 'SCREENING_DONE',
      salaryExpectation: salaryExpectation ? String(salaryExpectation) : null,
      stageUpdatedAt: now,
      updatedAt: now,
    })
    .eq('id', candidate.id as string);

  if (updateError) {
    console.error('Screening submit error:', updateError);
    return NextResponse.json({ error: 'Kan formulier niet opslaan. Probeer het opnieuw.' }, { status: 500 });
  }

  const { data: firstAdmin } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('role', 'ADMIN')
    .eq('isActive', true)
    .limit(1)
    .maybeSingle();

  if (firstAdmin) {
    const noteBody = [
      '**Pre-screening ingevuld**',
      notesLines,
      availableFrom ? `Beschikbaar per: ${availableFrom}` : null,
      salaryExpectation ? `Salariswens: ${salaryExpectation}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    await supabaseAdmin.from('CandidateNote').insert({
      candidateId: candidate.id as string,
      content: noteBody,
      authorId: firstAdmin.id,
      createdAt: now,
    });
  }

  // Notify admins
  const { data: admins } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('role', 'ADMIN')
    .eq('isActive', true);

  const notifRows = (admins ?? []).map((a: { id: string }) => ({
    userId: a.id,
    type: 'SYSTEM',
    title: 'Pre-screening ingevuld',
    message: `Een kandidaat heeft de pre-screening ingevuld. Bekijk het formulier in de Werving module.`,
    isRead: false,
    linkUrl: `/dashboard/werving/${candidate.id as string}`,
  }));

  if (notifRows.length > 0) {
    await supabaseAdmin.from('Notification').insert(notifRows);
  }

  return NextResponse.json({ ok: true });
}
