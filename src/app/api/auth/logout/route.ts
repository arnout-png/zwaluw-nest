import { NextRequest, NextResponse } from 'next/server';
import { destroySession, getSession } from '@/lib/auth';
import { logAudit, getIp } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const session = await getSession();
  await destroySession();
  if (session) {
    await logAudit({ userId: session.userId, action: 'LOGOUT', entity: 'User', entityId: session.userId, ipAddress: getIp(request) });
  }
  // Relatief aan het verzoek: zo belandt niemand op localhost of een vercel.app-URL
  // als NEXT_PUBLIC_APP_URL ontbreekt of verkeerd staat.
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
