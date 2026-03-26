import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ContractrichtlijnenClient } from './contractrichtlijnen-client';

export default async function ContractrichtlijnenPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const { data } = await supabaseAdmin
    .from('ContractGuideline')
    .select('roleType, content, updatedAt');

  const guidelines = Object.fromEntries(
    (data ?? []).map((g: { roleType: string; content: string }) => [g.roleType, g.content])
  ) as Record<string, string>;

  return <ContractrichtlijnenClient initialGuidelines={guidelines} />;
}
