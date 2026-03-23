import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendNewCandidateEmail } from '@/lib/email';

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
    .single();

  let candidateId: string;

  if (existing) {
    // Update existing candidate if they're re-applying
    await supabaseAdmin
      .from('Candidate')
      .update({
        name,
        phone: body.phone ?? null,
        salaryExpectation: body.salaryExpectation ? String(body.salaryExpectation) : null,
        linkedinUrl: body.linkedinUrl ?? null,
        cvUrl: body.cvUrl ?? null,
        street: body.street ?? null,
        city: body.city ?? null,
        postalCode: body.postalCode ?? null,
        jobOpeningId: job.id,
        consentGiven: true,
        consentDate,
        consentExpiresAt,
        updatedAt: now,
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

  // Add motivation as a note if provided (use first admin as author)
  if (body.motivation) {
    const { data: firstAdmin } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('role', 'ADMIN')
      .eq('isActive', true)
      .limit(1)
      .single();

    if (firstAdmin) {
      await supabaseAdmin
        .from('CandidateNote')
        .insert({
          candidateId,
          content: `**Motivatie (sollicitatie via ${job.title}):**\n\n${body.motivation}`,
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
    title: `Nieuwe sollicitant: ${name}`,
    message: `${name} heeft gesolliciteerd op "${job.title}".`,
    isRead: false,
    linkUrl: `/dashboard/werving/${candidateId}`,
  }));

  if (notifRows.length > 0) {
    await supabaseAdmin.from('Notification').insert(notifRows);
  }

  // Email notification to admin
  if (process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
    try {
      await sendNewCandidateEmail({
        to: process.env.ADMIN_EMAIL,
        candidateName: name,
        email: body.email!,
        phone: body.phone,
        source: `Sollicitatie via ${job.title}`,
        portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/werving/${candidateId}`,
      });
    } catch (err) {
      console.error('New candidate email failed:', err);
    }
  }

  return NextResponse.json({ ok: true, candidateId });
}
