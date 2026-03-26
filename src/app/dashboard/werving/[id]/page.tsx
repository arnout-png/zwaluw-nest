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
  PRE_SCREENING: 'Pre-screening',
  SCREENING_DONE: 'Screening klaar',
  INTERVIEW: 'Sollicitatiegesprek',
  RESERVE_BANK: 'Reserve Bank',
  HIRED: 'Aangenomen',
  REJECTED: 'Afgewezen',
};

const STATUS_COLORS: Record<CandidateStatus, string> = {
  NEW_LEAD: 'bg-blue-500/10 text-blue-400',
  PRE_SCREENING: 'bg-yellow-500/10 text-yellow-400',
  SCREENING_DONE: 'bg-yellow-500/10 text-yellow-300',
  INTERVIEW: 'bg-purple-500/10 text-purple-400',
  RESERVE_BANK: 'bg-[#68b0a6]/10 text-[#68b0a6]',
  HIRED: 'bg-green-500/10 text-green-400',
  REJECTED: 'bg-red-500/10 text-red-400',
};

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
        <svg
          className="h-4 w-4 text-[#9ca3af] transition-transform group-open:rotate-180"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-5 pb-5 border-t border-[#363848] pt-4">
        <div className="prose prose-sm prose-invert max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-[#e8e9ed] font-sans leading-relaxed">{content}</pre>
        </div>
      </div>
    </details>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[#9ca3af] mb-0.5">{label}</dt>
      <dd className="text-sm text-[#e8e9ed]">{value ?? <span className="text-[#9ca3af] italic">—</span>}</dd>
    </div>
  );
}

