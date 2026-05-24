'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getFirebase, getAuth } from '@/lib/firebase';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

interface AuthUser {
  uid: string;
  email: string | null;
  phone: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
  getIdToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const { auth } = getFirebase();
      const unsub = onAuthStateChanged(auth, (fbUser: User | null) => {
        if (fbUser) {
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            phone: fbUser.phoneNumber,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsub();
    } catch {
      setLoading(false);
      return;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { auth } = getFirebase();
      await fbSignOut(auth);
      setUser(null);
    } catch {}
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    try {
      const { auth } = getFirebase();
      return await auth.currentUser?.getIdToken() || null;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
