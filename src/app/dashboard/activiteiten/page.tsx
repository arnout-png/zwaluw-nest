import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ActiviteitenClient } from './activiteiten-client';

export default async function ActiviteitenPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  // Fetch users for the filter dropdown
  const { data: users } = await supabaseAdmin
    .from('User')
    .select('id, name, email, role')
    .eq('isActive', true)
    .order('name');

  return (
    <ActiviteitenClient
      users={(users ?? []) as { id: string; name: string; email: string; role: string }[]}
    />
  );
}
