import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { EMAIL_AUTOMATION_CATALOG } from '@/lib/email-automations';
import { EmailAutomationsClient } from './email-automations-client';

export default async function EmailAutomationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['ADMIN', 'MANAGER'].includes(session.role)) redirect('/dashboard');

  return <EmailAutomationsClient catalog={EMAIL_AUTOMATION_CATALOG} />;
}
