import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAppointments, getEmployees } from '@/lib/data';
import { AgendaClient } from './agenda-client';

export default async function AgendaPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') redirect('/dashboard');

  const [appointments, employees] = await Promise.all([
    getAppointments(),
    getEmployees(),
  ]);

  return <AgendaClient appointments={appointments} employees={employees} />;
}
