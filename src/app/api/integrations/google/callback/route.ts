import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeCode } from '@/lib/google-calendar';
import { getSession, verifyOAuthState } from '@/lib/auth';
import { logAudit, getIp } from '@/lib/audit';

/**
 * GET /api/integrations/google/callback
 * Receives the OAuth callback from Google, exchanges the code for tokens,
 * and saves the refresh token to EmployeeProfile.
 *
 * De state moet een door ons ondertekend token zijn én bij de ingelogde
 * gebruiker horen; anders kon iemand een eigen Google-account aan het profiel
 * van een collega hangen.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const settingsUrl = (status: string) => new URL(`/dashboard/instellingen?google=${status}`, request.url);

  if (error || !code || !state) {
    return NextResponse.redirect(settingsUrl('error'));
  }

  const session = await getSession();
  const stateUserId = await verifyOAuthState(state, 'google-calendar');
  if (!session || !stateUserId || stateUserId !== session.userId) {
    return NextResponse.redirect(settingsUrl('error'));
  }

  try {
    const { refreshToken } = await exchangeCode(code);

    // Save to EmployeeProfile
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('EmployeeProfile')
      .update({
        googleRefreshToken: refreshToken,
        googleCalendarId: 'primary',
        googleSyncEnabled: true,
      })
      .eq('userId', session.userId)
      .select('id');

    if (updateError || !updated?.length) {
      console.error('Failed to save Google token:', updateError?.message ?? 'geen medewerkersprofiel');
      return NextResponse.redirect(settingsUrl('error'));
    }

    await logAudit({
      userId: session.userId,
      action: 'GOOGLE_CALENDAR_CONNECTED',
      entity: 'EmployeeProfile',
      entityId: updated[0].id as string,
      ipAddress: getIp(request),
    });

    return NextResponse.redirect(settingsUrl('connected'));
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(settingsUrl('error'));
  }
}
