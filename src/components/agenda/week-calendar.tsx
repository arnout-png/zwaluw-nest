'use client';

import type { Appointment } from '@/types';

interface WeekCalendarProps {
  weekStart: Date;
  appointments: Appointment[];
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08:00–18:00
const APPT_COLORS = [
  'bg-[#68b0a6]/80 border-[#68b0a6]',
  'bg-[#f7a247]/80 border-[#f7a247]',
  'bg-blue-500/80 border-blue-400',
  'bg-purple-500/80 border-purple-400',
  'bg-pink-500/80 border-pink-400',
  'bg-green-600/80 border-green-500',
];
const DAY_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

function getApptHour(appt: Appointment): number {
  if (appt.startTime) {
    const d = new Date(appt.startTime);
    if (!isNaN(d.getTime())) return d.getHours();
    // Handle "HH:mm" format
    const parts = appt.startTime.split(':');
    if (parts.length >= 2) return parseInt(parts[0], 10);
  }
  return -1;
}

function getDurationMin(appt: Appointment): number {
  if (appt.startTime && appt.endTime) {
    const start = new Date(appt.startTime);
    const end = new Date(appt.endTime);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return Math.round((end.getTime() - start.getTime()) / 60000);
    }
  }
  return 60;
}

export function WeekCalendar({ weekStart, appointments }: WeekCalendarProps) {
  // Build 7 day dates
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Map employeeProfileId to colors
  const employeeProfileIds = [...new Set(appointments.map((a) => a.employeeProfileId))];
  const colorMap = Object.fromEntries(
    employeeProfileIds.map((id, i) => [id, APPT_COLORS[i % APPT_COLORS.length]])
  );

  function getApptsForDayHour(day: Date, hour: number) {
    const dateStr = day.toISOString().split('T')[0];
    return appointments.filter((a) => {
      // Match on date field (YYYY-MM-DD)
      const apptDate = a.date ?? (a.startTime ? new Date(a.startTime).toISOString().split('T')[0] : '');
      return apptDate === dateStr && getApptHour(a) === hour;
    });
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Day headers */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] gap-px bg-[#363848]">
          <div className="bg-[#252732]" />
          {days.map((day, i) => {
            const isToday = day.toISOString().split('T')[0] === todayStr;
            return (
              <div key={i} className={`bg-[#252732] px-2 py-2 text-center ${isToday ? 'bg-[#68b0a6]/5' : ''}`}>
                <div className="text-xs font-medium text-[#9ca3af]">{DAY_SHORT[i]}</div>
                <div className={`text-sm font-semibold ${isToday ? 'text-[#68b0a6]' : 'text-white'}`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[48px_repeat(7,1fr)] gap-px bg-[#363848]">
            <div className="bg-[#252732] px-1 py-1 text-right">
              <span className="text-[10px] text-[#9ca3af]">{hour}:00</span>
            </div>
            {days.map((day, di) => {
              const appts = getApptsForDayHour(day, hour);
              const isToday = day.toISOString().split('T')[0] === todayStr;
              return (
                <div
                  key={di}
                  className={`min-h-[52px] bg-[#252732] p-0.5 ${isToday ? 'bg-[#68b0a6]/5' : ''}`}
                >
                  {appts.map((appt) => {
                    const color = colorMap[appt.employeeProfileId] ?? APPT_COLORS[0];
                    const empProfile = appt.employeeProfile as { user?: { name?: string } } | undefined;
                    const empName = empProfile?.user?.name?.split(' ')[0] ?? '?';
                    const custName = (appt.customer as { name?: string } | undefined)?.name ?? appt.title;
                    const durationMin = getDurationMin(appt);
                    return (
                      <div
                        key={appt.id}
                        className={`rounded px-1.5 py-1 text-[10px] border-l-2 text-white ${color} mb-0.5 cursor-pointer hover:opacity-90 transition-opacity`}
                        title={`${empName} — ${custName}`}
                      >
                        <div className="font-medium truncate">{custName}</div>
                        <div className="opacity-80 truncate">{empName} · {durationMin}min</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
