'use client';

import { useState } from 'react';
import type { Appointment } from '@/types';
import type { SessionPayload } from '@/lib/auth';

interface MijnWerkClientProps {
  appointments: Appointment[];
  session: SessionPayload;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Gepland',
  CONFIRMED: 'Bevestigd',
  IN_PROGRESS: 'Bezig',
  COMPLETED: 'Afgerond',
  CANCELLED: 'Geannuleerd',
  NO_SHOW: 'Niet verschenen',
};
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-400',
  CONFIRMED: 'bg-[#68b0a6]/10 text-[#68b0a6]',
  IN_PROGRESS: 'bg-[#f7a247]/10 text-[#f7a247]',
  COMPLETED: 'bg-[#4ade80]/10 text-[#4ade80]',
  CANCELLED: 'bg-[#9ca3af]/10 text-[#9ca3af]',
  NO_SHOW: 'bg-red-500/10 text-red-400',
};

function getApptTime(appt: Appointment): string {
  // startTime can be a full ISO string or a time string like "09:00"
  if (appt.startTime) {
    const d = new Date(appt.startTime);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    }
    return appt.startTime.slice(0, 5);
  }
  return '--:--';
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

export function MijnWerkClient({ appointments, session }: MijnWerkClientProps) {
  const [reportingSick, setReportingSick] = useState(false);
  const [sickSaving, setSickSaving] = useState(false);
  const [sickDone, setSickDone] = useState(false);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  async function handleSickReport() {
    setSickSaving(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SICK', startDate: todayStr, endDate: todayStr, reason: 'Ziekmelding via app' }),
      });
      setSickDone(true);
      setReportingSick(false);
    } finally {
      setSickSaving(false);
    }
  }

  return (
    <div className="space-y-5 fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white capitalize">{dateLabel}</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          {appointments.length === 0
            ? 'Geen afspraken vandaag'
            : `${appointments.length} afspraak${appointments.length !== 1 ? 'en' : ''} vandaag`}
        </p>
      </div>

      {/* Sick report button */}
      {sickDone ? (
        <div className="rounded-xl border border-[#4ade80]/30 bg-[#4ade80]/10 px-4 py-3 text-sm text-[#4ade80]">
          Ziekmelding ingediend. Beterschap!
        </div>
      ) : (
        <div>
          {reportingSick ? (
            <div className="rounded-xl border border-[#363848] bg-[#252732] p-4">
              <p className="text-sm text-white mb-3">Weet je zeker dat je je wilt ziek melden voor vandaag?</p>
              <div className="flex gap-3">
                <button
                  onClick={handleSickReport}
                  disabled={sickSaving}
                  className="flex-1 rounded-lg bg-[#f7a247] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#f9b76d] disabled:opacity-50 transition-colors"
                >
                  {sickSaving ? 'Bezig...' : 'Ziek melden'}
                </button>
                <button
                  onClick={() => setReportingSick(false)}
                  className="rounded-lg border border-[#363848] px-4 py-2.5 text-sm text-[#9ca3af] hover:text-white transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setReportingSick(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f7a247] px-4 py-3 text-sm font-semibold text-white hover:bg-[#f9b76d] transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Ziek melden
            </button>
          )}
        </div>
      )}

      {/* Appointments */}
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#363848] bg-[#252732] py-16 text-center">
          <svg className="h-14 w-14 text-[#363848] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-white font-medium">Geen werk vandaag</p>
          <p className="text-sm text-[#9ca3af] mt-1">Geen afspraken ingepland voor vandaag.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const time = getApptTime(appt);
            const durationMin = getDurationMin(appt);
            const customer = appt.customer as { name?: string; address?: string; city?: string } | undefined;
            const address = appt.location ?? (customer ? `${customer.address ?? ''} ${customer.city ?? ''}`.trim() : '');
            const mapsUrl = address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null;

            return (
              <div key={appt.id} className="rounded-xl border border-[#363848] bg-[#252732] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Time */}
                    <div className="text-2xl font-bold text-white mb-1">{time}</div>
                    {/* Customer name */}
                    <div className="text-base font-semibold text-[#e8e9ed]">
                      {customer?.name ?? 'Klant onbekend'}
                    </div>
                    {/* Title / type */}
                    <div className="text-sm text-[#68b0a6] mt-0.5">{appt.title}</div>
                    {/* Address */}
                    {address && (
                      <div className="text-sm text-[#9ca3af] mt-1">{address}</div>
                    )}
                    {/* Duration */}
                    <div className="text-xs text-[#9ca3af] mt-1">{durationMin} minuten</div>
                    {/* Notes / description */}
                    {appt.description && (
                      <div className="mt-2 rounded-lg bg-[#1e2028] px-3 py-2 text-xs text-[#9ca3af]">
                        {appt.description}
                      </div>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${STATUS_COLORS[appt.status] ?? ''}`}>
                    {STATUS_LABELS[appt.status] ?? appt.status}
                  </span>
                </div>

                {/* Navigation button */}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e2028] border border-[#363848] px-4 py-2.5 text-sm font-medium text-[#68b0a6] hover:bg-[#363848] transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Navigeren
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
