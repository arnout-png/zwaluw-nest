import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAppointments } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase';
import { AgendaClient } from './agenda-client';

export default async function AgendaPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) redirect('/dashboard');

  // Fetch users directly (no EmployeeProfile join needed for agenda filter)
  const [appointments, usersResult] = await Promise.all([
    getAppointments(),
    supabaseAdmin.from('User').select('id, name, role').eq('isActive', true).order('name'),
  ]);

  const users = ((usersResult.data ?? []) as { id: string; name: string; role: string }[]).map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    employeeProfile: null as { id: string } | null,
  }));

  // Enrich with EmployeeProfile ids if they exist (for appointment matching)
  const { data: profiles } = await supabaseAdmin.from('EmployeeProfile').select('id, userId');
  if (profiles) {
    const profileMap = Object.fromEntries((profiles as { id: string; userId: string }[]).map(p => [p.userId, p.id]));
    for (const u of users) {
      if (profileMap[u.id]) {
        u.employeeProfile = { id: profileMap[u.id] };
      }
    }
  }

  return <AgendaClient appointments={appointments} employees={users as any} />;
}
