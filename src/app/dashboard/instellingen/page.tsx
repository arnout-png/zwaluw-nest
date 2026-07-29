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
  if (!['ADMIN', 'MANAGER'].includes(session.role)) redirect('/dashboard');

  const { google } = await searchParams;

  // Fetch this user's employee profile to show Google Calendar status
  const { data: profile } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('googleSyncEnabled, googleCalendarId')
    .eq('userId', session.userId)
    .single();

  const googleConnected = profile?.googleSyncEnabled === true;

  // Fetch all active users for role assignment dropdowns
  const { data: staffUsers } = await supabaseAdmin
    .from('User')
    .select('id, name, jobTitle, role')
    .eq('isActive', true)
    .order('name');

  return (
    <InstellingenClient
      googleConnected={googleConnected}
      googleStatus={google}
      hasGoogleCredentials={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      hasGoogleSheets={!!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS && !!process.env.GOOGLE_SHEETS_IDS}
      hasCronSecret={!!process.env.CRON_SECRET}
      staffUsers={(staffUsers ?? []) as { id: string; name: string; jobTitle?: string | null; role: string }[]}
    />
  );
}
