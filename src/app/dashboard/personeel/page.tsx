import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getEmployees } from '@/lib/data';
import { PersoneelClient } from './personeel-client';

export default async function PersoneelPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const employees = await getEmployees();

  return <PersoneelClient employees={employees} />;
}
