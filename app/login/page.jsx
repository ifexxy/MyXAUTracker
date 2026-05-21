'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseAuth, hasFirebaseClientConfig } from '../../lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const login = async (e) => {
    e.preventDefault();
    if (!hasFirebaseClientConfig()) {
      setMsg('Missing NEXT_PUBLIC_FIREBASE_* env variables.');
      return;
    }
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      setMsg('Signed in.');
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-card p-4">
      <h2 className="mb-3 text-xl font-semibold">Login</h2>
      <form onSubmit={login} className="grid gap-3">
        <input className="rounded border border-white/20 bg-black/20 px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded border border-white/20 bg-black/20 px-3 py-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="rounded bg-gold px-3 py-2 font-semibold text-black" type="submit">Sign in</button>
        <button className="rounded border border-white/20 px-3 py-2" type="button" onClick={() => signOut(getFirebaseAuth())}>Sign out</button>
      </form>
      <p className="mt-3 text-sm text-muted">{msg}</p>
    </section>
  );
}
