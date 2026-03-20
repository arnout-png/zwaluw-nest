import Link from 'next/link';
import type { EmployeeWithProfile } from '@/types';

interface EmployeeCardProps {
  employee: EmployeeWithProfile;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Beheerder',
  PLANNER: 'Planner',
  ADVISEUR: 'Adviseur',
  MONTEUR: 'Monteur',
  CALLCENTER: 'Callcenter',
  BACKOFFICE: 'Backoffice',
  WAREHOUSE: 'Magazijn',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-500/10 text-purple-400',
  PLANNER: 'bg-blue-500/10 text-blue-400',
  ADVISEUR: 'bg-[#68b0a6]/10 text-[#68b0a6]',
  MONTEUR: 'bg-orange-500/10 text-orange-400',
  CALLCENTER: 'bg-pink-500/10 text-pink-400',
  BACKOFFICE: 'bg-yellow-500/10 text-yellow-400',
  WAREHOUSE: 'bg-gray-500/10 text-gray-400',
};

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const profile = employee.employeeProfile;
  const initials = employee.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const leaveBalance = profile?.leaveBalanceDays ?? 0;
  const leaveUsed = profile?.leaveUsedDays ?? 0;
  const leaveRemaining = leaveBalance - leaveUsed;

  return (
    <Link href={`/dashboard/personeel/${employee.id}`}>
      <div className="flex items-center gap-4 rounded-xl border border-[#363848] bg-[#252732] px-4 py-3 hover:bg-[#2d2f3d] transition-colors cursor-pointer">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#68b0a6]/20 text-sm font-bold text-[#68b0a6]">
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{employee.name}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[employee.role] ?? 'bg-[#9ca3af]/10 text-[#9ca3af]'}`}>
              {ROLE_LABELS[employee.role] ?? employee.role}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[#9ca3af] truncate">
              {profile?.department ?? employee.email}
            </span>
          </div>
        </div>

        {/* Leave balance */}
        <div className="hidden sm:block text-right shrink-0">
          <div className="text-sm font-medium text-white">{leaveRemaining}</div>
          <div className="text-xs text-[#9ca3af]">dagen over</div>
        </div>

        {/* Status dot */}
        <div className={`h-2 w-2 rounded-full shrink-0 ${employee.isActive ? 'bg-[#4ade80]' : 'bg-[#9ca3af]'}`} />
      </div>
    </Link>
  );
}
