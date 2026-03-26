import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { GebruikersClient } from './gebruikers-client';

export interface UserWithPhone {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  phonePersonal?: string | null;
}

export default async function GebruikersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  // Fetch all users
  const { data: users } = await supabaseAdmin
    .from('User')
    .select('id, email, name, role, isActive, createdAt')
    .order('name');

  // Fetch all employee profiles for phone numbers
  const userIds = (users ?? []).map((u: { id: string }) => u.id);
  const { data: profiles } = userIds.length > 0
    ? await supabaseAdmin
        .from('EmployeeProfile')
        .select('userId, phonePersonal')
        .in('userId', userIds)
    : { data: [] };

  const phoneMap = Object.fromEntries(
    ((profiles ?? []) as { userId: string; phonePersonal?: string | null }[]).map(p => [p.userId, p.phonePersonal])
  );

  const enrichedUsers: UserWithPhone[] = ((users ?? []) as UserWithPhone[]).map(u => ({
    ...u,
    phonePersonal: phoneMap[u.id] ?? null,
  }));

  return <GebruikersClient initialUsers={enrichedUsers} />;
}
