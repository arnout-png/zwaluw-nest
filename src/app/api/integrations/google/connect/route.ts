import { NextResponse } from 'next/server';
import { getSession, signOAuthState } from '@/lib/auth';
import { getGoogleAuthUrl } from '@/lib/google-calendar';

/**
 * GET /api/integrations/google/connect
 * Redirects the authenticated user to Google's OAuth consent screen.
 * De state is een ondertekend, 10 minuten geldig token met de userId,
 * zodat de callback niet met een vervalste userId kan worden aangeroepen.
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

  const state = await signOAuthState(session.userId, 'google-calendar');
  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
