import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { VacaturesClient } from './vacatures-client';
import type { JobOpening } from '@/types';

export default async function VacaturesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const { data } = await supabaseAdmin
    .from('JobOpening')
    .select('id, slug, title, description, requirements, location, hoursPerWeek, salaryRange, imageUrl, roleType, isActive, createdAt, updatedAt')
    .order('createdAt', { ascending: false });

  return (
    <VacaturesClient initialJobOpenings={(data ?? []) as unknown as JobOpening[]} />
  );
}
