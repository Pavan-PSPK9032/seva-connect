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
  status?: string;
  createdAt?: string;
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