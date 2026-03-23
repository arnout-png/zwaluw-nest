// ─── Enums / string unions ────────────────────────────────────────────────────

export type Role =
  | 'ADMIN'
  | 'PLANNER'
  | 'ADVISEUR'
  | 'MONTEUR'
  | 'CALLCENTER'
  | 'BACKOFFICE'
  | 'WAREHOUSE';

export type ContractStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'PENDING'
  | 'TERMINATED';

export type CandidateStatus =
  | 'NEW_LEAD'
  | 'PRE_SCREENING'
  | 'SCREENING_DONE'
  | 'INTERVIEW'
  | 'RESERVE_BANK'
  | 'HIRED'
  | 'REJECTED';

export type LeaveType =
  | 'VACATION'
  | 'SICK'
  | 'PERSONAL'
  | 'UNPAID'
  | 'SPECIAL';

export type LeaveStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type DossierType =
  | 'NOTE'
  | 'WARNING'
  | 'COMPLIMENT'
  | 'INCIDENT'
  | 'PERFORMANCE'
  | 'OTHER';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type NotificationType =
  | 'LEAVE_REQUEST'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'CONTRACT_EXPIRING'
  | 'SICK_REPORT'
  | 'NEW_CANDIDATE'
  | 'MENTION'
  | 'SYSTEM'
  | 'CANDIDATE_STAGE_ALERT';

export type LeadSource =
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'INDEED'
  | 'REFERRAL'
  | 'MANUAL'
  | 'GOOGLE'
  | 'OTHER';

export type VacatureRol =
  | 'MONTEUR'
  | 'ADVISEUR'
  | 'BINNENDIENST_TECHNISCH'
  | 'BINNENDIENST_CALLCENTER'
  | 'WAREHOUSE'
  | 'BACKOFFICE';

export const VACATURE_ROL_LABELS: Record<VacatureRol, string> = {
  MONTEUR:                 'Installatiemonteur',
  ADVISEUR:                'Sales adviseur',
  BINNENDIENST_TECHNISCH:  'Technische binnendienst',
  BINNENDIENST_CALLCENTER: 'Callcenter medewerker',
  WAREHOUSE:               'Magazijnmedewerker',
  BACKOFFICE:              'Backoffice medewerker',
};

// ─── Core entities — matching actual DB column names ──────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeProfile {
  id: string;
  userId: string;
  candidateId?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phonePersonal?: string;
  bsn?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  startDate?: string;
  department?: string;
  leaveBalanceDays: number;
  leaveUsedDays: number;
  googleRefreshToken?: string;
  googleCalendarId?: string;
  googleSyncEnabled?: boolean;
  nmbrsEmployeeId?: string;
  nmbrsCompanyId?: number;
  nmbrsLastSync?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  // Nested relations (when fetched via join)
  contracts?: Contract[];
  leaveRequests?: LeaveRequest[];
  dossierEntries?: DossierEntry[];
}

export interface Contract {
  id: string;
  employeeProfileId: string;
  startDate: string;
  endDate?: string;
  probationEndDate?: string;
  contractType: string;
  contractSequence: number;
  hoursPerWeek?: number;
  salaryGross?: number;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  status: CandidateStatus;
  name: string;
  // Convenience split — populated by API layer
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  age?: number;
  location?: string;
  livingSituation?: string;
  partnerEmployment?: string;
  currentJob?: string;
  reasonForLeaving?: string;
  salaryExpectation?: string;
  consentGiven: boolean;
  consentDate?: string;
  consentExpiresAt?: string;
  dataDeletedAt?: string;
  leadSource?: string;
  leadCampaignId?: string;
  prescreeningToken?: string;
  prescreeningExpiresAt?: string;
  assignedToId?: string;
  assignedTo?: Pick<User, 'id' | 'name'>;
  stageUpdatedAt?: string;
  jobOpeningId?: string;
  jobOpening?: Pick<JobOpening, 'id' | 'title' | 'slug' | 'roleType'>;
  linkedinUrl?: string;
  cvUrl?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  rejectionReason?: string;
  rejectionEmailSent?: boolean;
  createdAt: string;
  updatedAt: string;
  candidateNotes?: CandidateNote[];
  interviewScores?: InterviewScore[];
}

