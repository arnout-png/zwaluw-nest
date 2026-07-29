import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getCandidate } from '@/lib/data';
import { CandidateNotesClient } from './candidate-notes-client';
import { CandidateStageClient } from './candidate-stage-client';
import { CandidateAssignClient } from './candidate-assign-client';
import { CandidateCallLogClient } from './candidate-call-log-client';
import { CandidatePersonalDetailsClient } from './candidate-personal-details-client';
import { CandidateScreeningClient } from './candidate-screening-client';
import { CandidateChecklistClient } from './candidate-checklist-client';
import { CandidateWorkflowOutcomeClient } from './candidate-workflow-outcome-client';
import { CandidateInterviewOutcomeClient } from './candidate-interview-outcome-client';
import { CandidateDeleteClient } from './candidate-delete-client';
import { CandidateDetailTabs } from './candidate-detail-client';
import {
  getActiveScreeningScript,
  getScreeningAnswers,
  getActiveInterviewChecklist,
  getChecklistResults,
  getCallLogs,
} from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase';
import type { CandidateStatus } from '@/types';
import { VACATURE_ROL_LABELS } from '@/types';

const STATUS_LABELS: Record<CandidateStatus, string> = {
  NEW_LEAD: 'Nieuw',
  CONTACTED: 'Gecontacteerd',
  PRE_SCREENING: 'Pre-screening',
  SCREENING_DONE: 'Screening klaar',
  INTERVIEW: 'Sollicitatiegesprek',
  RESERVE_BANK: 'Reserve Bank',
  HIRED: 'Aangenomen',
  REJECTED: 'Afgewezen',
};

const STATUS_COLORS: Record<CandidateStatus, string> = {
  NEW_LEAD: 'bg-blue-500/10 text-blue-400',
  CONTACTED: 'bg-cyan-500/10 text-cyan-400',
  PRE_SCREENING: 'bg-yellow-500/10 text-yellow-400',
  SCREENING_DONE: 'bg-yellow-500/10 text-yellow-300',
  INTERVIEW: 'bg-purple-500/10 text-purple-400',
  RESERVE_BANK: 'bg-[#68b0a6]/10 text-[#68b0a6]',
  HIRED: 'bg-green-500/10 text-green-400',
  REJECTED: 'bg-red-500/10 text-red-400',
};

const STAGE_ORDER: CandidateStatus[] = ['NEW_LEAD', 'CONTACTED', 'PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW', 'RESERVE_BANK', 'HIRED'];

function ContractGuidelineBlock({ content, rolLabel }: { content: string; rolLabel: string }) {
  return (
    <details className="group rounded-xl border border-[#68b0a6]/30 bg-[#252732]">
      <summary className="flex cursor-pointer items-center justify-between p-5 list-none">
        <div className="flex items-center gap-3">
          <span className="text-lg">📄</span>
          <div>
            <h2 className="text-sm font-semibold text-white">Contractrichtlijnen — {rolLabel}</h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">Klik om arbeidsvoorwaarden te bekijken</p>
          </div>
        </div>
        <svg className="h-4 w-4 text-[#9ca3af] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-5 pb-5 border-t border-[#363848] pt-4">
        <pre className="whitespace-pre-wrap text-sm text-[#e8e9ed] font-sans leading-relaxed">{content}</pre>
      </div>
    </details>
  );
}

