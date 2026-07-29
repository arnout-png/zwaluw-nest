import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: candidate } = await supabaseAdmin
    .from('Candidate')
    .select('id, name, phoneCorrectExpiresAt')
    .eq('phoneCorrectToken', token)
    .single();

  if (!candidate) {
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
    .select('id, name, phone, phoneCorrectExpiresAt')
    .eq('phoneCorrectToken', token)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: 'Ongeldige of verlopen link.' }, { status: 400 });
  }

  if (candidate.phoneCorrectExpiresAt && new Date(candidate.phoneCorrectExpiresAt) < new Date()) {
    return NextResponse.json({ error: 'Deze link is verlopen.' }, { status: 400 });
  }

  const body = await request.json();
  const phone = (body.phone ?? '').trim();

  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: 'Vul een geldig telefoonnummer in.' }, { status: 400 });
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

  // Create notifications for ADMIN + MANAGER users
  const { data: admins } = await supabaseAdmin
    .from('User')
    .select('id')
    .in('role', ['ADMIN', 'MANAGER'])
    .eq('isActive', true);

  if (admins?.length) {
    const notifications = (admins as { id: string }[]).map((u) => ({
      id: crypto.randomUUID(),
      userId: u.id,
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
