'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage('Logged in successfully.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, maxWidth: 360 }}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Sign in</button>
        <button type="button" onClick={() => signOut(auth)}>Sign out</button>
      </form>
      <p>{message}</p>
    </div>
  );
}
