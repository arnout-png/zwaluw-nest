import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { InstellingenClient } from './instellingen-client';

export default async function InstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const { google } = await searchParams;

  // Fetch this user's employee profile to show Google Calendar status
  const { data: profile } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('googleSyncEnabled, googleCalendarId')
    .eq('userId', session.userId)
    .single();

  const googleConnected = profile?.googleSyncEnabled === true;

  return (
    <InstellingenClient
      googleConnected={googleConnected}
      googleStatus={google}
      hasGoogleCredentials={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      hasResend={!!process.env.RESEND_API_KEY}
      hasFacebook={!!process.env.FACEBOOK_APP_SECRET}
      hasGoogleSheets={!!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS && !!process.env.GOOGLE_SHEETS_ID}
      hasCronSecret={!!process.env.CRON_SECRET}
      hasNmbrs={!!(process.env.NMBRS_USERNAME && process.env.NMBRS_TOKEN && process.env.NMBRS_DOMAIN)}
    />
  );
}
