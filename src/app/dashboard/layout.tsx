import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { UserProvider } from '@/contexts/user-context';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <UserProvider
      user={{
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
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
