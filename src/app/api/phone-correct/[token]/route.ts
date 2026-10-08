import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { candidateRecipients } from '@/lib/recruitment';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: candidate } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, phoneCorrectExpiresAt, deletedAt')
    .eq('phoneCorrectToken', token)
    .maybeSingle();

  if (!candidate || candidate.deletedAt) {
    return NextResponse.json({ valid: false, error: 'invalid' });
  }

  if (candidate.phoneCorrectExpiresAt && new Date(candidate.phoneCorrectExpiresAt) < new Date()) {
    return NextResponse.json({ valid: false, error: 'expired' });
  }

  const firstName = (candidate.name ?? '').split(' ')[0];
  return NextResponse.json({ valid: true, firstName });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: candidate } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, phone, phoneCorrectExpiresAt, assignedToId, deletedAt')
    .eq('phoneCorrectToken', token)
    .maybeSingle();

  if (!candidate || candidate.deletedAt) {
    return NextResponse.json({ error: 'Ongeldige of verlopen link.' }, { status: 400 });
  }

  if (candidate.phoneCorrectExpiresAt && new Date(candidate.phoneCorrectExpiresAt) < new Date()) {
    return NextResponse.json({ error: 'Deze link is verlopen.' }, { status: 400 });
  }

  let body: { phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 });
  }
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '';
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 9 || digits.length > 15) {
    return NextResponse.json({ error: 'Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678.' }, { status: 400 });
  }

  const oldPhone = candidate.phone;

  // Update phone and clear token
  await supabaseAdmin
    .from('Candidate')
    .update({
      phone,
      phoneCorrectToken: null,
      phoneCorrectExpiresAt: null,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', candidate.id);

  // Melden aan de eigenaar van de kandidaat (zonder eigenaar: de beheerders).
  const recipientIds = await candidateRecipients(candidate.assignedToId as string | null);

  if (recipientIds.length) {
    const notifications = recipientIds.map((userId) => ({
      id: crypto.randomUUID(),
      userId,
      type: 'SYSTEM' as const,
      title: 'Nummer gecorrigeerd',
      message: `${candidate.name} heeft zijn/haar telefoonnummer gecorrigeerd naar ${phone}`,
      linkUrl: `/dashboard/werving/${candidate.id}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    await supabaseAdmin.from('Notification').insert(notifications);
  }

  // Audit log
  logAudit({
    userId: null as unknown as string,
    action: 'PHONE_CORRECT',
    entity: 'Candidate',
    entityId: candidate.id,
    details: { oldPhone, newPhone: phone, source: 'candidate_self_service' },
  });

  return NextResponse.json({ ok: true });
}
