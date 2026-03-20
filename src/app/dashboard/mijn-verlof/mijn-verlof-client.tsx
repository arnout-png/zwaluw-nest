'use client';

import { useState } from 'react';
import { LeaveRequestForm } from '@/components/verzuim/leave-request-form';
import type { LeaveRequest } from '@/types';

interface MijnVerlofClientProps {
  leaveRequests: LeaveRequest[];
  leaveBalance: number;
  leaveUsed: number;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vakantie', SICK: 'Ziek', PERSONAL: 'Persoonlijk',
  UNPAID: 'Onbetaald', SPECIAL: 'Bijzonder',
};

export function MijnVerlofClient({ leaveRequests: initial, leaveBalance, leaveUsed }: MijnVerlofClientProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>(initial);
  const [formMode, setFormMode] = useState<null | 'VACATION' | 'SICK'>(null);

  const leaveRemaining = leaveBalance - leaveUsed;
  const leavePercent = Math.min(100, Math.round((leaveUsed / Math.max(leaveBalance, 1)) * 100));

  function handleSuccess() {
    setFormMode(null);
    window.location.reload();
  }

  return (
    <div className="space-y-6 fade-in max-w-2xl">
      <h1 className="text-xl font-semibold text-white">Mijn Verlof</h1>

      {/* Balance card */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Verlofbalans</h2>
          <span className="text-2xl font-bold text-[#68b0a6]">{leaveRemaining}</span>
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-xs text-[#9ca3af] mb-1">
            <span>{leaveUsed} gebruikt</span>
            <span>{leaveBalance} totaal</span>
          </div>
          <div className="h-3 rounded-full bg-[#363848] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#68b0a6] transition-all duration-700"
              style={{ width: `${leavePercent}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-[#9ca3af]">{leaveRemaining} werkdagen resterend dit jaar</p>
      </div>

      {/* Action buttons */}
      {formMode === null && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setFormMode('VACATION')}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#363848] bg-[#252732] px-4 py-4 text-sm font-medium text-white hover:bg-[#2d2f3d] hover:border-[#68b0a6] transition-all"
          >
            <svg className="h-5 w-5 text-[#68b0a6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Vakantie aanvragen
          </button>
          <button
            onClick={() => setFormMode('SICK')}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#363848] bg-[#252732] px-4 py-4 text-sm font-medium text-white hover:bg-[#f7a247]/10 hover:border-[#f7a247] transition-all"
          >
            <svg className="h-5 w-5 text-[#f7a247]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Ziek melden
          </button>
        </div>
      )}

      {/* Form */}
      {formMode !== null && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            {formMode === 'SICK' ? 'Ziekmelding' : 'Verlofaanvraag'}
          </h2>
          <LeaveRequestForm
            defaultType={formMode}
            onSuccess={handleSuccess}
            onCancel={() => setFormMode(null)}
          />
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Verlofhistorie</h2>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <svg className="h-10 w-10 text-[#363848] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-[#9ca3af]">Nog geen verlofaanvragen ingediend.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg bg-[#1e2028] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      req.status === 'PENDING' ? 'bg-[#f7a247]/10 text-[#f7a247]' :
                      req.status === 'APPROVED' ? 'bg-[#4ade80]/10 text-[#4ade80]' :
                      req.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                      'bg-[#9ca3af]/10 text-[#9ca3af]'
                    }`}>
                      {req.status === 'PENDING' ? 'In behandeling' :
                       req.status === 'APPROVED' ? 'Goedgekeurd' :
                       req.status === 'REJECTED' ? 'Afgewezen' : 'Geannuleerd'}
                    </span>
                    <span className="text-sm text-[#e8e9ed]">
                      {LEAVE_TYPE_LABELS[req.type] ?? req.type}
                    </span>
                  </div>
                  <div className="text-xs text-[#9ca3af] mt-0.5">
                    {new Date(req.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                    {req.endDate ? ` – ${new Date(req.endDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
                  </div>
                  {req.reason && (
                    <div className="text-xs text-[#9ca3af] italic mt-0.5">{req.reason}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium text-[#e8e9ed]">{req.totalDays ?? 0}d</div>
                  <div className="text-xs text-[#9ca3af]">
                    {new Date(req.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
