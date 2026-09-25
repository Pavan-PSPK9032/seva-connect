import axios from 'axios';
import type { ApiResponse, ValidationFieldError } from '../types';

/**
 * Shared Axios instance. The base URL defaults to "/api" which is proxied
 * to the backend by Vite in development; override with VITE_API_URL for
 * production builds.
 */
export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'sc_token';
const USER_KEY = 'sc_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser<T>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status as number | undefined;
    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      clearAuth();
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export async function apiGet<T>(
  url: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ApiResponse<T[]>> {
  const res = await api.get<ApiResponse<T[]>>(url, { params });
  return res.data;
}

export async function apiPost<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await api.post<ApiResponse<T>>(url, body);
  return res.data;
}

export async function apiPut<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await api.put<ApiResponse<T>>(url, body);
  return res.data;
}

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const anyError = error as {
    response?: { data?: Partial<ApiResponse<unknown>> & { errors?: ValidationFieldError[] } };
    message?: string;
  };
  const data = anyError?.response?.data;
  if (data?.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e.message).join(' ');
  }
  if (anyError?.message && anyError.message !== 'Network Error') return anyError.message;
  return fallback;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}