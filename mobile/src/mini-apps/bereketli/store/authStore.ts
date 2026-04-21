import {create} from 'zustand';
import type {User} from '../types/models';
import * as authApi from '../api/auth';
import {clearTokens, getAccessToken} from '../api/client';

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;

  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string, referral_code?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
  clearError: () => void;
  setAuth: (data: { accessToken: string; refreshToken: string; user: User }) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  error: null,

  login: async (identifier, password) => {
    set({isLoading: true, error: null});
    try {
      const response = await authApi.login(identifier, password);
      set({user: response.user, isLoggedIn: true, isLoading: false});
    } catch (err: any) {
      const message = err.response?.data?.message || 'Giris basarisiz';
      set({error: message, isLoading: false});
      throw err;
    }
  },

  register: async (name, email, password, phone, referral_code) => {
    set({isLoading: true, error: null});
    try {
      const response = await authApi.register(name, email, password, phone, referral_code);
      set({user: response.user, isLoggedIn: true, isLoading: false});
    } catch (err: any) {
      const message = err.response?.data?.message || 'Kayit basarisiz';
      set({error: message, isLoading: false});
      throw err;
    }
  },

  logout: async () => {
    await clearTokens();
    set({user: null, isLoggedIn: false, isLoading: false, error: null});
  },

  checkAuth: async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        const user = await authApi.getMe();
        set({user, isLoggedIn: true, isLoading: false});
      } else {
        set({isLoggedIn: false, isLoading: false});
      }
    } catch {
      set({isLoggedIn: false, isLoading: false});
    }
  },

  updateUser: (partial) => set((state) => ({
    user: state.user ? {...state.user, ...partial} : null,
  })),

  clearError: () => set({error: null}),

  setAuth: (data) => {
    // Store tokens for API client
    import('../api/client').then(({ saveTokens }) => {
      saveTokens(data.accessToken, data.refreshToken);
    });
    set({ user: data.user, isLoggedIn: true, isLoading: false, error: null });
  },
}));
