import React, { createContext, useContext, useState, useEffect } from 'react';
import { IOrganizer } from '../../../shared/types.js';
import { api } from '../api/apiClient.js';

interface AuthContextType {
  organizer: IOrganizer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  requestRegistrationOtp: (data: { name: string; email: string; password: string }) => Promise<void>;
  verifyRegistrationOtp: (email: string, otp: string) => Promise<void>;
  sendOtp: (email: string) => Promise<{ success: boolean; message: string; previewUrl?: string }>;
  loginWithOtp: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizer, setOrganizer] = useState<IOrganizer | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      // The httpOnly cookie is sent automatically by the browser.
      // If it's missing or expired, getMe() will throw a 401.
      const res = await api.getMe();
      setOrganizer(res.organizer);
    } catch {
      setOrganizer(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isReload = navigation?.type === 'reload';

    if (isReload) {
      api.logoutOrganizer().catch(() => undefined).finally(() => {
        sessionStorage.removeItem('gatekeeper_superadmin_token');
        localStorage.removeItem('gatekeeper_superadmin_token');
        setOrganizer(null);
        setIsLoading(false);
      });
      return;
    }

    refreshUser();
  }, []);

  const login = async (data: { email: string; password: string }) => {
    const res = await api.loginOrganizer(data);
    setOrganizer(res.organizer);
  };

  const register = async (data: { name: string; email: string; password: string }) => {
    const res = await api.registerOrganizer(data);
    setOrganizer(res.organizer);
  };

  const requestRegistrationOtp = async (data: { name: string; email: string; password: string }) => {
    await api.requestRegistrationOtp(data);
  };

  const verifyRegistrationOtp = async (email: string, otp: string) => {
    const res = await api.verifyRegistrationOtp(email, otp);
    setOrganizer(res.organizer);
  };

  const sendOtp = async (email: string) => {
    return await api.sendOtp(email);
  };

  const loginWithOtp = async (email: string, otp: string) => {
    const res = await api.verifyOtp(email, otp);
    setOrganizer(res.organizer);
  };

  const logout = async () => {
    try {
      await api.logoutOrganizer();
    } finally {
      sessionStorage.removeItem('gatekeeper_superadmin_token');
      localStorage.removeItem('gatekeeper_superadmin_token');
      setOrganizer(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        organizer,
        isAuthenticated: !!organizer,
        isLoading,
        login,
        register,
        requestRegistrationOtp,
        verifyRegistrationOtp,
        sendOtp,
        loginWithOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
