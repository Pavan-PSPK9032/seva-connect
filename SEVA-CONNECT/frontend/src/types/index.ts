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
  ngoId: string;
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

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'completed';

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