import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getCandidates } from '@/lib/data';
import { WervingClient } from './werving-client';

export default async function WervingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const candidates = await getCandidates();

  return <WervingClient initialCandidates={candidates} />;
}
