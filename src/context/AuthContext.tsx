import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  isDevAdmin?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  loginWithPassword: (password: string) => Promise<{ error?: string }>;
  loginWithGoogle: () => Promise<{ error?: string }>;
  loginAsDevAdmin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_ADMIN_KEY = 'adi_dev_admin_session';

// 관리자 지정 비밀번호 (기본값 설정 및 .env / Supabase 환경변수 연동)
const ADMIN_MASTER_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'itket2026!';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Supabase Auth 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
          avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
        });
        setLoading(false);
      } else {
        // 2. 개발/테스트용 로컬 관리자 세션 확인
        try {
          const dev = localStorage.getItem(DEV_ADMIN_KEY);
          if (dev) {
            setUser(JSON.parse(dev));
          }
        } catch {
          // ignore
        }
        setLoading(false);
      }
    });

    // 3. Supabase Auth 상태 변화 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
          avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
        });
      } else {
        try {
          const dev = localStorage.getItem(DEV_ADMIN_KEY);
          if (dev) {
            setUser(JSON.parse(dev));
            return;
          }
        } catch {
          // ignore
        }
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithPassword = async (password: string): Promise<{ error?: string }> => {
    if (!password) {
      return { error: '관리자 비밀번호를 입력해주세요.' };
    }
    if (password !== ADMIN_MASTER_PASSWORD) {
      return { error: '비밀번호가 일치하지 않습니다.' };
    }
    const adminUser: AuthUser = {
      id: 'admin_master',
      email: 'admin@itket.com',
      name: '관리자',
      isDevAdmin: false,
    };
    try {
      localStorage.setItem(DEV_ADMIN_KEY, JSON.stringify(adminUser));
    } catch {
      // ignore
    }
    setUser(adminUser);
    return {};
  };

  const loginWithGoogle = async () => {
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) {
        console.error('Google login error:', error.message);
        return { error: error.message };
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Google 로그인에 실패했습니다.' };
    }
  };

  const loginAsDevAdmin = () => {
    const devUser: AuthUser = {
      id: 'dev_admin_local',
      email: 'admin@itket.com',
      name: '관리자 (Admin)',
      isDevAdmin: true,
    };
    try {
      localStorage.setItem(DEV_ADMIN_KEY, JSON.stringify(devUser));
    } catch {
      // ignore
    }
    setUser(devUser);
  };

  const logout = async () => {
    try {
      localStorage.removeItem(DEV_ADMIN_KEY);
    } catch {
      // ignore
    }
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
        loginWithPassword,
        loginWithGoogle,
        loginAsDevAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
