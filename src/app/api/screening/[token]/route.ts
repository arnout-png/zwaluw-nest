import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { candidateRecipients, systemNoteAuthorId } from '@/lib/recruitment';

type Params = Promise<{ token: string }>;

/**
 * GET  /api/screening/[token]
 *   Public — returns candidate first name + whether token is valid (no sensitive data).
 *
 * POST /api/screening/[token]
 *   Public — submits the screening form.
 *   Body: { motivation, experience, availableFrom, salaryExpectation, extraNotes }
 *
 * Een link werkt alleen zolang de kandidaat nog vóór of in de pre-screening
 * zit. Daarna (screening ingevuld, gesprek, afgewezen, prullenbak) geldt hij als
 * "al ingevuld" — anders kon een oude link een kandidaat die al op gesprek
 * stond terugzetten naar "Screening klaar".
 */
const OPEN_STATUSES = ['NEW_LEAD', 'CONTACTED', 'PRE_SCREENING'];

type ScreeningCandidate = {
  id: string;
  name: string | null;
  status: string;
  prescreeningExpiresAt: string | null;
  assignedToId: string | null;
  deletedAt: string | null;
};

async function findCandidate(token: string): Promise<ScreeningCandidate | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, status, prescreeningExpiresAt, assignedToId, deletedAt')
    .eq('prescreeningToken', token)
    .maybeSingle();
  return (data as ScreeningCandidate | null) ?? null;
}

function isExpired(c: ScreeningCandidate): boolean {
  return !!c.prescreeningExpiresAt && new Date(c.prescreeningExpiresAt) < new Date();
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const { token } = await params;
  const candidate = await findCandidate(token);

  if (!candidate || candidate.deletedAt) {
    return NextResponse.json({ error: 'Ongeldige of verlopen link.' }, { status: 404 });
  }

  // De database heeft alleen `name`; de UI toont een voornaam.
  const firstName = (candidate.name ?? '').split(' ')[0] ?? '';

  if (!OPEN_STATUSES.includes(candidate.status)) {
    return NextResponse.json({ alreadyDone: true, firstName });
  }

  if (isExpired(candidate)) {
    return NextResponse.json({ error: 'Deze link is verlopen. Neem contact op met ons.' }, { status: 410 });
  }

  return NextResponse.json({ valid: true, firstName });
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { token } = await params;
  const candidate = await findCandidate(token);

  if (!candidate || candidate.deletedAt) {
    return NextResponse.json({ error: 'Ongeldige of verlopen link.' }, { status: 404 });
  }
  if (!OPEN_STATUSES.includes(candidate.status)) {
    return NextResponse.json({ error: 'Je hebt de screening al ingevuld.' }, { status: 409 });
  }
  if (isExpired(candidate)) {
    return NextResponse.json({ error: 'Deze link is verlopen.' }, { status: 410 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 });
  }

  const motivation = text(body.motivation, 5000);
  const experience = text(body.experience, 5000);
  const availableFrom = text(body.availableFrom, 50);
  const salaryExpectation = text(body.salaryExpectation, 100);
  const extraNotes = text(body.extraNotes, 5000);

  if (!motivation || !experience) {
    return NextResponse.json({ error: 'Motivatie en werkervaring zijn verplicht.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Candidate heeft geen availableFrom- of notes-kolom; salaryExpectation is tekst.
  // De antwoorden bewaren we als CandidateNote, net als bij een sollicitatie.
  // De link verloopt direct na het invullen.
  const { error: updateError } = await supabaseAdmin
    .from('Candidate')
    .update({
      status: 'SCREENING_DONE',
      ...(salaryExpectation ? { salaryExpectation } : {}),
      prescreeningExpiresAt: now,
      stageUpdatedAt: now,
      updatedAt: now,
    })
    .eq('id', candidate.id)
    .in('status', OPEN_STATUSES);

  if (updateError) {
    console.error('Screening submit error:', updateError);
    return NextResponse.json({ error: 'Kan formulier niet opslaan. Probeer het opnieuw.' }, { status: 500 });
  }

  const noteAuthor = await systemNoteAuthorId();
  if (noteAuthor) {
    const noteBody = [
      '**Pre-screening ingevuld**',
      `Motivatie: ${motivation}`,
      `Werkervaring: ${experience}`,
      extraNotes ? `Overige opmerkingen: ${extraNotes}` : null,
      availableFrom ? `Beschikbaar per: ${availableFrom}` : null,
      salaryExpectation ? `Salariswens: ${salaryExpectation}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    await supabaseAdmin.from('CandidateNote').insert({
      candidateId: candidate.id,
      content: noteBody,
      authorId: noteAuthor,
      createdAt: now,
    });
  }

  // Melden aan de eigenaar (bijv. Vincent); zonder eigenaar aan de beheerders.
  const recipientIds = await candidateRecipients(candidate.assignedToId);
  const name = candidate.name ?? 'Een kandidaat';
  if (recipientIds.length > 0) {
    await supabaseAdmin.from('Notification').insert(
      recipientIds.map((userId) => ({
        userId,
        type: 'SYSTEM',
        title: `Pre-screening ingevuld: ${name}`,
        message: `${name} heeft de pre-screening ingevuld. Bekijk de antwoorden op de kandidaatkaart.`,
        isRead: false,
        linkUrl: `/dashboard/werving/${candidate.id}`,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
