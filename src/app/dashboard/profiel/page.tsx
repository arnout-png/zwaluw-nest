import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getVacationDaysUsed } from '@/lib/data';
import { datePart } from '@/lib/dates';
import { ProfielClient } from './profiel-client';

export default async function ProfielPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch user + profile in parallel
  const [userRes, profileRes] = await Promise.all([
    supabaseAdmin
      .from('User')
      .select('id, name, email, role')
      .eq('id', session.userId)
      .single(),
    supabaseAdmin
      .from('EmployeeProfile')
      .select(
        `id, dateOfBirth, address, city, postalCode, phonePersonal,
         emergencyName, emergencyPhone, startDate, department,
         leaveBalanceDays, leaveUsedDays`
      )
      .eq('userId', session.userId)
      .maybeSingle(),
  ]);

  const user = userRes.data;
  const profile = profileRes.data;
  const profileId = (profile as { id?: string } | null)?.id;
  const vacationUsed = profileId ? (await getVacationDaysUsed([profileId]))[profileId] ?? 0 : 0;

  if (!user) redirect('/login');

  return (
    <ProfielClient
      initialData={{
        name: user.name ?? '',
        email: user.email ?? '',
        role: user.role ?? '',
        address: profile?.address ?? '',
        city: profile?.city ?? '',
        postalCode: profile?.postalCode ?? '',
        phonePersonal: profile?.phonePersonal ?? '',
        // <input type="date"> wil JJJJ-MM-DD; de database levert "…T00:00:00" (veld bleef leeg).
        dateOfBirth: datePart(profile?.dateOfBirth as string | undefined) ?? '',
        emergencyName: profile?.emergencyName ?? '',
        emergencyPhone: profile?.emergencyPhone ?? '',
        department: profile?.department ?? '',
        startDate: datePart(profile?.startDate as string | undefined) ?? '',
        leaveBalanceDays: (profile as { leaveBalanceDays?: number } | null)?.leaveBalanceDays ?? 25,
        leaveUsedDays: ((profile as { leaveUsedDays?: number } | null)?.leaveUsedDays ?? 0) + vacationUsed,
      }}
    />
  );
}
