import { create } from "zustand";
import { apiRequest } from "../lib/api";

export interface User {
  id: string;
  email: string;
  publicKey?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  login: (email: string, password?: string) => Promise<void>;
  register: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<{ user: User; accessToken: string; csrfToken: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );
      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.csrfToken) localStorage.setItem("csrfToken", data.csrfToken);
      set({ user: data.user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<{ user: User; accessToken: string; csrfToken: string }>(
        "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );
      if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data.csrfToken) localStorage.setItem("csrfToken", data.csrfToken);
      set({ user: data.user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      return;
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("csrfToken");
    set({ user: null });
  },

  checkSession: async () => {
    try {
      const data = await apiRequest<{ user: User }>("/api/auth/me");
      set({ user: data.user });
    } catch {
      set({ user: null });
    }
  },
}));
