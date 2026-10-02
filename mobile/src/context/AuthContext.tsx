// 鉴权状态管理 —— 管理登录态、token、用户信息
import React, { createContext, useContext, useEffect, useState } from 'react';

import { api } from '../api/client';

interface User {
  user_id: string;
  uid?: string;             // 8位数字短ID（搜索加好友用）
  username?: string;
  nickname?: string;
  gender?: string;
  birthday?: string;
  height_cm?: number;
  weight_kg?: number;
  body_fat_pct?: number;
  resting_heart_rate?: number;
  goal?: string;
  activity_factor?: number;
  is_coach?: boolean;
  specialty?: string;
  location?: string;        // 所在地
  gym?: string;             // 常去健身房
  show_birthday?: boolean;  // 生日是否公开
  show_location?: boolean;  // 所在地是否公开
  show_gym?: boolean;       // 健身房是否公开
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 本地存储token（简化版，实际可用expo-secure-store）
const TOKEN_KEY = 'super_training_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 恢复登录态
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      api.setToken(saved);
      api.getMe()
        .then((d) => setUser(d))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const d = await api.login(username, password);
    setToken(d.token);
    setUser(d.user);
    api.setToken(d.token);
    localStorage.setItem(TOKEN_KEY, d.token);
  };

  const register = async (username: string, password: string, nickname?: string) => {
    const d = await api.register(username, password, nickname);
    setToken(d.token);
    setUser(d.user);
    api.setToken(d.token);
    localStorage.setItem(TOKEN_KEY, d.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    api.setToken(null);
    localStorage.removeItem(TOKEN_KEY);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!token) throw new Error('未登录');
    const updated = await api.updateMe(data);
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
