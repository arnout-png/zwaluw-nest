import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const TELNYX_MESSAGES_URL = 'https://api.telnyx.com/v2/messages';

function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().]/g, '').replace(/^p:/, '');
  if (n.startsWith('00')) n = '+' + n.slice(2);
  else if (n.startsWith('0') && !n.startsWith('00')) n = '+31' + n.slice(1);
  else if (!n.startsWith('+')) n = '+31' + n;
  return n;
}

/**
 * POST /api/admin/test-sms
 * Stuurt een test-SMS naar een opgegeven nummer.
 * Body: { to: string, message: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  if (!process.env.TELNYX_API_KEY || !process.env.TELNYX_PHONE_NUMBER) {
    return NextResponse.json({ error: 'Telnyx niet geconfigureerd (TELNYX_API_KEY / TELNYX_PHONE_NUMBER).' }, { status: 503 });
  }

  const body = await request.json();
  const to = body.to as string;
  const message = body.message as string;

  if (!to || !message) {
    return NextResponse.json({ error: 'Veld "to" en "message" zijn verplicht.' }, { status: 400 });
  }

  const normalized = normalizePhone(to);

  const res = await fetch(TELNYX_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.TELNYX_PHONE_NUMBER,
      to: normalized,
      text: message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Test SMS] Telnyx fout:', res.status, err);
    return NextResponse.json({ error: `Telnyx fout: ${res.status}`, details: err }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({
    ok: true,
    to: normalized,
    from: process.env.TELNYX_PHONE_NUMBER,
    telnyxId: data?.data?.id,
  });
}
