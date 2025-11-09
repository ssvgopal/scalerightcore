// src/contexts/AuthContext.tsx - Authentication context for the dashboard
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiClient } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
  organizationId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithDemo: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing auth on mount
    const token = localStorage.getItem('patientflow_token');
    if (token) {
      apiClient.setToken(token);
      // In a real app, you'd validate the token and get user info
      setUser({
        id: 'demo-user',
        email: process.env.NEXT_PUBLIC_DEMO_EMAIL || 'admin@example.com',
        name: 'Demo User',
        organizationId: 'demo-org'
      });
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { accessToken } = await apiClient.login(email, password);
      localStorage.setItem('patientflow_token', accessToken);
      apiClient.setToken(accessToken);
      
      setUser({
        id: 'demo-user',
        email,
        name: 'Demo User',
        organizationId: 'demo-org'
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const loginWithDemo = async () => {
    try {
      await apiClient.loginWithDemoKey();
      localStorage.setItem('patientflow_token', 'demo-token');
      
      setUser({
        id: 'demo-user',
        email: process.env.NEXT_PUBLIC_DEMO_EMAIL || 'admin@example.com',
        name: 'Demo User',
        organizationId: 'demo-org'
      });
    } catch (error) {
      console.error('Demo login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('patientflow_token');
    apiClient.clearToken();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginWithDemo,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}