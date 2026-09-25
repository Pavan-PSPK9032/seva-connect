import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiPost, apiErrorMessage, clearAuth, getStoredToken, getStoredUser, storeAuth } from '../services/api';
import type { AuthResult, RegisterInput, User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
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

  const register = async (input: RegisterInput): Promise<User> => {
    const res = await apiPost<AuthResult>('/auth/register', input);
    if (!res.success || !res.token || !res.user) throw new Error(res.message || 'Registration failed');
    persist({ token: res.token, user: res.user });
    return res.user;
  };

  const logout = () => {
    clearAuth();
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { apiErrorMessage };