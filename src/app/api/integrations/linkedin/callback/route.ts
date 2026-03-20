import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { exchangeLinkedInCode } from '@/lib/linkedin';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/dashboard/instellingen?linkedin=error&reason=${encodeURIComponent(error)}`,
      },
    });
  }

  if (!code) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/dashboard/instellingen?linkedin=error&reason=no_code' },
    });
  }

  // Verify state cookie
  const cookieHeader = req.headers.get('cookie') ?? '';
  const stateCookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('li_oauth_state='))
    ?.split('=')[1];

  if (!stateCookie || stateCookie !== state) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/dashboard/instellingen?linkedin=error&reason=state_mismatch' },
    });
  }

  try {
    const tokenData = await exchangeLinkedInCode(code);

    // Store the access token in the AppSetting table (key: LINKEDIN_ACCESS_TOKEN)
    // This allows runtime access without re-deploying.
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await supabaseAdmin.from('AppSetting').upsert(
      { key: 'LINKEDIN_ACCESS_TOKEN', value: tokenData.access_token, updatedAt: new Date().toISOString() },
      { onConflict: 'key' }
    );
    await supabaseAdmin.from('AppSetting').upsert(
      { key: 'LINKEDIN_TOKEN_EXPIRES_AT', value: expiresAt, updatedAt: new Date().toISOString() },
      { onConflict: 'key' }
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/dashboard/instellingen?linkedin=connected',
        'Set-Cookie': 'li_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
      },
    });
  } catch (err) {
    console.error('[LinkedIn callback]', err);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/dashboard/instellingen?linkedin=error&reason=${encodeURIComponent(String(err))}`,
      },
    });
  }
}
