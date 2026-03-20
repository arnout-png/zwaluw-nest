import { supabaseAdmin } from '@/lib/supabase';
import type {
  EmployeeWithProfile,
  Candidate,
  LeaveRequest,
  Appointment,
  Contract,
  DashboardStats,
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
      createdAt, updatedAt
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
      prescreeningToken, prescreeningExpiresAt, createdAt, updatedAt,
      candidateNotes:CandidateNote (
        id, candidateId, content, authorId, createdAt,
        author:User!CandidateNote_authorId_fkey (id, name, role)
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

export async function getContractsExpiringSoon(): Promise<Contract[]> {
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
      status, createdAt
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
  return (data as Contract[]) ?? [];
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
