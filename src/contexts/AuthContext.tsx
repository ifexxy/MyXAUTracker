'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getFirebase, getAuth } from '@/lib/firebase';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

/* ── Last-seen heartbeat ──────────────────────────────────────────────
   Writes users/{uid}.lastSeen at most once every 10 minutes per browser,
   on sign-in / page load and when the tab becomes visible again.
   Needs a Firestore rule that lets a user update ONLY their own lastSeen
   (see the rule in the notes). Failures are swallowed on purpose. */
const SEEN_EVERY_MS = 10 * 60 * 1000;
const memStamp: Record<string, number> = {};

function readStamp(key: string): number {
  try { return Number(localStorage.getItem(key) || 0); } catch { return 0; }
}
function writeStamp(key: string, value: number) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

async function touchLastSeen(uid: string) {
  try {
    const key = `xt_lastSeen:${uid}`;
    const last = Math.max(memStamp[uid] || 0, readStamp(key));
    if (Date.now() - last < SEEN_EVERY_MS) return;

    // stamp first so two quick triggers don't both write
    memStamp[uid] = Date.now();
    writeStamp(key, memStamp[uid]);

    const { db } = getFirebase();
    await updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() });
  } catch {}
}

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
          touchLastSeen(fbUser.uid);
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      const onVisible = () => {
        if (document.visibilityState === 'visible' && auth.currentUser) {
          touchLastSeen(auth.currentUser.uid);
        }
      };
      document.addEventListener('visibilitychange', onVisible);

      return () => {
        unsub();
        document.removeEventListener('visibilitychange', onVisible);
      };
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
