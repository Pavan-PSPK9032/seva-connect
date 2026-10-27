export type Role = 'volunteer' | 'ngo' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  skills?: string[];
  interests?: string[];
  profileImage?: string;
  location?: string;
  availability?: string;
  preferredCauses?: string[];
  savedEvents?: string[];
  leaderboardOptOut?: boolean;
  accountStatus?: 'active' | 'suspended';
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  termsAcceptedAt?: string | null;
  lastLoginAt?: string | null;
  authProvider?: 'password' | 'google';
  googleLinked?: boolean;
  notificationPrefs?: NotificationPreferences;
  createdAt?: string;
}

export interface NGO {
  _id: string;
  organizationName: string;
  description: string;
  location: string;
  contactEmail: string;
  causes: string[];
  website?: string;
  logo?: string;
  verified: boolean;
  verificationRequested?: boolean;
  verificationNote?: string;
  verifiedAt?: string | null;
  status?: 'active' | 'suspended';
  events?: EventItem[];
  stats?: {
    completedEvents: number;
    verifiedHours: number;
    activeVolunteers: number;
  };
  createdBy?: string;
  createdAt?: string;
}

export interface EventItem {
  _id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  online?: boolean;
  causes?: string[];
  ngoId: string | { _id: string; organizationName?: string; verified?: boolean };
  ngoName?: string;
  ngoVerified?: boolean;
  ngoLogo?: string;
  requiredVolunteers?: number;
  registeredVolunteers?: number;
  requiredSkills?: string[];
  eligibility?: string;
  applicationDeadline?: string | null;
  status?: string;
  createdAt?: string;
  matchScore?: number;
  matchReasons?: string[];
  related?: EventItem[];
  ngo?: {
    _id: string;
    organizationName: string;
    description?: string;
    verified?: boolean;
    logo?: string;
    location?: string;
    website?: string;
    contactEmail?: string;
    causes?: string[];
  };
}

export type ApplicationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'completed'
  | 'cancelled';

export interface ApplicationEvent {
  _id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  online?: boolean;
  status?: string;
  requiredVolunteers?: number;
  registeredVolunteers?: number;
  ngoName?: string;
  ngoVerified?: boolean;
}

export interface ApplicationVolunteer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  skills?: string[];
  interests?: string[];
  profileImage?: string;
}

export interface Application {
  _id: string;
  eventId: string;
  volunteerId: string;
  ngoId: string;
  status: ApplicationStatus;
  coverNote?: string;
  hoursCredited: number;
  decidedAt?: string | null;
  completedAt?: string | null;
  withdrawnAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  event?: ApplicationEvent;
  volunteer?: ApplicationVolunteer;
}

export interface ApplicationSummary {
  total: number;
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
  withdrawn: number;
  cancelled: number;
  hours: number;
}

export type NotificationType =
  | 'application_received'
  | 'application_approved'
  | 'application_rejected'
  | 'application_withdrawn'
  | 'application_completed'
  | 'event_updated'
  | 'event_cancelled'
  | 'event_reminder'
  | 'certificate_ready'
  | 'verification_requested'
  | 'system';

export interface NotificationItem {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  reminders: boolean;
}

export interface PlatformStats {
  volunteers: number;
  ngos: number;
  verifiedNgos: number;
  pendingNgos: number;
  activeEvents: number;
  upcomingEvents: number;
  ongoingEvents: number;
  completedEvents: number;
  applications: number;
  verifiedHours: number;
}

export interface ImpactBreakdown {
  cause?: string;
  location?: string;
  activities: number;
  hours: number;
}

export interface ImpactMonth {
  month: string;
  label: string;
  activities: number;
  hours: number;
}

export interface ImpactTrendPoint {
  month: string;
  label: string;
  applications: number;
}

export interface TopNGO {
  ngoId: string;
  name: string;
  verified: boolean;
  activities: number;
  hours: number;
}

export interface ImpactData {
  generatedAt: string;
  totals: {
    volunteers: number;
    ngos: number;
    verifiedNgos: number;
    opportunities: number;
    completedEvents: number;
    applications: number;
    completedActivities: number;
    activeContributors: number;
    verifiedHours: number;
  };
  eventStats: {
    upcoming: number;
    ongoing: number;
    completed: number;
    cancelled: number;
    total: number;
    completionRate: number;
  };
  byCause: ImpactBreakdown[];
  byLocation: ImpactBreakdown[];
  monthly: ImpactMonth[];
  applicationTrend: ImpactTrendPoint[];
  topNGOs: TopNGO[];
  notes: { period: string; source: string };
}

export interface LeaderboardEntry {
  rank: number;
  volunteerId: string;
  name: string;
  profileImage?: string;
  location?: string;
  hours: number;
  activities: number;
  lastCompletedAt?: string;
}

