import { supabaseAdmin } from '@/lib/supabase';
import type {
  EmployeeWithProfile,
  Candidate,
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
      `
      id, status, name, email, phone, age, location, salaryExpectation,
      consentGiven, consentDate, consentExpiresAt, leadSource, leadCampaignId,
      assignedToId, createdAt, updatedAt,
      assignedTo:User!Candidate_assignedToId_fkey (id, name)
    `
    )
    .order('createdAt', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('getCandidates error:', error.message, error.code);
    return [];
  }
  // Split name into firstName / lastName for UI compatibility
  return ((data as unknown as Candidate[]) ?? []).map(splitCandidateName);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const { data, error } = await supabaseAdmin
    .from('Candidate')
    .select(
      `
      id, status, name, email, phone, age, location, livingSituation,
      partnerEmployment, currentJob, reasonForLeaving, salaryExpectation,
      consentGiven, consentDate, consentExpiresAt, leadSource, leadCampaignId,
      assignedToId, prescreeningToken, prescreeningExpiresAt, createdAt, updatedAt,
      assignedTo:User!Candidate_assignedToId_fkey (id, name),
      jobOpening:JobOpening!Candidate_jobOpeningId_fkey (id, title, slug, roleType),
      candidateNotes:CandidateNote (
        id, candidateId, content, authorId, createdAt,
        author:User!CandidateNote_authorId_fkey (id, name, role),
        mentions:CandidateNoteMention (
          id, noteId, userId,
          user:User!CandidateNoteMention_userId_fkey (id, name)
        )
      ),
      interviewScores:InterviewScore (
        id, candidateId, technicalSkills, communication, cultureFit,
        reliability, motivation, overallImpression, notes, recommendation,
        interviewerId, interviewDate, createdAt,
        interviewer:User!InterviewScore_interviewerId_fkey (id, name, role)
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('getCandidate error:', error.message, error.code);
    return null;
  }
  return splitCandidateName(data as unknown as Candidate);
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
    .select(
      `
      id, employeeProfileId, type, status, startDate, endDate,
      totalDays, reason, approvedById, respondedAt, createdAt,
      employeeProfile:EmployeeProfile!LeaveRequest_employeeProfileId_fkey (
        userId,
        user:User!EmployeeProfile_userId_fkey (id, name, email, role)
      ),
      approvedBy:User!LeaveRequest_approvedById_fkey (id, name)
    `
    )
    .order('createdAt', { ascending: false });

  if (employeeProfileId) {
    query = query.eq('employeeProfileId', employeeProfileId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('getLeaveRequests error:', error.message, error.code);
    return [];
  }
  return (data as unknown as LeaveRequest[]) ?? [];
}

export async function getPendingLeaveRequests(): Promise<LeaveRequest[]> {
  const { data, error } = await supabaseAdmin
    .from('LeaveRequest')
    .select(
      `
      id, employeeProfileId, type, status, startDate, endDate,
      totalDays, reason, createdAt,
      employeeProfile:EmployeeProfile!LeaveRequest_employeeProfileId_fkey (
        userId,
        user:User!EmployeeProfile_userId_fkey (id, name, email, role)
      )
    `
    )
    .eq('status', 'PENDING')
    .order('createdAt', { ascending: true });

  if (error) {
    console.error('getPendingLeaveRequests error:', error.message, error.code);
    return [];
  }
  return (data as unknown as LeaveRequest[]) ?? [];
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export async function getAppointments(
  date?: string,
  employeeProfileId?: string
): Promise<Appointment[]> {
  let query = supabaseAdmin
    .from('Appointment')
    .select(
      `
      id, employeeProfileId, customerId, title, description, date,
      startTime, endTime, location, status, saleValue, createdAt, updatedAt,
      customer:Customer (id, name, phone, address, city),
      employeeProfile:EmployeeProfile!Appointment_employeeProfileId_fkey (
        id, userId,
        user:User!EmployeeProfile_userId_fkey (id, name, role)
      )
    `
    )
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
    .select(
      `
      id, employeeProfileId, contractType, startDate, endDate,
      probationEndDate, contractSequence, hoursPerWeek, salaryGross,
      status, createdAt,
      employeeProfile:EmployeeProfile!Contract_employeeProfileId_fkey (
        userId,
        user:User!EmployeeProfile_userId_fkey (id, name)
      )
    `
    )
    .eq('status', 'ACTIVE')
    .not('endDate', 'is', null)
    .gte('endDate', todayStr)
    .lte('endDate', in60Str)
    .order('endDate');

  if (error) {
    console.error('getContractsExpiringSoon error:', error.message, error.code);
    return [];
  }
  return (data as unknown as ContractWithEmployee[]) ?? [];
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
  const { data, error } = await supabaseAdmin
    .from('ScreeningScript')
    .select(
      `
      id, name, description, isActive, createdById, createdAt, updatedAt,
      createdBy:User!ScreeningScript_createdById_fkey (id, name),
      questions:ScreeningQuestion (
        id, scriptId, question, placeholder, required, order
      )
    `
    )
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('getAllScreeningScripts error:', error.message);
    return [];
  }
  return ((data as unknown as ScreeningScript[]) ?? []).map(s => ({
    ...s,
    questions: (s.questions ?? []).sort((a, b) => a.order - b.order),
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
  const { data, error } = await supabaseAdmin
    .from('InterviewChecklist')
    .select(
      `
      id, name, description, isActive, createdById, createdAt, updatedAt,
      createdBy:User!InterviewChecklist_createdById_fkey (id, name),
      items:InterviewChecklistItem (
        id, checklistId, label, description, order
      )
    `
    )
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('getAllInterviewChecklists error:', error.message);
    return [];
  }
  return ((data as unknown as InterviewChecklist[]) ?? []).map(c => ({
    ...c,
    items: (c.items ?? []).sort((a, b) => a.order - b.order),
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
