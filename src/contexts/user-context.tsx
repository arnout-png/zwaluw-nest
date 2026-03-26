'use client';

import { createContext, useContext } from 'react';
import type { UserPermissions } from '@/types';

export interface UserContextValue {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: UserPermissions;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: UserContextValue;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}
