import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { UserProvider } from '@/contexts/user-context';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { parsePermissions } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Fetch live permissions (not cached in JWT so changes take effect immediately)
  const { data: userRow } = await supabaseAdmin
    .from('User')
    .select('permissions')
    .eq('id', session.userId)
    .single();

  const permissions = parsePermissions(userRow?.permissions as string | null);

  return (
    <UserProvider
      user={{
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        permissions,
      }}
    >
      <div className="min-h-screen bg-[#1e2028]">
        <Sidebar />
        <div className="lg:pl-60 flex flex-col min-h-screen">
          <Header title="ZwaluwNest" />
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </UserProvider>
  );
}
