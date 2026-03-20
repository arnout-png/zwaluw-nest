import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPrescreeningEmail } from '@/lib/email';
import { randomUUID } from 'crypto';

/**
 * POST /api/candidates/[id]/screening-invite
 * Generates a unique pre-screening token, saves it to the Candidate record,
 * and sends the invitation email to the candidate.
 *
 * Requires: RESEND_API_KEY and NEXT_PUBLIC_APP_URL env vars.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const { id } = await params;

  // Fetch candidate
  const { data: candidate, error: fetchError } = await supabaseAdmin
    .from('Candidate')
    .select('id, firstName, lastName, email, status, prescreeningToken')
    .eq('id', id)
    .single();

  if (fetchError || !candidate) {
    return NextResponse.json({ error: 'Kandidaat niet gevonden.' }, { status: 404 });
  }

  if (!candidate.email) {
    return NextResponse.json({ error: 'Kandidaat heeft geen e-mailadres.' }, { status: 400 });
  }

  // Generate token and set expiry (7 days)
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Update candidate: set token + status to PRE_SCREENING
  const { error: updateError } = await supabaseAdmin
    .from('Candidate')
    .update({
      prescreeningToken: token,
      prescreeningExpiresAt: expiresAt,
      status: 'PRE_SCREENING',
      updatedAt: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Screening invite update error:', updateError);
    return NextResponse.json({ error: 'Kan uitnodiging niet aanmaken.' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const screeningUrl = `${baseUrl}/screening/${token}`;

  // Send email if Resend is configured
  if (process.env.RESEND_API_KEY) {
    try {
      await sendPrescreeningEmail({
        to: candidate.email as string,
        name: (candidate.firstName as string) ?? 'Kandidaat',
        token,
        baseUrl,
      });
    } catch (err) {
      console.error('Screening invite email failed:', err);
      // Return success anyway — token is saved, admin can share link manually
      return NextResponse.json({
        ok: true,
        screeningUrl,
        emailSent: false,
        warning: 'Token aangemaakt maar e-mail versturen mislukt. Stuur de link handmatig.',
      });
    }
  }

  return NextResponse.json({
    ok: true,
    screeningUrl,
    emailSent: !!process.env.RESEND_API_KEY,
    expiresAt,
  });
}