export interface LeaderboardData {
  period: 'all' | 'week' | 'month';
  periodStart: string | null;
  totalParticipants: number;
  totalHours: number;
  scoring: string;
  entries: LeaderboardEntry[];
}

export interface Certificate {
  _id: string;
  certificateId: string;
  applicationId: string;
  volunteerId: string;
  eventId: string;
  ngoId: string;
  volunteerName: string;
  eventTitle: string;
  ngoName: string;
  eventDate?: string | null;
  hours: number;
  issuedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ValidationFieldError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  note?: string;
  code?: string;
  data?: T;
  token?: string;
  user?: User;
  pagination?: Pagination;
  unreadCount?: number;
  summary?: ApplicationSummary | Record<string, number>;
  errors?: ValidationFieldError[];
  verificationRequired?: boolean;
  email?: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
  retryAfter?: number;
  attemptsRemaining?: number;
  isNewUser?: boolean;
}

export interface VerificationChallenge {
  email: string;
  message?: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: 'volunteer' | 'ngo';
  skills?: string[];
  acceptTerms?: boolean;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

export interface ChatReply {
  reply: string;
  /** "ai" when Gemini answered, "fallback" when the local assistant did. */
  mode: 'ai' | 'fallback';
  grounded: boolean;
}

export interface ChatStatus {
  provider: string;
  model: string;
  aiEnabled: boolean;
}

/* --------------------------------- Admin ---------------------------------- */

export interface AuditEntry {
  _id: string;
  actor?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface AdminOverview {
  users: {
    total: number;
    verified: number;
    unverified: number;
    volunteers: number;
    ngoUsers: number;
    admins: number;
    suspended: number;
  };
  ngos: { total: number; verified: number; pending: number; unverified: number };
  events: {
    total: number;
    draft: number;
    upcoming: number;
    ongoing: number;
    completed: number;
    cancelled: number;
    archived: number;
    active: number;
  };
  applications: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    withdrawn: number;
    cancelled: number;
  };
  verifiedHours: number;
  certificates: number;
  recentUsers: User[];
  recentActivity: AuditEntry[];
  charts: {
    userGrowth: { month: string; label: string; users: number; volunteers: number; ngos: number }[];
    engagement: {
      month: string;
      label: string;
      applications: number;
      completed: number;
      hours: number;
    }[];
    activityStatus: { name: string; value: number }[];
    roleBreakdown: { name: string; value: number }[];
  };
}

export interface AdminUserStats {
  applications: number;
  approved: number;
  completed: number;
  hours: number;
}

export interface AdminUserDetail {
  user: User;
  applications: Application[];
  ngos: Pick<NGO, '_id' | 'organizationName' | 'verified' | 'status' | 'location' | 'createdAt'>[];
  certificates: number;
  stats: AdminUserStats;
}

export interface VolunteerStats {
  applications: number;
  pending?: number;
  approved?: number;
  completed: number;
  hours: number;
}

export interface AdminVolunteer extends User {
  stats: VolunteerStats;
}

export interface AdminVolunteerDetail {
  volunteer: User;
  applications: Application[];
  certificates: Certificate[];
  stats: VolunteerStats;
}

export interface AdminNGODetail {
  ngo: NGO & {
    createdBy?: Pick<User, '_id' | 'name' | 'email' | 'phone' | 'accountStatus' | 'emailVerified' | 'createdAt'>;
  };
  events: EventItem[];
  history: AuditEntry[];
  stats: {
    events: number;
    upcoming: number;
    completed: number;
    cancelled: number;
    applications: number;
    approved: number;
    completedApplications: number;
    volunteers: number;
  };
}

export interface ReportSeriesPoint {
  period: string;
  registrations: number;
  applications: number;
  completed: number;
}

export interface AdminReport {
  range: { from: string; to: string; days: number; groupFormat: string };
  registrations: {
    total: number;
    verified: number;
    unverified: number;
    volunteers: number;
    ngos: number;
    admins: number;
  };
  participation: {
    applications: number;
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    hours: number;
  };
  activities: {
    created: number;
    total: number;
    upcoming: number;
    ongoing: number;
    completed: number;
    cancelled: number;
  };
  ngos: { created: number; verified: number };
  series: ReportSeriesPoint[];
}

export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export interface Announcement {
  _id: string;
  title: string;
  message: string;
  link?: string;
  audience: 'all' | 'volunteer' | 'ngo';
  status: AnnouncementStatus;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdBy?: Pick<User, '_id' | 'name' | 'email'> | string | null;
  createdAt: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  registrationOpen: boolean;
  maintenanceNotice: string;
  announcementBanner: string;
  updatedAt?: string;
}

export interface AdminSecurity {
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  tokenVersion: number;
  accountStatus: 'active' | 'suspended';
  sessionsSupported: boolean;
}