import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAppointments } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase';
import { amsterdamDateString } from '@/lib/dates';
import { MijnWerkClient } from './mijn-werk-client';

export default async function MijnWerkPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Resolve EmployeeProfile.id for the current user
  const { data: profileRow } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', session.userId)
    .maybeSingle();
  const employeeProfileId = profileRow?.id as string | undefined;

  // "Vandaag" in Nederland (de server draait in UTC; tussen 00:00 en 02:00
  // toonde de pagina anders de klussen van gisteren). Zonder profiel niets
  // tonen: getAppointments(datum, undefined) geeft de afspraken van iedereen.
  const today = amsterdamDateString();
  const appointments = employeeProfileId ? await getAppointments(today, employeeProfileId) : [];

  return <MijnWerkClient appointments={appointments} session={session} />;
}
