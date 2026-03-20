import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAllScreeningScripts, getAllInterviewChecklists } from '@/lib/data';
import { TemplatesClient } from './templates-client';

export default async function TemplatesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const [screeningScripts, interviewChecklists] = await Promise.all([
    getAllScreeningScripts(),
    getAllInterviewChecklists(),
  ]);

  return (
    <TemplatesClient
      screeningScripts={screeningScripts}
      interviewChecklists={interviewChecklists}
    />
  );
}
