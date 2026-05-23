'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import Footer from '@/components/Footer';

interface UserStat {
  total: number;
  trial: number;
  active: number;
  cancelled: number;
  admin: number;
}

export default function AdminStatsPage() {
  const { user, getIdToken } = useAuth();
  const [stats, setStats] = useState<UserStat | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetEmail, setTargetEmail] = useState('');
  const [grantAction, setGrantAction] = useState('grant');
  const [grantDays, setGrantDays] = useState('30');
  const [resultMsg, setResultMsg] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      try {
        const fb = getFirebase();
        const snap = await getDoc(doc(fb.db, 'users', user.uid));
        if (snap.exists() && snap.data().role === 'admin') {
          setIsAdmin(true);
          const all = await getDocs(collection(fb.db, 'users'));
          const users = all.docs.map(d => d.data());
          setStats({
            total: users.length,
            trial: users.filter(u => u.subscriptionStatus === 'trial').length,
            active: users.filter(u => u.subscriptionStatus === 'active').length,
            cancelled: users.filter(u => u.subscriptionStatus === 'cancelled').length,
            admin: users.filter(u => u.role === 'admin').length,
          });
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleGrantAccess = async () => {
    if (!targetEmail) return;
    setResultMsg('');
    try {
      const token = await getIdToken();
      const res = await fetch('/api/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminToken: token,
          targetEmail,
          action: grantAction,
          daysOrMonths: grantDays,
          unit: 'days',
        }),
      });
      const data = await res.json();
      setResultMsg(data.message || data.error || 'Done');
    } catch (e: any) {
      setResultMsg('Error: ' + e.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-[40px]" style={{ color: 'var(--ink-3)' }}>Loading...</div>;
  if (!isAdmin) return <div className="flex items-center justify-center p-[40px]" style={{ color: 'var(--red)' }}>Access denied</div>;

  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          Admin<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
      </section>

      {stats && (
        <div className="mx-[20px] mb-[18px]">
          <div className="grid grid-cols-2 gap-[10px]">
            {[
              { label: 'Total Users', value: stats.total },
              { label: 'Trial', value: stats.trial },
              { label: 'Active', value: stats.active },
              { label: 'Cancelled', value: stats.cancelled },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-[20px] mb-[18px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Grant / Revoke Access</h2>
        <div className="mb-[12px]">
          <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>User Email</label>
          <input type="email" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} placeholder="user@email.com"
            style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
        </div>
        <div className="mb-[12px]">
          <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Action</label>
          <select value={grantAction} onChange={(e) => setGrantAction(e.target.value)}
            style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }}>
            <option value="grant">Grant Access</option>
            <option value="extend">Extend Access</option>
            <option value="revoke">Revoke Access</option>
            <option value="permanent">Permanent Access</option>
          </select>
        </div>
        {grantAction !== 'revoke' && grantAction !== 'permanent' && (
          <div className="mb-[12px]">
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Days</label>
            <input type="number" value={grantDays} onChange={(e) => setGrantDays(e.target.value)} min="1"
              style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
          </div>
        )}
        <button onClick={handleGrantAccess} className="w-full py-[13px] text-[14px] font-bold rounded-[12px] cursor-pointer"
          style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}>
          Execute
        </button>
        {resultMsg && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-2)', background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)' }}>
            {resultMsg}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
