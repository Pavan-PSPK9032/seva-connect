import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  api,
  apiPost,
  apiPut,
  apiErrorMessage,
  clearAuth,
  getStoredToken,
  getStoredUser,
  storeAuth,
} from '../services/api';
import type { AuthResult, RegisterInput, User, VerificationChallenge } from '../types';

export interface RegisterResult {
  email: string;
  message?: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  verifyEmail: (email: string, otp: string) => Promise<User>;
  resendVerification: (email: string) => Promise<{ message?: string; retryAfter?: number }>;
  refreshUser: () => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>());
  const [loading, setLoading] = useState(false);

  const persist = (result: AuthResult) => {
    storeAuth(result.token, result.user);
    setToken(result.token);
    setUser(result.user);
  };

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiPost<AuthResult>('/auth/login', { email, password });
    if (!res.success || !res.token || !res.user) throw new Error(res.message || 'Login failed');
    persist({ token: res.token, user: res.user });
    return res.user;
  };

  /**
   * Registration no longer signs the user in. It returns the address that a
   * verification code was sent to; the caller routes to /verify-email.
   */
  const register = async (input: RegisterInput): Promise<RegisterResult> => {
    const res = await apiPost<VerificationChallenge>('/auth/register', input);
    if (!res.success) throw new Error(res.message || 'Registration failed');
    return {
      email: res.email || input.email,
      message: res.message,
      expiresInSeconds: res.expiresInSeconds,
      resendAfterSeconds: res.resendAfterSeconds,
    };
  };

  /** Consume the OTP and sign in atomically on success. */
  const verifyEmail = async (email: string, otp: string): Promise<User> => {
    const res = await apiPost<AuthResult>('/auth/verify-email', { email, otp });
    if (!res.success || !res.token || !res.user) {
      throw new Error(res.message || 'Verification failed');
    }
    persist({ token: res.token, user: res.user });
    return res.user;
  };

  const resendVerification = async (
    email: string
  ): Promise<{ message?: string; retryAfter?: number }> => {
    const res = await apiPost<VerificationChallenge>('/auth/resend-verification', { email });
    if (!res.success) throw new Error(res.message || 'Could not resend the code');
    return { message: res.message, retryAfter: res.retryAfter };
  };

  /**
   * Server-side logout invalidates the token family. The local session is
   * cleared even when the API call fails, so the browser never keeps a token it
   * believes is still valid.
   */
  const logout = async (): Promise<void> => {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Already-expired sessions are fine; clearing local state is the goal.
    } finally {
      clearAuth();
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async (): Promise<User> => {
    const res = await api.get<{ success: boolean; user: User }>('/users/me');
    const fresh = res.data.user;
    storeAuth(getStoredToken() ?? '', fresh);
    setUser(fresh);
    return fresh;
  };

  /**
   * Changing the password invalidates every previously issued token. The server
   * returns a fresh token for this session, which replaces the stored one so the
   * current browser stays signed in.
   */
  const changePassword = async (currentPassword: string, newPassword: string): Promise<User> => {
    const res = await apiPut<AuthResult>('/auth/password', { currentPassword, newPassword });
    if (!res.success || !res.token || !res.user) {
      throw new Error(res.message || 'Could not update your password.');
    }
    persist({ token: res.token, user: res.user });
    return res.user;
  };

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        verifyEmail,
        resendVerification,
        refreshUser,
        changePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { apiErrorMessage };
