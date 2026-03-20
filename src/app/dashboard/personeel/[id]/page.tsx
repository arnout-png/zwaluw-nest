import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getEmployee } from '@/lib/data';
import { DossierClient } from './dossier-client';
import { ContractClient } from './contract-client';
import type { LeaveRequest, DossierEntry, Contract } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Beheerder', PLANNER: 'Planner', ADVISEUR: 'Adviseur',
  MONTEUR: 'Monteur', CALLCENTER: 'Callcenter', BACKOFFICE: 'Backoffice', WAREHOUSE: 'Magazijn',
};
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-500/10 text-purple-400', PLANNER: 'bg-blue-500/10 text-blue-400',
  ADVISEUR: 'bg-[#68b0a6]/10 text-[#68b0a6]', MONTEUR: 'bg-orange-500/10 text-orange-400',
  CALLCENTER: 'bg-pink-500/10 text-pink-400', BACKOFFICE: 'bg-yellow-500/10 text-yellow-400',
  WAREHOUSE: 'bg-gray-500/10 text-gray-400',
};
const LEAVE_LABELS: Record<string, string> = {
  VACATION: 'Vakantie', SICK: 'Ziek', PERSONAL: 'Persoonlijk', UNPAID: 'Onbetaald', SPECIAL: 'Bijzonder',
};
const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-[#f7a247]/10 text-[#f7a247]', APPROVED: 'bg-[#4ade80]/10 text-[#4ade80]',
  REJECTED: 'bg-red-500/10 text-red-400', CANCELLED: 'bg-[#9ca3af]/10 text-[#9ca3af]',
};


export default async function EmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const profile = employee.employeeProfile;
  const contracts = (profile?.contracts ?? []) as Contract[];
  const leaveRequests = (profile?.leaveRequests ?? []) as LeaveRequest[];
  const dossierEntries = (profile?.dossierEntries ?? []) as DossierEntry[];

  const initials = employee.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  const leaveBalance = profile?.leaveBalanceDays ?? 25;
  const leaveUsed = profile?.leaveUsedDays ?? 0;
  const leavePercent = Math.min(100, Math.round((leaveUsed / leaveBalance) * 100));

  return (
    <div className="space-y-6 fade-in max-w-4xl">
      {/* Back */}
      <a href="/dashboard/personeel" className="inline-flex items-center gap-1 text-sm text-[#9ca3af] hover:text-white transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Terug naar Personeel
      </a>

      {/* Header card */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#68b0a6]/20 text-xl font-bold text-[#68b0a6] shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-xl font-semibold text-white">{employee.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[employee.role] ?? ''}`}>
                {ROLE_LABELS[employee.role] ?? employee.role}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${employee.isActive ? 'bg-[#4ade80]/10 text-[#4ade80]' : 'bg-[#9ca3af]/10 text-[#9ca3af]'}`}>
                {employee.isActive ? 'Actief' : 'Inactief'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-[#9ca3af]">
              <span>{employee.email}</span>
              {profile?.department && <span>{profile.department}</span>}
              {profile?.phonePersonal && <span>{profile.phonePersonal}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Contracts — interactive, allows creating new contracts */}
      {profile?.id && (
        <ContractClient employeeProfileId={profile.id} initialContracts={contracts} />
      )}

      {/* Leave */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Verlof</h2>
        {/* Balance bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-[#9ca3af] mb-1">
            <span>Verlofbalans</span>
            <span>{leaveUsed} / {leaveBalance} dagen gebruikt</span>
          </div>
          <div className="h-2 rounded-full bg-[#363848] overflow-hidden">
            <div className="h-full rounded-full bg-[#68b0a6] transition-all" style={{ width: `${leavePercent}%` }} />
          </div>
          <div className="mt-1 text-xs text-[#68b0a6]">{leaveBalance - leaveUsed} dagen resterend</div>
        </div>
        {leaveRequests.length === 0 ? (
          <p className="text-sm text-[#9ca3af] py-2 text-center">Geen verlofaanvragen gevonden.</p>
        ) : (
          <div className="space-y-2">
            {leaveRequests.slice(0, 8).map((lr) => (
              <div key={lr.id} className="flex items-center justify-between rounded-lg bg-[#1e2028] px-4 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEAVE_STATUS_COLORS[lr.status] ?? ''}`}>
                      {lr.status === 'PENDING' ? 'Wachten' : lr.status === 'APPROVED' ? 'Goedgekeurd' : lr.status === 'REJECTED' ? 'Afgewezen' : 'Geannuleerd'}
                    </span>
                    <span className="text-xs text-[#9ca3af]">{LEAVE_LABELS[lr.type] ?? lr.type}</span>
                  </div>
                  <div className="text-xs text-[#9ca3af] mt-0.5">
                    {new Date(lr.startDate).toLocaleDateString('nl-NL')}
                    {lr.endDate ? ` – ${new Date(lr.endDate).toLocaleDateString('nl-NL')}` : ''}
                  </div>
                </div>
                <span className="text-sm font-medium text-[#e8e9ed]">{lr.totalDays ?? 0}d</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dossier (admin only) — interactive client component */}
      <DossierClient employeeId={employee.id} initialEntries={dossierEntries} />
    </div>
  );
}
