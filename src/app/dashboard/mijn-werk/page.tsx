import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAppointments } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase';
import { MijnWerkClient } from './mijn-werk-client';

export default async function MijnWerkPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Resolve EmployeeProfile.id for the current user
  const { data: profileRow } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', session.userId)
    .single();
  const employeeProfileId = profileRow?.id as string | undefined;

  const today = new Date().toISOString().split('T')[0];
  const appointments = await getAppointments(today, employeeProfileId);

  return <MijnWerkClient appointments={appointments} session={session} />;
}
