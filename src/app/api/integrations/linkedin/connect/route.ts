import { getSession } from '@/lib/auth';
import { buildLinkedInAuthUrl } from '@/lib/linkedin';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!process.env.LINKEDIN_CLIENT_ID) {
    return new Response(
      JSON.stringify({ error: 'LINKEDIN_CLIENT_ID not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Random state token prevents CSRF
  const state = crypto.randomUUID();
  const authUrl = buildLinkedInAuthUrl(state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      // Short-lived cookie so callback can verify the state parameter
      'Set-Cookie': `li_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
