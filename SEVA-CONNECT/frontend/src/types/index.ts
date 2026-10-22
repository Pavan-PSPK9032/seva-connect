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
  data?: T;
  token?: string;
  user?: User;
  pagination?: Pagination;
  unreadCount?: number;
  summary?: ApplicationSummary;
  devResetUrl?: string;
  errors?: ValidationFieldError[];
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