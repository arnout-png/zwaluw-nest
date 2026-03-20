'use client';

import { useState } from 'react';
import { LeaveCalendar } from '@/components/verzuim/leave-calendar';
import { LeaveRequestForm } from '@/components/verzuim/leave-request-form';
import type { LeaveRequest } from '@/types';

interface VerzuimClientProps {
  leaveRequests: LeaveRequest[];
  role: string;
  userId: string;         // User.id of the logged-in user
  employeeProfileId?: string; // EmployeeProfile.id of the logged-in user
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vakantie', SICK: 'Ziek', PERSONAL: 'Persoonlijk',
  UNPAID: 'Onbetaald', SPECIAL: 'Bijzonder',
};
const MONTH_NAMES = [
  'Januari','Februari','Maart','April','Mei','Juni',
  'Juli','Augustus','September','Oktober','November','December',
];

// Helper: extract the user name from a LeaveRequest (joined via employeeProfile.user)
function getRequesterName(req: LeaveRequest): string {
  const profile = req.employeeProfile;
  if (!profile) return 'Onbekend';
  const user = profile.user;
  if (!user) return 'Onbekend';
  return user.name ?? 'Onbekend';
}

export function VerzuimClient({
  leaveRequests: initialRequests,
  role,
  employeeProfileId,
}: VerzuimClientProps) {
  const isManager = role === 'ADMIN' || role === 'PLANNER';
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('VACATION');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pending = requests.filter((r) => r.status === 'PENDING');
  // My requests = requests for the current employee profile
  const myRequests = employeeProfileId
    ? requests.filter((r) => r.employeeProfileId === employeeProfileId)
    : requests;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  async function handleApprove(id: string, status: 'APPROVED' | 'REJECTED') {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      }
    } finally {
      setProcessingId(null);
    }
  }

  function handleFormSuccess() {
    setShowForm(false);
    window.location.reload();
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Verzuim & Verlof</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            {isManager ? `${pending.length} openstaande aanvragen` : 'Mijn verlofoverzicht'}
          </p>
        </div>
        {!isManager && (
          <div className="flex gap-2">
            <button
              onClick={() => { setFormType('VACATION'); setShowForm(true); }}
              className="flex items-center gap-2 rounded-lg bg-[#68b0a6] px-3 py-2 text-sm font-medium text-white hover:bg-[#7ec4ba] transition-colors"
            >
              Verlof aanvragen
            </button>
            <button
              onClick={() => { setFormType('SICK'); setShowForm(true); }}
              className="flex items-center gap-2 rounded-lg bg-[#f7a247] px-3 py-2 text-sm font-medium text-white hover:bg-[#f9b76d] transition-colors"
            >
              Ziek melden
            </button>
          </div>
        )}
      </div>

      {/* Leave form (non-managers) */}
      {!isManager && showForm && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            {formType === 'SICK' ? 'Ziekmelding' : 'Verlofaanvraag'}
          </h2>
          <LeaveRequestForm
            defaultType={formType}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {isManager ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Calendar — takes 2 cols */}
          <div className="lg:col-span-2 rounded-xl border border-[#363848] bg-[#252732] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">
                {MONTH_NAMES[month]} {year}
              </h2>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1e2028] hover:text-white transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button onClick={nextMonth} className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1e2028] hover:text-white transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <LeaveCalendar year={year} month={month} leaveRequests={requests} />
          </div>

          {/* Pending approvals */}
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Ter goedkeuring</h2>
              {pending.length > 0 && (
                <span className="rounded-full bg-[#f7a247]/10 px-2 py-0.5 text-xs font-medium text-[#f7a247]">
                  {pending.length}
                </span>
              )}
            </div>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg className="h-10 w-10 text-[#363848] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-[#9ca3af]">Alles bijgewerkt</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pending.map((req) => (
                  <div key={req.id} className="rounded-lg bg-[#1e2028] p-3">
                    <div className="text-sm font-medium text-white">{getRequesterName(req)}</div>
                    <div className="text-xs text-[#9ca3af] mt-0.5">
                      {LEAVE_TYPE_LABELS[req.type] ?? req.type} · {req.totalDays ?? 0}d
                    </div>
                    <div className="text-xs text-[#9ca3af]">
                      {new Date(req.startDate).toLocaleDateString('nl-NL')}
                      {req.endDate ? ` – ${new Date(req.endDate).toLocaleDateString('nl-NL')}` : ''}
                    </div>
                    {req.reason && (
                      <div className="text-xs text-[#9ca3af] mt-1 italic">{req.reason}</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        disabled={processingId === req.id}
                        onClick={() => handleApprove(req.id, 'APPROVED')}
                        className="flex-1 rounded-md bg-[#4ade80]/10 px-2 py-1 text-xs font-medium text-[#4ade80] hover:bg-[#4ade80]/20 disabled:opacity-50 transition-colors"
                      >
                        Goedkeuren
                      </button>
                      <button
                        disabled={processingId === req.id}
                        onClick={() => handleApprove(req.id, 'REJECTED')}
                        className="flex-1 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                      >
                        Afwijzen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Own leave history */
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Mijn verlofhistorie</h2>
          {myRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <svg className="h-10 w-10 text-[#363848] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-[#9ca3af]">Nog geen verlofaanvragen ingediend.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg bg-[#1e2028] px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        req.status === 'PENDING' ? 'bg-[#f7a247]/10 text-[#f7a247]' :
                        req.status === 'APPROVED' ? 'bg-[#4ade80]/10 text-[#4ade80]' :
                        req.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                        'bg-[#9ca3af]/10 text-[#9ca3af]'
                      }`}>
                        {req.status === 'PENDING' ? 'Wachten' : req.status === 'APPROVED' ? 'Goedgekeurd' : req.status === 'REJECTED' ? 'Afgewezen' : 'Geannuleerd'}
                      </span>
                      <span className="text-sm text-[#e8e9ed]">{LEAVE_TYPE_LABELS[req.type] ?? req.type}</span>
                    </div>
                    <div className="text-xs text-[#9ca3af] mt-0.5">
                      {new Date(req.startDate).toLocaleDateString('nl-NL')}
                      {req.endDate ? ` – ${new Date(req.endDate).toLocaleDateString('nl-NL')}` : ''}
                    </div>
                    {req.reason && <div className="text-xs text-[#9ca3af] mt-0.5 italic">{req.reason}</div>}
                  </div>
                  <span className="text-sm font-medium text-[#e8e9ed]">{req.totalDays ?? 0}d</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
