import type { ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from '@/state/authContext';

/** Injects a stub auth context so screens can be tested without the Firebase SDK. */
export function AuthTestProvider({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