function ScoreDots({ score }: { score?: number | null }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${score != null && i <= score ? 'bg-[#68b0a6]' : 'bg-[#363848]'}`} />
      ))}
      {score != null && <span className="text-xs text-[#9ca3af] ml-1">{score}/5</span>}
    </div>
  );
}

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) redirect('/dashboard');

  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  const roleType = candidate.jobOpening?.roleType ?? null;

  const [screeningScript, screeningAnswers, interviewChecklist, checklistResults, callLogs, contractGuidelineRes] =
    await Promise.all([
      getActiveScreeningScript(roleType),
      getScreeningAnswers(id),
      getActiveInterviewChecklist(roleType),
      getChecklistResults(id),
      getCallLogs(id),
      roleType
        ? supabaseAdmin.from('ContractGuideline').select('content').eq('roleType', roleType).single()
        : Promise.resolve({ data: null }),
    ]);

  const contractGuideline = (contractGuidelineRes.data as { content?: string } | null)?.content ?? null;

  // Fetch appointment details
  let appointmentDetails: { date: string; startTime: string; endTime: string; location?: string | null; interviewer?: string | null } | null = null;
  if (['INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(candidate.status)) {
    const { data: apptData } = await supabaseAdmin
      .from('Appointment')
      .select('date, startTime, endTime, location, employeeProfileId')
      .like('title', `Sollicitatiegesprek: ${candidate.name.replace(/'/g, "''")}%`)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (apptData) {
      let interviewerName: string | null = null;
      if ((apptData as { employeeProfileId?: string }).employeeProfileId) {
        const { data: epRow } = await supabaseAdmin.from('EmployeeProfile').select('userId').eq('id', (apptData as { employeeProfileId: string }).employeeProfileId).maybeSingle();
        if (epRow) {
          const { data: userRow } = await supabaseAdmin.from('User').select('name').eq('id', (epRow as { userId: string }).userId).maybeSingle();
          interviewerName = (userRow as { name: string } | null)?.name ?? null;
        }
      }
      appointmentDetails = {
        date: (apptData as { date: string }).date,
        startTime: (apptData as { startTime: string }).startTime,
        endTime: (apptData as { endTime: string }).endTime,
        location: (apptData as { location?: string | null }).location,
        interviewer: interviewerName,
      };
    }
  }

  const consentDaysLeft = candidate.consentExpiresAt
    ? Math.ceil((new Date(candidate.consentExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const candidateName = `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim();
  const lastCall = callLogs[0] ?? null;
  const lastCallDays = lastCall ? Math.floor((Date.now() - new Date(lastCall.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : null;

  // Visibility flags
  const showScreening = ['PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(candidate.status);
  const showOutcome = ['PRE_SCREENING', 'SCREENING_DONE'].includes(candidate.status);
  const showChecklist = ['INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(candidate.status);
  const showInterviewOutcome = candidate.status === 'INTERVIEW';
  const showContractGuideline = ['INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(candidate.status) && !!contractGuideline;
  const showInterviewOutcomeNotes = ['INTERVIEW', 'RESERVE_BANK', 'HIRED', 'REJECTED'].includes(candidate.status);

  // Stage progress
  const currentStageIdx = STAGE_ORDER.indexOf(candidate.status);
  const progressPct = candidate.status === 'REJECTED' ? 0 : Math.round(((currentStageIdx + 1) / STAGE_ORDER.length) * 100);

  // Tab badges
  const screeningBadge = candidate.status === 'SCREENING_DONE' ? 1 : 0;
  const interviewBadge = candidate.status === 'INTERVIEW' ? 1 : 0;

  return (
    <div className="space-y-5 fade-in">
      {/* Back link */}
      <Link href="/dashboard/werving" className="inline-flex items-center gap-1.5 text-sm text-[#9ca3af] hover:text-white transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Terug naar Werving
      </Link>

      {/* ═══ COMPACT HEADER ═══ */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        {/* Row 1: Name + status + actions */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-white">{candidate.firstName} {candidate.lastName}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[candidate.status]}`}>
                {STATUS_LABELS[candidate.status]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {candidate.jobOpening?.roleType && (
                <span className="text-xs text-[#68b0a6]">{VACATURE_ROL_LABELS[candidate.jobOpening.roleType]}</span>
              )}
              {candidate.jobOpening?.title && (
                <span className="text-xs text-[#9ca3af]">· {candidate.jobOpening.title}</span>
              )}
              {candidate.leadSource && (
                <span className="text-xs text-[#6b7280]">· {candidate.leadSource}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CandidateDeleteClient candidateId={candidate.id} candidateName={candidateName} />
          </div>
        </div>

        {/* Row 2: Contact + meta info grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 lg:grid-cols-6 mb-4">
          <div>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wide">Telefoon</p>
            {candidate.phone ? (
              <a href={`tel:${candidate.phone}`} className="text-sm text-[#68b0a6] hover:underline">{candidate.phone}</a>
            ) : (
              <p className="text-sm text-[#9ca3af] italic">—</p>
            )}
          </div>
          <div>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wide">E-mail</p>
            <p className="text-sm text-[#e8e9ed] truncate">{candidate.email || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wide">Eigenaar</p>
            <CandidateAssignClient candidateId={candidate.id} assignedTo={candidate.assignedTo ?? null} />
          </div>
          <div>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wide">Laatste contact</p>
            <p className="text-sm text-[#e8e9ed]">
              {lastCallDays !== null ? (lastCallDays === 0 ? 'Vandaag' : `${lastCallDays}d geleden`) : <span className="text-[#f7a247]">Nooit</span>}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wide">Toegevoegd</p>
            <p className="text-sm text-[#e8e9ed]">
              {new Date(candidate.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
            </p>
          </div>
          {consentDaysLeft !== null && (
            <div>
              <p className="text-[10px] text-[#6b7280] uppercase tracking-wide">AVG consent</p>
              <p className={`text-sm font-medium ${consentDaysLeft <= 30 ? 'text-red-400' : consentDaysLeft <= 90 ? 'text-[#f7a247]' : 'text-[#68b0a6]'}`}>
                {consentDaysLeft > 0 ? `${consentDaysLeft} dagen` : 'Verlopen'}
              </p>
            </div>
          )}
        </div>

        {/* Row 3: Stage switcher */}
        <div className="pt-1 border-t border-[#363848]">
          <CandidateStageClient candidateId={candidate.id} currentStatus={candidate.status} candidateEmail={candidate.email ?? undefined} />
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <CandidateDetailTabs
        tabs={[
          {
            key: 'opvolging',
            label: 'Opvolging',
            icon: '📞',
            visible: true,
            content: (
              <>
                <CandidateCallLogClient
                  candidateId={candidate.id}
                  candidateStatus={candidate.status}
                  candidatePhone={candidate.phone ?? null}
                  candidateEmail={candidate.email ?? null}
                  initialCallLogs={callLogs}
                />

                {appointmentDetails && (
                  <div className="rounded-xl border border-blue-500/30 bg-[#252732] p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg">📅</span>
                      <h2 className="text-sm font-semibold text-white">Afspraakdetails</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-0.5">Datum</p>
                        <p className="text-sm text-white font-medium">
                          {new Date(appointmentDetails.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-0.5">Tijd</p>
                        <p className="text-sm text-white font-medium">
                          {new Date(appointmentDetails.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(appointmentDetails.endTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-0.5">Locatie</p>
                        <p className="text-sm text-white">{appointmentDetails.location || '—'}</p>
                      </div>
                      {appointmentDetails.interviewer && (
                        <div>
                          <p className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-0.5">Gesprek met</p>
                          <p className="text-sm text-white">{appointmentDetails.interviewer}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {showOutcome && (
                  <CandidateWorkflowOutcomeClient
                    candidateId={candidate.id}
                    candidateStatus={candidate.status}
                    candidateName={candidateName}
                  />
                )}

                <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
                  <h2 className="text-sm font-semibold text-white mb-4">Notities & CV</h2>
                  <CandidateNotesClient
                    candidateId={candidate.id}
                    initialNotes={candidate.candidateNotes ?? []}
                  />
                </div>
              </>
            ),
          },
          {
            key: 'screening',
            label: 'Screening',
            icon: '📋',
            badge: screeningBadge,
            visible: showScreening,
            content: (
              <>
                {screeningScript ? (
                  <div className="rounded-xl border border-[#68b0a6]/30 bg-[#252732] p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📋</span>
                      <div>
                        <h2 className="text-sm font-semibold text-white">Pre-screening vragen</h2>
                        <p className="text-xs text-[#9ca3af] mt-0.5">{screeningScript.name}</p>
                      </div>
                    </div>
                    <CandidateScreeningClient
                      candidateId={candidate.id}
                      script={screeningScript}
                      initialAnswers={screeningAnswers}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#363848] bg-[#252732] p-5">
                    <p className="text-xs text-[#9ca3af] text-center">
                      Geen actief screeningscript gevonden voor deze rol.
                    </p>
                  </div>
                )}
              </>
            ),
          },
          {
            key: 'gesprek',
            label: 'Gesprek',
            icon: '💬',
            badge: interviewBadge,
            visible: showChecklist || showInterviewOutcome || showInterviewOutcomeNotes,
            content: (
              <>
                {showChecklist && interviewChecklist && (
                  <div className="rounded-xl border border-purple-500/30 bg-[#252732] p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">✅</span>
                      <div>
                        <h2 className="text-sm font-semibold text-white">Sollicitatiegesprek checklist</h2>
                        <p className="text-xs text-[#9ca3af] mt-0.5">{interviewChecklist.name}</p>
                      </div>
                    </div>
                    <CandidateChecklistClient
                      candidateId={candidate.id}
                      checklist={interviewChecklist}
                      initialResults={checklistResults}
                    />
                  </div>
                )}

                {showContractGuideline && (
                  <ContractGuidelineBlock content={contractGuideline!} rolLabel={VACATURE_ROL_LABELS[roleType!]} />
                )}

                {showInterviewOutcome && (
                  <CandidateWorkflowOutcomeClient
                    candidateId={candidate.id}
                    candidateStatus={candidate.status}
                    candidateName={candidateName}
                  />
                )}

                {showInterviewOutcomeNotes && (
                  <CandidateInterviewOutcomeClient
                    candidateId={candidate.id}
                    initialOutcome={candidate.interviewOutcome}
                    initialOutcomeAt={candidate.interviewOutcomeAt}
                  />
                )}

                {candidate.interviewScores && candidate.interviewScores.length > 0 && (
                  <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
                    <h2 className="text-sm font-semibold text-white mb-4">Gespreksscores</h2>
                    <div className="space-y-4">
                      {candidate.interviewScores.map((score) => (
                        <div key={score.id} className="rounded-lg bg-[#1e2028] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-[#68b0a6]">{score.interviewer?.name ?? 'Onbekend'}</span>
                            <span className="text-xs text-[#9ca3af]">
                              {new Date(score.interviewDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {[
                              { label: 'Vakkennis', value: score.technicalSkills },
                              { label: 'Communicatie', value: score.communication },
                              { label: 'Cultuurfit', value: score.cultureFit },
                              { label: 'Betrouwbaarheid', value: score.reliability },
                              { label: 'Motivatie', value: score.motivation },
                              { label: 'Algehele indruk', value: score.overallImpression },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <p className="text-xs text-[#9ca3af] mb-1">{label}</p>
                                <ScoreDots score={value} />
                              </div>
                            ))}
                          </div>
                          {score.recommendation && (
                            <div className="mt-3">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                score.recommendation === 'HIRE' ? 'bg-green-500/10 text-green-400'
                                  : score.recommendation === 'RESERVE' ? 'bg-[#68b0a6]/10 text-[#68b0a6]'
                                  : 'bg-red-500/10 text-red-400'
                              }`}>
                                {score.recommendation === 'HIRE' ? 'Aanbevolen: Aannemen'
                                  : score.recommendation === 'RESERVE' ? 'Aanbevolen: Reserve bank'
                                  : 'Aanbevolen: Afwijzen'}
                              </span>
                            </div>
                          )}
                          {score.notes && (
                            <p className="mt-3 text-sm text-[#9ca3af] whitespace-pre-wrap">{score.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ),
          },
          {
            key: 'gegevens',
            label: 'Gegevens',
            icon: '👤',
            visible: true,
            content: (
              <CandidatePersonalDetailsClient candidate={candidate} />
            ),
          },
        ]}
      />
    </div>
  );
}
