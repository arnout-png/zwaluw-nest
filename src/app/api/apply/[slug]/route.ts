import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendNewCandidateEmail, isEmailConfigured } from '@/lib/email';
import { autoAssignCandidate } from '@/lib/recruitment';

/** Strip undefined and empty-string values so an update never blanks existing data. */
function filled(obj: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).filter((entry): entry is [string, string] => !!entry[1])
  );
}

const STATUS_LABELS: Record<string, string> = {
  NEW_LEAD: 'Nieuw',
  CONTACTED: 'Gecontacteerd',
  PRE_SCREENING: 'Pre-screening',
  SCREENING_DONE: 'Screening klaar',
  INTERVIEW: 'Sollicitatiegesprek',
  RESERVE_BANK: 'Reserve Bank',
  HIRED: 'Aangenomen',
  REJECTED: 'Afgewezen',
  WITHDRAWN: 'Teruggetrokken',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json() as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    motivation?: string;
    availableFrom?: string;
    salaryExpectation?: string;
    consent?: boolean;
    jobId?: string;
    linkedinUrl?: string;
    cvUrl?: string;
    street?: string;
    city?: string;
    postalCode?: string;
  };

  if (!body.email || !body.firstName || !body.lastName) {
    return NextResponse.json({ error: 'Voornaam, achternaam en e-mailadres zijn verplicht.' }, { status: 400 });
  }
  if (!body.consent) {
    return NextResponse.json({ error: 'Je moet akkoord gaan met de privacyverklaring.' }, { status: 400 });
  }

  // Verify job opening is active
  const { data: job, error: jobError } = await supabaseAdmin
    .from('JobOpening')
    .select('id, title, slug')
    .eq('slug', slug)
    .eq('isActive', true)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Vacature niet gevonden of niet meer actief.' }, { status: 404 });
  }

  const name = `${body.firstName} ${body.lastName}`.trim();
  const consentDate = new Date().toISOString();
  const consentExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Upsert candidate by email — avoid duplicates
  const { data: existing } = await supabaseAdmin
    .from('Candidate')
    .select('id, status')
    .eq('email', body.email)
    .maybeSingle();

  let candidateId: string;
  let reopenedFrom: string | null = null;

  if (existing) {
    // Re-applicant: reset to NEW_LEAD so the card resurfaces in the "Nieuw"
    // column. Skip only for HIRED — that is an employee, not a new applicant.
    const previousStatus = existing.status as string;
    const reopen = previousStatus !== 'HIRED';
    if (reopen && previousStatus !== 'NEW_LEAD') reopenedFrom = previousStatus;

    await supabaseAdmin
      .from('Candidate')
      .update({
        name,
        // Only overwrite what the applicant actually filled in — a field that is
        // absent from the form must not wipe data we already have on record.
        ...filled({
          phone: body.phone,
          salaryExpectation: body.salaryExpectation ? String(body.salaryExpectation) : undefined,
          linkedinUrl: body.linkedinUrl,
          cvUrl: body.cvUrl,
          street: body.street,
          city: body.city,
          postalCode: body.postalCode,
        }),
        jobOpeningId: job.id,
        consentGiven: true,
        consentDate,
        consentExpiresAt,
        updatedAt: now,
        // Fresh application → back to the top of the pipeline.
        ...(reopen
          ? {
              status: 'NEW_LEAD',
              stageUpdatedAt: now,
              leadSource: 'MANUAL',
              // Stale rejection state must not stick to a reopened candidate.
              rejectionReason: null,
              rejectionEmailSent: false,
            }
          : {}),
      })
      .eq('id', existing.id);
    candidateId = existing.id;
  } else {
    const { data: newCandidate, error: insertError } = await supabaseAdmin
      .from('Candidate')
      .insert({
        name,
        email: body.email,
        phone: body.phone ?? null,
        salaryExpectation: body.salaryExpectation ? String(body.salaryExpectation) : null,
        linkedinUrl: body.linkedinUrl ?? null,
        cvUrl: body.cvUrl ?? null,
        street: body.street ?? null,
        city: body.city ?? null,
        postalCode: body.postalCode ?? null,
        status: 'NEW_LEAD',
        leadSource: 'MANUAL',
        jobOpeningId: job.id,
        consentGiven: true,
        consentDate,
        consentExpiresAt,
        stageUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .select('id')
      .single();

    if (insertError || !newCandidate) {
      return NextResponse.json({ error: 'Aanmelding kon niet worden opgeslagen.' }, { status: 500 });
    }
    candidateId = newCandidate.id;
  }

  // Auto-assign based on vacancy role
  await autoAssignCandidate(candidateId, name, job.id);

  // Log the application as a note (use first admin as author)
  const noteBlocks: string[] = [];
  if (reopenedFrom) {
    noteBlocks.push(
      `**Heropend na nieuwe sollicitatie** — stond op "${STATUS_LABELS[reopenedFrom] ?? reopenedFrom}", teruggezet naar Nieuw.`
    );
  }
  if (body.motivation) {
    noteBlocks.push(`**Motivatie (sollicitatie via ${job.title}):**\n\n${body.motivation}`);
  }

  if (noteBlocks.length > 0) {
    const { data: firstAdmin } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('role', 'ADMIN')
      .eq('isActive', true)
      .limit(1)
      .maybeSingle();

    if (firstAdmin) {
      await supabaseAdmin
        .from('CandidateNote')
        .insert({
          candidateId,
          content: noteBlocks.join('\n\n'),
          authorId: firstAdmin.id,
          createdAt: now,
        });
    }
  }

  // Notify admins
  const { data: admins } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('role', 'ADMIN')
    .eq('isActive', true);

  const notifRows = (admins ?? []).map((a: { id: string }) => ({
    userId: a.id,
    type: 'NEW_CANDIDATE',
    title: reopenedFrom ? `Sollicitatie opnieuw: ${name}` : `Nieuwe sollicitant: ${name}`,
    message: reopenedFrom
      ? `${name} heeft opnieuw gesolliciteerd op "${job.title}" (stond op ${STATUS_LABELS[reopenedFrom] ?? reopenedFrom}).`
      : `${name} heeft gesolliciteerd op "${job.title}".`,
    isRead: false,
    linkUrl: `/dashboard/werving/${candidateId}`,
  }));

  if (notifRows.length > 0) {
    await supabaseAdmin.from('Notification').insert(notifRows);
  }

  // Email notification to admin
  if (isEmailConfigured() && process.env.ADMIN_EMAIL) {
    try {
      await sendNewCandidateEmail({
        to: process.env.ADMIN_EMAIL,
        candidateName: name,
        email: body.email!,
        phone: body.phone,
        source: reopenedFrom
          ? `Nieuwe sollicitatie via ${job.title} (heropend)`
          : `Sollicitatie via ${job.title}`,
        portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/werving/${candidateId}`,
      });
    } catch (err) {
      console.error('New candidate email failed:', err);
    }
  }

  return NextResponse.json({ ok: true, candidateId });
}
