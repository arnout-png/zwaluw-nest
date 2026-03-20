'use client';

import { createContext, useContext } from 'react';

export interface UserContextValue {
  userId: string;
  email: string;
  name: string;
  role: string;
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
