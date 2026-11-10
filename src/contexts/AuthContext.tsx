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

/* ── Session check ────────────────────────────────────────────────────
   Asks /api/session (server-side) on every page load while signed in:
   - if the account is banned, we sign the user out right away
   - the server records lastSeen + the visitor's IP
   While the tab stays open we re-check at most every 10 minutes. */
const CHECK_EVERY_MS = 10 * 60 * 1000;
let lastCheck = 0;

async function checkSession(fbUser: User, force: boolean): Promise<'ok' | 'banned'> {
  if (!force && Date.now() - lastCheck < CHECK_EVERY_MS) return 'ok';
  lastCheck = Date.now();
  try {
    const token = await fbUser.getIdToken();
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.status === 403) return 'banned';
  } catch {}
  return 'ok'; // network errors never lock anyone out
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const { auth } = getFirebase();
      const unsub = onAuthStateChanged(auth, async (fbUser: User | null) => {
        if (fbUser) {
          // Check the ban status BEFORE exposing the user to the app, so a
          // banned account never gets to see the dashboard, not even briefly.
          const r = await checkSession(fbUser, true);
          if (r === 'banned') {
            try { sessionStorage.setItem('xt_banned', '1'); } catch {}
            setUser(null);
            setLoading(false);
            fbSignOut(auth).catch(() => {});
            return;
          }
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

      const onVisible = () => {
        if (document.visibilityState === 'visible' && auth.currentUser) {
          const cu = auth.currentUser;
          checkSession(cu, false).then((r) => {
            if (r === 'banned') {
              try { sessionStorage.setItem('xt_banned', '1'); } catch {}
              fbSignOut(auth).catch(() => {});
            }
          });
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
