import React, { createContext, useContext, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';

// Mock Auth Context for testing
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string, currentPassword: string) => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const mockUser: User = {
  id: 'test-user-id',
  email: 'test@pezkuwichain.io',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

export const mockAuthContext: AuthContextType = {
  user: mockUser,
  session: null,
  loading: false,
  signIn: jest.fn().mockResolvedValue({ error: null }),
  signUp: jest.fn().mockResolvedValue({ error: null }),
  signOut: jest.fn().mockResolvedValue(undefined),
  changePassword: jest.fn().mockResolvedValue({ error: null }),
  resetPassword: jest.fn().mockResolvedValue({ error: null }),
};

const AuthContext = createContext<AuthContextType>(mockAuthContext);

export const MockAuthProvider: React.FC<{
  children: ReactNode;
  value?: Partial<AuthContextType>
}> = ({ children, value = {} }) => {
  const contextValue = { ...mockAuthContext, ...value };
  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// Export as AuthProvider for compatibility with test imports
export const AuthProvider = MockAuthProvider;

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