export interface JobOpening {
  id: string;
  slug: string;
  title: string;
  description: string;
  requirements?: string;
  location?: string;
  hoursPerWeek?: string;
  salaryRange?: string;
  imageUrl?: string;
  roleType?: VacatureRol;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count?: { candidates: number };
}

export interface CandidateNote {
  id: string;
  candidateId: string;
  content: string;
  authorId: string;
  createdAt: string;
  author?: Pick<User, 'id' | 'name' | 'role'>;
  mentions?: CandidateNoteMention[];
}

export interface CandidateNoteMention {
  id: string;
  noteId: string;
  userId: string;
  user?: Pick<User, 'id' | 'name'>;
}

export interface InterviewScore {
  id: string;
  candidateId: string;
  technicalSkills: number;
  communication: number;
  cultureFit: number;
  reliability: number;
  motivation: number;
  overallImpression: number;
  notes?: string;
  recommendation?: string;
  interviewerId: string;
  interviewDate: string;
  createdAt: string;
  interviewer?: User;
}

export interface LeaveRequest {
  id: string;
  employeeProfileId: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate?: string;
  totalDays?: number;
  reason?: string;
  notes?: string;
  approvedById?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  employeeProfile?: { userId: string; user?: User };
  approvedBy?: User;
}

export interface SickTracker {
  id: string;
  employeeProfileId: string;
  sicknessStartDate: string;
  sicknessEndDate?: string;
  week6ProblemAnalysis: boolean;
  week6CompletedAt?: string;
  week8ActionPlan: boolean;
  week8CompletedAt?: string;
  week42UwvNotification: boolean;
  week42CompletedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DossierEntry {
  id: string;
  employeeProfileId: string;
  date: string;
  type: DossierType;
  title: string;
  description: string;
  attachments?: string[];
  loggedById: string;
  createdAt: string;
  updatedAt: string;
  loggedBy?: User;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  employeeProfileId: string;
  customerId?: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  status: AppointmentStatus;
  vehicleId?: string;
  toolsList?: string[];
  saleValue?: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  employeeProfile?: EmployeeProfile & { user?: User };
}

export interface ReviewRequest {
  id: string;
  customerId: string;
  requestedById: string;
  sentAt: string;
  completedAt?: string;
  rating?: number;
  reviewText?: string;
  platform?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  linkUrl?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

// ─── Dashboard stats ────────────────────────────────────────────────────────────

export interface DashboardStats {
  activeEmployees: number;
  expiringContracts: number;
  pendingLeave: number;
  openCandidates: number;
}

// ─── Combined employee view ────────────────────────────────────────────────────

export interface EmployeeWithProfile extends User {
  employeeProfile?: EmployeeProfile;
}

// ─── Recruitment templates ─────────────────────────────────────────────────────

export interface ScreeningScript {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  roleType?: VacatureRol;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  questions?: ScreeningQuestion[];
  createdBy?: Pick<User, 'id' | 'name'>;
}

export interface ScreeningQuestion {
  id: string;
  scriptId: string;
  question: string;
  placeholder?: string;
  required: boolean;
  order: number;
  answers?: ScreeningAnswer[];
}

export interface ScreeningAnswer {
  id: string;
  questionId: string;
  candidateId: string;
  answer: string;
  answeredById: string;
  createdAt: string;
  updatedAt: string;
  answeredBy?: Pick<User, 'id' | 'name'>;
  question?: Pick<ScreeningQuestion, 'id' | 'question' | 'order'>;
}

export interface InterviewChecklist {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  roleType?: VacatureRol;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  items?: InterviewChecklistItem[];
  createdBy?: Pick<User, 'id' | 'name'>;
}

export interface InterviewChecklistItem {
  id: string;
  checklistId: string;
  label: string;
  description?: string;
  order: number;
  results?: InterviewChecklistResult[];
}

export interface InterviewChecklistResult {
  id: string;
  itemId: string;
  candidateId: string;
  checked: boolean;
  checkedById?: string;
  checkedAt?: string;
  checkedBy?: Pick<User, 'id' | 'name'>;
}
