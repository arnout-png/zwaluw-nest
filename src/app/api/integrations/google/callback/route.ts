import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeCode } from '@/lib/google-calendar';

/**
 * GET /api/integrations/google/callback
 * Receives the OAuth callback from Google, exchanges the code for tokens,
 * and saves the refresh token to EmployeeProfile.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // userId encoded in state
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/dashboard/instellingen?google=error`);
  }

  try {
    const { refreshToken } = await exchangeCode(code);

    // Save to EmployeeProfile
    const { error: updateError } = await supabaseAdmin
      .from('EmployeeProfile')
      .update({
        googleRefreshToken: refreshToken,
        googleCalendarId: 'primary',
        googleSyncEnabled: true,
      })
      .eq('userId', state);

    if (updateError) {
      console.error('Failed to save Google token:', updateError);
      return NextResponse.redirect(`${baseUrl}/dashboard/instellingen?google=error`);
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/instellingen?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${baseUrl}/dashboard/instellingen?google=error`);
  }
}
