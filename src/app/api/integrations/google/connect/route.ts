import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGoogleAuthUrl } from '@/lib/google-calendar';

/**
 * GET /api/integrations/google/connect
 * Redirects the authenticated user to Google's OAuth consent screen.
 * The state param encodes the userId so we can save the token after callback.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Google OAuth is niet geconfigureerd. Voeg GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET toe.' },
      { status: 503 }
    );
  }

  const url = getGoogleAuthUrl(session.userId);
  return NextResponse.redirect(url);
}
