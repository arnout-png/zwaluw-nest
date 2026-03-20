'use client';

import type { LeaveRequest } from '@/types';

interface LeaveCalendarProps {
  year: number;
  month: number; // 0-indexed
  leaveRequests: LeaveRequest[];
}

const EMPLOYEE_COLORS = [
  'bg-[#68b0a6]/70', 'bg-[#f7a247]/70', 'bg-blue-500/70', 'bg-purple-500/70',
  'bg-pink-500/70', 'bg-green-500/70', 'bg-yellow-500/70', 'bg-red-500/70',
];

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export function LeaveCalendar({ year, month, leaveRequests }: LeaveCalendarProps) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Map employeeProfileId to colors
  const profileIds = [...new Set(leaveRequests.map((r) => r.employeeProfileId))];
  const colorMap = Object.fromEntries(
    profileIds.map((pid, i) => [pid, EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length]])
  );

  // Helper: get display name from a leave request
  function getName(r: LeaveRequest): string {
    return r.employeeProfile?.user?.name ?? r.employeeProfileId;
  }

  // Start on Monday (0=Mon in our grid)
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null);

  function getLeavesOnDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaveRequests.filter((r) => {
      return (
        r.status === 'APPROVED' &&
        r.startDate <= dateStr &&
        (r.endDate ?? r.startDate) >= dateStr
      );
    });
  }

  const today = new Date();
  const todayCell = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-[#9ca3af] py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="h-14 rounded-lg bg-[#1e2028]/50" />;
          }
          const leaves = getLeavesOnDay(day);
          const isToday = day === todayCell;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isWeekend = (() => {
            const dow = new Date(dateStr).getDay();
            return dow === 0 || dow === 6;
          })();

          return (
            <div
              key={day}
              className={`h-14 rounded-lg p-1 text-xs overflow-hidden ${
                isToday ? 'ring-1 ring-[#68b0a6] bg-[#68b0a6]/5' :
                isWeekend ? 'bg-[#1a1c22]' :
                'bg-[#1e2028]'
              }`}
            >
              <div className={`font-medium mb-1 ${isToday ? 'text-[#68b0a6]' : isWeekend ? 'text-[#9ca3af]/50' : 'text-[#9ca3af]'}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {leaves.slice(0, 2).map((leave) => (
                  <div
                    key={leave.id}
                    className={`rounded px-1 py-0.5 text-[9px] text-white truncate ${colorMap[leave.employeeProfileId] ?? 'bg-[#68b0a6]/70'}`}
                    title={getName(leave)}
                  >
                    {getName(leave).split(' ')[0] ?? '?'}
                  </div>
                ))}
                {leaves.length > 2 && (
                  <div className="text-[9px] text-[#9ca3af]">+{leaves.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {profileIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {profileIds.map((pid, i) => {
            const req = leaveRequests.find((r) => r.employeeProfileId === pid);
            const name = req ? getName(req) : pid;
            return (
              <div key={pid} className="flex items-center gap-1">
                <div className={`h-2.5 w-2.5 rounded-full ${EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length].replace('/70', '')}`} />
                <span className="text-xs text-[#9ca3af]">{name.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
