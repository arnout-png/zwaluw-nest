import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendRejectionEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }
  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json() as { reason?: string; sendEmail?: boolean };

  // Fetch candidate for email
  const { data: candidate, error: fetchError } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, email')
    .eq('id', id)
    .single();

  if (fetchError || !candidate) {
    return NextResponse.json({ error: 'Kandidaat niet gevonden.' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    status: 'REJECTED',
    stageUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (body.reason) {
    updates.rejectionReason = body.reason;
  }

  let rejectionEmailSent = false;

  if (body.sendEmail && candidate.email && process.env.RESEND_API_KEY) {
    try {
      await sendRejectionEmail({
        to: candidate.email,
        candidateName: candidate.name,
      });
      rejectionEmailSent = true;
    } catch (err) {
      console.error('Rejection email failed:', err);
    }
  }

  updates.rejectionEmailSent = rejectionEmailSent;

  const { data, error } = await supabaseAdmin
    .from('Candidate')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Kan kandidaat niet bijwerken.' }, { status: 500 });
  }

  return NextResponse.json({ data, emailSent: rejectionEmailSent });
}