function ScoreDots({ score }: { score?: number | null }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${
            score != null && i <= score ? 'bg-[#68b0a6]' : 'bg-[#363848]'
          }`}
        />
      ))}
      {score != null && <span className="text-xs text-[#9ca3af] ml-1">{score}/5</span>}
    </div>
  );
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') redirect('/dashboard');

  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  const roleType = candidate.jobOpening?.roleType ?? null;

  // Always fetch all workflow data — server renders sections based on status
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

  const consentDaysLeft = candidate.consentExpiresAt
    ? Math.ceil(
        (new Date(candidate.consentExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const candidateName = `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim();

  // Visibility flags — server-driven, no client state needed
  const showScreening = ['PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(candidate.status);
  const showOutcome = ['PRE_SCREENING', 'SCREENING_DONE'].includes(candidate.status);
  const showChecklist = ['INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(candidate.status);
  const showInterviewOutcome = candidate.status === 'INTERVIEW';
  const showContractGuideline = ['INTERVIEW', 'RESERVE_BANK', 'HIRED'].includes(candidate.status) && !!contractGuideline;
  const showInterviewOutcomeNotes = ['INTERVIEW', 'RESERVE_BANK', 'HIRED', 'REJECTED'].includes(candidate.status);

  return (
    <div className="space-y-6 fade-in">
      {/* Back link */}
      <Link
        href="/dashboard/werving"
        className="inline-flex items-center gap-1.5 text-sm text-[#9ca3af] hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Terug naar Werving
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {candidate.firstName} {candidate.lastName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[candidate.status]}`}>
              {STATUS_LABELS[candidate.status]}
            </span>
            {candidate.jobOpening?.roleType && (
              <span className="rounded-full bg-[#68b0a6]/10 px-2.5 py-0.5 text-xs text-[#68b0a6]">
                {VACATURE_ROL_LABELS[candidate.jobOpening.roleType]}
              </span>
            )}
            {candidate.leadSource && (
              <span className="rounded-full bg-[#363848] px-2.5 py-0.5 text-xs text-[#9ca3af]">
                {candidate.leadSource}
              </span>
            )}
            {consentDaysLeft !== null && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                consentDaysLeft <= 30
                  ? 'bg-red-500/10 text-red-400'
                  : consentDaysLeft <= 90
                  ? 'bg-[#f7a247]/10 text-[#f7a247]'
                  : 'bg-[#68b0a6]/10 text-[#68b0a6]'
              }`}>
                AVG {consentDaysLeft > 0 ? `${consentDaysLeft}d` : 'Verlopen'}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-[#9ca3af]">
          Toegevoegd {new Date(candidate.createdAt).toLocaleDateString('nl-NL', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </div>
      </div>

      {/* Stage voortgang + Toewijzing */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Stage voortgang</h2>
          <CandidateStageClient candidateId={candidate.id} currentStatus={candidate.status} candidateEmail={candidate.email ?? undefined} />
        </div>
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Toegewezen aan</h2>
          <CandidateAssignClient
            candidateId={candidate.id}
            assignedTo={candidate.assignedTo ?? null}
          />
        </div>
      </div>

      {/* Bel opvolging */}
      <CandidateCallLogClient
        candidateId={candidate.id}
        candidateStatus={candidate.status}
        candidatePhone={candidate.phone ?? null}
        initialCallLogs={callLogs}
      />

      {/* Pre-screening vragen — server-rendered when status ≥ PRE_SCREENING */}
      {showScreening && screeningScript && (
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
      )}

      {showScreening && !screeningScript && (
        <div className="rounded-xl border border-dashed border-[#363848] bg-[#252732] p-5">
          <p className="text-xs text-[#9ca3af] text-center">
            Geen actief screeningscript gevonden voor deze rol.{' '}
            {!candidate.jobOpening
              ? 'Wijs eerst een vacature toe aan de kandidaat, of maak een generiek script aan via Instellingen → Screening.'
              : 'Maak een screeningscript aan voor deze rol via Instellingen → Screening.'}
          </p>
        </div>
      )}

      {/* Uitkomst pre-screening — Geen interesse / Afspraak plannen */}
      {showOutcome && (
        <CandidateWorkflowOutcomeClient
          candidateId={candidate.id}
          candidateStatus={candidate.status}
          candidateName={candidateName}
        />
      )}

      {/* Interview checklist — server-rendered when status ≥ INTERVIEW */}
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

      {showChecklist && !interviewChecklist && (
        <div className="rounded-xl border border-dashed border-[#363848] bg-[#252732] p-5">
          <p className="text-xs text-[#9ca3af] text-center">
            Geen actieve interview checklist voor deze rol. Voeg er een toe via Instellingen.
          </p>
        </div>
      )}

      {/* Contract richtlijnen — toon bij INTERVIEW en later */}
      {showContractGuideline && (
        <ContractGuidelineBlock content={contractGuideline!} rolLabel={VACATURE_ROL_LABELS[roleType!]} />
      )}

      {/* Uitkomst sollicitatiegesprek — Aangenomen / Reserve bank / Afwijzen */}
      {showInterviewOutcome && (
        <CandidateWorkflowOutcomeClient
          candidateId={candidate.id}
          candidateStatus={candidate.status}
          candidateName={candidateName}
        />
      )}

      {/* Gespreksuitkomst notities — later vastleggen */}
      {showInterviewOutcomeNotes && (
        <CandidateInterviewOutcomeClient
          candidateId={candidate.id}
          initialOutcome={candidate.interviewOutcome}
          initialOutcomeAt={candidate.interviewOutcomeAt}
        />
      )}

      {/* Persoonlijke gegevens — bewerkbaar */}
      <CandidatePersonalDetailsClient candidate={candidate} />

      {/* Gespreksscores */}
      {candidate.interviewScores && candidate.interviewScores.length > 0 && (
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Gespreksscores</h2>
          <div className="space-y-4">
            {candidate.interviewScores.map((score) => (
              <div key={score.id} className="rounded-lg bg-[#1e2028] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[#68b0a6]">
                    {score.interviewer?.name ?? 'Onbekend'}
                  </span>
                  <span className="text-xs text-[#9ca3af]">
                    {new Date(score.interviewDate).toLocaleDateString('nl-NL', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
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
                      score.recommendation === 'HIRE'
                        ? 'bg-green-500/10 text-green-400'
                        : score.recommendation === 'RESERVE'
                        ? 'bg-[#68b0a6]/10 text-[#68b0a6]'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {score.recommendation === 'HIRE'
                        ? 'Aanbevolen: Aannemen'
                        : score.recommendation === 'RESERVE'
                        ? 'Aanbevolen: Reserve bank'
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

      {/* Notities */}
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Notities & CV</h2>
        <CandidateNotesClient
          candidateId={candidate.id}
          initialNotes={candidate.candidateNotes ?? []}
        />
      </div>
    </div>
  );
}
