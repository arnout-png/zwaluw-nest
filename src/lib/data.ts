import { supabaseAdmin } from '@/lib/supabase';
import type {
  EmployeeWithProfile,
  Candidate,
  CandidateNote,
  InterviewScore,
  LeaveRequest,
  Appointment,
  Contract,
  DashboardStats,
  ScreeningScript,
  ScreeningAnswer,
  InterviewChecklist,
  InterviewChecklistResult,
} from '@/types';

// ─── Employees ────────────────────────────────────────────────────────────────

export async function getEmployees(): Promise<EmployeeWithProfile[]> {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select(
      `
      id, email, name, role, isActive, createdAt, updatedAt,
      employeeProfile:EmployeeProfile!EmployeeProfile_userId_fkey (
        id, userId, dateOfBirth, address, city, postalCode, phonePersonal,
        bsn, emergencyName, emergencyPhone, startDate, department,
        leaveBalanceDays, leaveUsedDays, googleSyncEnabled, createdAt, updatedAt
      )
    `
    )
    .eq('isActive', true)
    .order('name');

  if (error) {
    console.error('getEmployees error:', error.message, error.code, error.details);
    return [];
  }
  return (data as unknown as EmployeeWithProfile[]) ?? [];
}

export async function getEmployee(id: string): Promise<EmployeeWithProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select(
      `
      id, email, name, role, isActive, createdAt, updatedAt,
      employeeProfile:EmployeeProfile!EmployeeProfile_userId_fkey (
        id, userId, dateOfBirth, address, city, postalCode, phonePersonal,
        bsn, emergencyName, emergencyPhone, startDate, department,
        leaveBalanceDays, leaveUsedDays, createdAt, updatedAt,
        contracts:Contract!Contract_employeeProfileId_fkey (
          id, employeeProfileId, contractType, startDate, endDate,
          probationEndDate, contractSequence, hoursPerWeek, salaryGross,
          status, createdAt, updatedAt
        ),
        leaveRequests:LeaveRequest!LeaveRequest_employeeProfileId_fkey (
          id, employeeProfileId, type, status, startDate, endDate,
          totalDays, reason, approvedById, respondedAt, createdAt
        ),
        dossierEntries:DossierEntry!DossierEntry_employeeProfileId_fkey (
          id, employeeProfileId, date, type, title, description,
          loggedById, createdAt,
          loggedBy:User!DossierEntry_loggedById_fkey (id, name, role)
        )
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('getEmployee error:', error.message, error.code);
    return null;
  }
  return data as unknown as EmployeeWithProfile;
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export async function getCandidates(status?: string): Promise<Candidate[]> {
  let query = supabaseAdmin
    .from('Candidate')
    .select(
      `id, status, name, email, phone, age, location, salaryExpectation,
       consentGiven, consentDate, consentExpiresAt, leadSource, leadCampaignId,
       assignedToId, createdAt, updatedAt`
    )
    .order('createdAt', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('getCandidates error:', error.message, error.code);
    return [];
  }

  const candidates = (data ?? []) as unknown as Candidate[];

  // Fetch assignedTo users separately (no FK constraints in public schema)
  const assignedToIds = [...new Set(candidates.map(c => c.assignedToId).filter((id): id is string => !!id))];
  let usersMap: Record<string, { id: string; name: string }> = {};
  if (assignedToIds.length > 0) {
    const { data: users } = await supabaseAdmin.from('User').select('id, name').in('id', assignedToIds);
    if (users) usersMap = Object.fromEntries((users as { id: string; name: string }[]).map(u => [u.id, u]));
  }

  return candidates.map(c =>
    splitCandidateName({ ...c, assignedTo: c.assignedToId ? usersMap[c.assignedToId] : undefined })
  );
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const { data, error } = await supabaseAdmin
    .from('Candidate')
    .select(
      `id, status, name, email, phone, age, location, livingSituation,
       partnerEmployment, currentJob, reasonForLeaving, salaryExpectation,
       consentGiven, consentDate, consentExpiresAt, leadSource, leadCampaignId,
       assignedToId, jobOpeningId, prescreeningToken, prescreeningExpiresAt, createdAt, updatedAt`
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('getCandidate error:', error.message, error.code);
    return null;
  }

  const candidate = data as unknown as Candidate;

  // Fetch all related data separately (no FK constraints in public schema)
  const [assignedToRes, jobOpeningRes, notesRes, scoresRes] = await Promise.all([
    candidate.assignedToId
      ? supabaseAdmin.from('User').select('id, name').eq('id', candidate.assignedToId).single()
      : { data: null },
    candidate.jobOpeningId
      ? supabaseAdmin.from('JobOpening').select('id, title, slug, roleType').eq('id', candidate.jobOpeningId).single()
      : { data: null },
    supabaseAdmin.from('CandidateNote').select('id, candidateId, content, authorId, createdAt').eq('candidateId', id).order('createdAt', { ascending: true }),
    supabaseAdmin.from('InterviewScore').select('id, candidateId, technicalSkills, communication, cultureFit, reliability, motivation, overallImpression, notes, recommendation, interviewerId, interviewDate, createdAt').eq('candidateId', id).order('createdAt', { ascending: true }),
  ]);

  const noteRows = (notesRes.data ?? []) as { id: string; candidateId: string; content: string; authorId: string; createdAt: string }[];
  const scoreRows = (scoresRes.data ?? []) as { id: string; interviewerId: string; [key: string]: unknown }[];

  // Resolve note authors and mentions
  let notesWithAuthors: CandidateNote[] = [];
  if (noteRows.length > 0) {
    const authorIds = [...new Set(noteRows.map(n => n.authorId))];
    const { data: authors } = await supabaseAdmin.from('User').select('id, name, role').in('id', authorIds);
    const authorsMap = Object.fromEntries((authors ?? []).map((u: { id: string; name: string; role: string }) => [u.id, u]));

    const noteIds = noteRows.map(n => n.id);
    const { data: mentions } = await supabaseAdmin.from('CandidateNoteMention').select('id, noteId, userId').in('noteId', noteIds);
    const mentionList = (mentions ?? []) as { id: string; noteId: string; userId: string }[];

    const mentionUserIds = [...new Set(mentionList.map(m => m.userId))];
    let mentionUsersMap: Record<string, { id: string; name: string }> = {};
    if (mentionUserIds.length > 0) {
      const { data: mUsers } = await supabaseAdmin.from('User').select('id, name').in('id', mentionUserIds);
      if (mUsers) mentionUsersMap = Object.fromEntries((mUsers as { id: string; name: string }[]).map(u => [u.id, u]));
    }

    notesWithAuthors = noteRows.map(n => ({
      ...n,
      author: n.authorId ? (authorsMap[n.authorId] as CandidateNote['author']) : undefined,
      mentions: mentionList.filter(m => m.noteId === n.id).map(m => ({ ...m, user: mentionUsersMap[m.userId] })),
    }));
  }

  // Resolve interviewers for scores
  let scores: InterviewScore[] = [];
  if (scoreRows.length > 0) {
    const interviewerIds = [...new Set(scoreRows.map(s => s.interviewerId as string))];
    const { data: interviewers } = await supabaseAdmin.from('User').select('id, name, role').in('id', interviewerIds);
    const interviewersMap = Object.fromEntries((interviewers ?? []).map((u: { id: string; name: string; role: string }) => [u.id, u]));
    scores = scoreRows.map(s => ({ ...s, interviewer: s.interviewerId ? interviewersMap[s.interviewerId as string] : undefined })) as unknown as InterviewScore[];
  }

  return splitCandidateName({
    ...candidate,
    assignedTo: (assignedToRes.data ?? undefined) as Candidate['assignedTo'],
    jobOpening: (jobOpeningRes.data ?? undefined) as Candidate['jobOpening'],
    candidateNotes: notesWithAuthors,
    interviewScores: scores,
  });
}

// Utility: split DB `name` → UI `firstName` / `lastName`
export function splitCandidateName(c: Candidate): Candidate {
  if (c.name && !c.firstName) {
    const parts = c.name.split(' ');
    c.firstName = parts[0] ?? '';
    c.lastName = (parts.slice(1).join(' ') || parts[0]) ?? '';
  }
  return c;
}

// ─── Leave requests ───────────────────────────────────────────────────────────

export async function getLeaveRequests(employeeProfileId?: string): Promise<LeaveRequest[]> {
  let query = supabaseAdmin
    .from('LeaveRequest')
    .select(`id, employeeProfileId, type, status, startDate, endDate,
             totalDays, reason, approvedById, respondedAt, createdAt`)
    .order('createdAt', { ascending: false });

  if (employeeProfileId) query = query.eq('employeeProfileId', employeeProfileId);

  const { data, error } = await query;
  if (error) {
    console.error('getLeaveRequests error:', error.message, error.code);
    return [];
  }

  const requests = (data ?? []) as unknown as LeaveRequest[];

  // Fetch employee profiles and approvedBy users separately
  const profileIds = [...new Set(requests.map(r => r.employeeProfileId))];
  const approvedByIds = [...new Set(requests.map(r => r.approvedById).filter((id): id is string => !!id))];

  const [profilesRes, approvedByRes] = await Promise.all([
    supabaseAdmin.from('EmployeeProfile').select('id, userId').in('id', profileIds),
    approvedByIds.length > 0
      ? supabaseAdmin.from('User').select('id, name').in('id', approvedByIds)
      : { data: [] },
  ]);

  const profileList = (profilesRes.data ?? []) as { id: string; userId: string }[];
  const userIds = [...new Set(profileList.map(p => p.userId))];
  const { data: usersData } = userIds.length > 0
    ? await supabaseAdmin.from('User').select('id, name, email, role').in('id', userIds)
    : { data: [] };

  const usersMap = Object.fromEntries(((usersData ?? []) as { id: string; name: string; email: string; role: string }[]).map(u => [u.id, u]));
  const profilesMap = Object.fromEntries(profileList.map(p => [p.id, { userId: p.userId, user: usersMap[p.userId] }]));
  const approvedByMap = Object.fromEntries(((approvedByRes.data ?? []) as { id: string; name: string }[]).map(u => [u.id, u]));

  return requests.map(r => ({
    ...r,
    employeeProfile: r.employeeProfileId ? profilesMap[r.employeeProfileId] : undefined,
    approvedBy: r.approvedById ? approvedByMap[r.approvedById] : undefined,
  })) as unknown as LeaveRequest[];
}

export async function getPendingLeaveRequests(): Promise<LeaveRequest[]> {
  const { data, error } = await supabaseAdmin
    .from('LeaveRequest')
    .select(`id, employeeProfileId, type, status, startDate, endDate, totalDays, reason, createdAt`)
    .eq('status', 'PENDING')
    .order('createdAt', { ascending: true });

  if (error) {
    console.error('getPendingLeaveRequests error:', error.message, error.code);
    return [];
  }

  const requests = (data ?? []) as unknown as LeaveRequest[];
  const profileIds = [...new Set(requests.map(r => r.employeeProfileId))];
  if (profileIds.length === 0) return requests;

  const { data: profiles } = await supabaseAdmin.from('EmployeeProfile').select('id, userId').in('id', profileIds);
  const profileList = (profiles ?? []) as { id: string; userId: string }[];
  const userIds = [...new Set(profileList.map(p => p.userId))];
  const { data: usersData } = userIds.length > 0
    ? await supabaseAdmin.from('User').select('id, name, email, role').in('id', userIds)
    : { data: [] };

  const usersMap = Object.fromEntries(((usersData ?? []) as { id: string; name: string; email: string; role: string }[]).map(u => [u.id, u]));
  const profilesMap = Object.fromEntries(profileList.map(p => [p.id, { userId: p.userId, user: usersMap[p.userId] }]));

  return requests.map(r => ({ ...r, employeeProfile: r.employeeProfileId ? profilesMap[r.employeeProfileId] : undefined })) as unknown as LeaveRequest[];
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export async function getAppointments(
  date?: string,
  employeeProfileId?: string
): Promise<Appointment[]> {
  let query = supabaseAdmin
    .from('Appointment')
    .select(`id, employeeProfileId, customerId, title, description, date,
             startTime, endTime, location, status, saleValue, createdAt, updatedAt`)
    .order('startTime');

  if (date) {
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    query = query.gte('startTime', start).lte('startTime', end);
  }

  if (employeeProfileId) {
    query = query.eq('employeeProfileId', employeeProfileId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('getAppointments error:', error.message, error.code);
    return [];
  }
  return (data as unknown as Appointment[]) ?? [];
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export type ContractWithEmployee = Contract & {
  employeeProfile?: {
    userId: string;
    user?: { id: string; name: string };
  };
};

export async function getContractsExpiringSoon(): Promise<ContractWithEmployee[]> {
  const today = new Date();
  const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const todayStr = today.toISOString().split('T')[0];
  const in60Str = in60Days.toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('Contract')
    .select(`id, employeeProfileId, contractType, startDate, endDate,
             probationEndDate, contractSequence, hoursPerWeek, salaryGross, status, createdAt`)
    .eq('status', 'ACTIVE')
    .not('endDate', 'is', null)
    .gte('endDate', todayStr)
    .lte('endDate', in60Str)
    .order('endDate');

  if (error) {
    console.error('getContractsExpiringSoon error:', error.message, error.code);
    return [];
  }

  const contracts = (data ?? []) as unknown as ContractWithEmployee[];
  const profileIds = [...new Set(contracts.map(c => c.employeeProfileId))];
  if (profileIds.length === 0) return contracts;

  const { data: profiles } = await supabaseAdmin.from('EmployeeProfile').select('id, userId').in('id', profileIds);
  const profileList = (profiles ?? []) as { id: string; userId: string }[];
  const userIds = [...new Set(profileList.map(p => p.userId))];
  const { data: usersData } = userIds.length > 0
    ? await supabaseAdmin.from('User').select('id, name').in('id', userIds)
    : { data: [] };

  const usersMap = Object.fromEntries(((usersData ?? []) as { id: string; name: string }[]).map(u => [u.id, u]));
  const profilesMap = Object.fromEntries(profileList.map(p => [p.id, { userId: p.userId, user: usersMap[p.userId] }]));

  return contracts.map(c => ({ ...c, employeeProfile: c.employeeProfileId ? profilesMap[c.employeeProfileId] : undefined }));
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [employees, expiringContracts, pendingLeave, candidates] = await Promise.all([
    supabaseAdmin
      .from('User')
      .select('id', { count: 'exact', head: true })
      .eq('isActive', true),
    supabaseAdmin
      .from('Contract')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .not('endDate', 'is', null)
      .lte(
        'endDate',
        new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      )
      .gte('endDate', new Date().toISOString().split('T')[0]),
    supabaseAdmin
      .from('LeaveRequest')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING'),
    supabaseAdmin
      .from('Candidate')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("HIRED","REJECTED")'),
  ]);

  return {
    activeEmployees: employees.count ?? 0,
    expiringContracts: expiringContracts.count ?? 0,
    pendingLeave: pendingLeave.count ?? 0,
    openCandidates: candidates.count ?? 0,
  };
}

// ─── Screening Scripts ────────────────────────────────────────────────────────

export async function getActiveScreeningScript(roleType?: string | null): Promise<ScreeningScript | null> {
  const SELECT = `
    id, name, description, isActive, roleType, createdById, createdAt, updatedAt,
    questions:ScreeningQuestion (
      id, scriptId, question, placeholder, required, order
    )
  `;

  // 1. Try role-specific script first
  if (roleType) {
    const { data: roleData } = await supabaseAdmin
      .from('ScreeningScript')
      .select(SELECT)
      .eq('isActive', true)
      .eq('roleType', roleType)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roleData) {
      const script = roleData as unknown as ScreeningScript;
      if (script?.questions) script.questions = [...script.questions].sort((a, b) => a.order - b.order);
      return script;
    }
  }

  // 2. Fallback: generic script (no roleType)
  const { data, error } = await supabaseAdmin
    .from('ScreeningScript')
    .select(SELECT)
    .eq('isActive', true)
    .is('roleType', null)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const script = data as unknown as ScreeningScript;
  if (script?.questions) script.questions = [...script.questions].sort((a, b) => a.order - b.order);
  return script;
}

export async function getAllScreeningScripts(): Promise<ScreeningScript[]> {
  const { data: scripts, error } = await supabaseAdmin
    .from('ScreeningScript')
    .select('id, name, description, isActive, roleType, createdById, createdAt, updatedAt')
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('getAllScreeningScripts error:', error.message);
    return [];
  }
  if (!scripts?.length) return [];

  const ids = scripts.map(s => s.id);
  const { data: questions } = await supabaseAdmin
    .from('ScreeningQuestion')
    .select('id, scriptId, question, placeholder, required, order')
    .in('scriptId', ids);

  return (scripts as unknown as ScreeningScript[]).map(s => ({
    ...s,
    questions: ((questions ?? []) as unknown as { scriptId: string; order: number }[])
      .filter(q => q.scriptId === s.id)
      .sort((a, b) => a.order - b.order) as ScreeningScript['questions'],
  }));
}

export async function getScreeningAnswers(candidateId: string): Promise<ScreeningAnswer[]> {
  const { data, error } = await supabaseAdmin
    .from('ScreeningAnswer')
    .select(
      `
      id, questionId, candidateId, answer, answeredById, createdAt, updatedAt,
      answeredBy:User!ScreeningAnswer_answeredById_fkey (id, name),
      question:ScreeningQuestion!ScreeningAnswer_questionId_fkey (id, question, order)
    `
    )
    .eq('candidateId', candidateId);

  if (error) {
    console.error('getScreeningAnswers error:', error.message);
    return [];
  }
  return (data as unknown as ScreeningAnswer[]) ?? [];
}

// ─── Interview Checklists ─────────────────────────────────────────────────────

export async function getActiveInterviewChecklist(roleType?: string | null): Promise<InterviewChecklist | null> {
  const SELECT = `
    id, name, description, isActive, roleType, createdById, createdAt, updatedAt,
    items:InterviewChecklistItem (
      id, checklistId, label, description, order
    )
  `;

  // 1. Try role-specific checklist first
  if (roleType) {
    const { data: roleData } = await supabaseAdmin
      .from('InterviewChecklist')
      .select(SELECT)
      .eq('isActive', true)
      .eq('roleType', roleType)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roleData) {
      const checklist = roleData as unknown as InterviewChecklist;
      if (checklist?.items) checklist.items = [...checklist.items].sort((a, b) => a.order - b.order);
      return checklist;
    }
  }

  // 2. Fallback: generic checklist (no roleType)
  const { data, error } = await supabaseAdmin
    .from('InterviewChecklist')
    .select(SELECT)
    .eq('isActive', true)
    .is('roleType', null)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const checklist = data as unknown as InterviewChecklist;
  if (checklist?.items) checklist.items = [...checklist.items].sort((a, b) => a.order - b.order);
  return checklist;
}

export async function getAllInterviewChecklists(): Promise<InterviewChecklist[]> {
  const { data: checklists, error } = await supabaseAdmin
    .from('InterviewChecklist')
    .select('id, name, description, isActive, roleType, createdById, createdAt, updatedAt')
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('getAllInterviewChecklists error:', error.message);
    return [];
  }
  if (!checklists?.length) return [];

  const ids = checklists.map(c => c.id);
  const { data: items } = await supabaseAdmin
    .from('InterviewChecklistItem')
    .select('id, checklistId, label, description, order')
    .in('checklistId', ids);

  return (checklists as unknown as InterviewChecklist[]).map(c => ({
    ...c,
    items: ((items ?? []) as unknown as { checklistId: string; order: number }[])
      .filter(i => i.checklistId === c.id)
      .sort((a, b) => a.order - b.order) as InterviewChecklist['items'],
  }));
}

export async function getChecklistResults(candidateId: string): Promise<InterviewChecklistResult[]> {
  const { data, error } = await supabaseAdmin
    .from('InterviewChecklistResult')
    .select(
      `
      id, itemId, candidateId, checked, checkedById, checkedAt,
      checkedBy:User!InterviewChecklistResult_checkedById_fkey (id, name)
    `
    )
    .eq('candidateId', candidateId);

  if (error) {
    console.error('getChecklistResults error:', error.message);
    return [];
  }
  return (data as unknown as InterviewChecklistResult[]) ?? [];
}

// ─── Recruitment summary ──────────────────────────────────────────────────────

export interface RecruitmentSummary {
  totalActive: number;
  staleCount: number;
  interviewsThisWeek: number;
  pipelineCounts: Record<string, number>;
}

export async function getRecruitmentSummary(): Promise<RecruitmentSummary> {
  const activeStatuses = ['NEW_LEAD', 'PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW', 'RESERVE_BANK'];

  const { data: candidates } = await supabaseAdmin
    .from('Candidate')
    .select('status, stageUpdatedAt, updatedAt')
    .in('status', activeStatuses);

  const all = candidates ?? [];
  const totalActive = all.length;

  // Pipeline counts per stage
  const pipelineCounts: Record<string, number> = {};
  for (const s of activeStatuses) {
    pipelineCounts[s] = all.filter((c: Record<string, unknown>) => c.status === s).length;
  }

  // Stale: fetch thresholds from AppSetting
  const stageKeys = [
    'STAGE_ALERT_NEW_LEAD',
    'STAGE_ALERT_PRE_SCREENING',
    'STAGE_ALERT_SCREENING_DONE',
    'STAGE_ALERT_INTERVIEW',
    'STAGE_ALERT_RESERVE_BANK',
  ];
  const stageStatusMap: Record<string, string> = {
    STAGE_ALERT_NEW_LEAD: 'NEW_LEAD',
    STAGE_ALERT_PRE_SCREENING: 'PRE_SCREENING',
    STAGE_ALERT_SCREENING_DONE: 'SCREENING_DONE',
    STAGE_ALERT_INTERVIEW: 'INTERVIEW',
    STAGE_ALERT_RESERVE_BANK: 'RESERVE_BANK',
  };
  const defaults: Record<string, number> = {
    STAGE_ALERT_NEW_LEAD: 3,
    STAGE_ALERT_PRE_SCREENING: 5,
    STAGE_ALERT_SCREENING_DONE: 3,
    STAGE_ALERT_INTERVIEW: 7,
    STAGE_ALERT_RESERVE_BANK: 30,
  };

  const { data: settingRows } = await supabaseAdmin
    .from('AppSetting')
    .select('key, value')
    .in('key', stageKeys);

  const thresholds: Record<string, number> = { ...defaults };
  for (const row of settingRows ?? []) {
    thresholds[row.key] = Number(row.value) || 0;
  }

  const now = Date.now();
  let staleCount = 0;
  for (const key of stageKeys) {
    const days = thresholds[key];
    if (!days) continue;
    const status = stageStatusMap[key];
    const cutoffMs = days * 24 * 60 * 60 * 1000;
    staleCount += all.filter((c: Record<string, unknown>) => {
      if (c.status !== status) return false;
      const since = (c.stageUpdatedAt as string) ?? (c.updatedAt as string);
      return since && now - new Date(since).getTime() > cutoffMs;
    }).length;
  }

  // Interviews this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const interviewsThisWeek = all.filter((c: Record<string, unknown>) => {
    if (c.status !== 'INTERVIEW') return false;
    const since = (c.stageUpdatedAt as string) ?? (c.updatedAt as string);
    return since && new Date(since) >= weekStart;
  }).length;

  return { totalActive, staleCount, interviewsThisWeek, pipelineCounts };
}
