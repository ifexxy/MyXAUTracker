'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebase } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

const ADMIN_EMAIL = 'ifexxy9@gmail.com';
const PAGE_SIZE = 30;

interface UserDoc {
  _id: string;
  email?: string;
  createdAt?: any;
  lastSeen?: any;
  manualAccess?: boolean;
  manualAccessExpiresAt?: string | null;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
}

function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  return new Date(val).getTime();
}

function fmtDate(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(ms: number): string {
  if (!ms) return 'Never';
  return new Date(ms).toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function getStatusInfo(u: UserDoc) {
  const now = Date.now();
  if (u.manualAccess === true) {
    if (!u.manualAccessExpiresAt) return { label: 'Manual', key: 'manual', cls: 'badge-manual' };
    const exp = toMs(u.manualAccessExpiresAt);
    if (exp > now) return { label: 'Manual', key: 'manual', cls: 'badge-manual' };
    return { label: 'Manual (Expired)', key: 'expired', cls: 'badge-expired' };
  }
  if (u.subscriptionStatus === 'active' && u.currentPeriodEnd) {
    const exp = toMs(u.currentPeriodEnd);
    if (exp > now) return { label: 'Pro', key: 'pro', cls: 'badge-pro' };
    return { label: 'Pro (Expired)', key: 'expired', cls: 'badge-expired' };
  }
  if (u.trialEndsAt) {
    const exp = toMs(u.trialEndsAt);
    if (exp > now) return { label: 'Trial', key: 'trial', cls: 'badge-trial' };
    return { label: 'Trial Expired', key: 'expired', cls: 'badge-expired' };
  }
  return { label: 'No Access', key: 'none', cls: 'badge-none' };
}

function getExpiry(u: UserDoc): string {
  if (u.manualAccess && u.manualAccessExpiresAt) return fmtDate(toMs(u.manualAccessExpiresAt));
  if (u.manualAccess && !u.manualAccessExpiresAt) return 'Permanent';
  if (u.subscriptionStatus === 'active' && u.currentPeriodEnd) return fmtDate(toMs(u.currentPeriodEnd));
  if (u.trialEndsAt) return fmtDate(toMs(u.trialEndsAt));
  return '—';
}

function timeAgo(ms: number): string {
  if (!ms) return 'Never';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return fmtDate(ms);
}

// Colour cue for the Last Seen dot: green = today, gold = this week, grey = older / never
function seenTone(ms: number): 'now' | 'week' | 'old' {
  if (!ms) return 'old';
  const diff = Date.now() - ms;
  if (diff < 86400000) return 'now';
  if (diff < 7 * 86400000) return 'week';
  return 'old';
}

const TH: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.12em',
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  background: 'var(--bg-2)',
};

const TD_MONO: React.CSSProperties = {
  padding: '13px 16px',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--ink-2)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

export default function AdminStatsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState<UserDoc[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingTable, setLoadingTable] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginErr, setLoginErr] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsAdmin(false); return; }
    if (user.email === ADMIN_EMAIL) {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }, [user, authLoading]);

  const doLogin = async () => {
    setLoginErr('');
    try {
      const fb = getFirebase();
      await signInWithEmailAndPassword(fb.auth, loginEmail, loginPass);
    } catch {
      setLoginErr('Incorrect email or password.');
    }
  };

  const doLogout = async () => {
    await signOut();
  };

  const loadUsers = async () => {
    setLoadingTable(true);
    try {
      const fb = getFirebase();
      const q = query(collection(fb.db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const users = snap.docs.map(d => ({ _id: d.id, ...d.data() } as UserDoc));
      setAllUsers(users);
      showToast(`✓ Loaded ${users.length} users`);
    } catch {
      showToast('⚠ Failed to load users');
    } finally {
      setLoadingTable(false);
    }
  };

  // Load users once admin is confirmed
  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  // Filter logic
  const filtered = allUsers.filter(u => {
    const matchSearch = !search || (u.email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || getStatusInfo(u).key === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const pro = allUsers.filter(u => getStatusInfo(u).key === 'pro').length;
  const trial = allUsers.filter(u => getStatusInfo(u).key === 'trial').length;
  const manual = allUsers.filter(u => getStatusInfo(u).key === 'manual').length;

  // Toast
  const toastRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    const el = toastRef.current;
    if (!el) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    el.textContent = msg;
    el.classList.add('show');
    toastTimer.current = setTimeout(() => el.classList.remove('show'), 2500);
  };

  const exportCSV = () => {
    if (!filtered.length) { showToast('⚠ Nothing to export'); return; }
    const headers = ['Email', 'Status', 'Registered', 'Last Seen', 'Expires'];
    const rows = filtered.map(u => [
      u.email || u._id,
      getStatusInfo(u).label,
      u.createdAt ? fmtDate(toMs(u.createdAt)) : '',
      u.lastSeen ? fmtDate(toMs(u.lastSeen)) : 'Never',
      getExpiry(u),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xautracker-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ Exported ${filtered.length} rows`);
  };

  if (authLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--ink-3)' }}>Loading...</div>;
  }

  return (
    <>
      <style>{`
        #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
        .badge-pro { background: var(--green-bg); color: var(--green); }
        .badge-trial { background: var(--gold-bg); color: var(--gold); }
        .badge-manual { background: rgba(100,100,255,0.1); color: #6060dd; }
        .badge-expired { background: var(--red-bg); color: var(--red); }
        .badge-none { background: var(--bg-3); color: var(--ink-3); }

        /* ── layout (desktop defaults) ── */
        .stats-page { max-width: 960px; margin: 0 auto; padding: 0 20px 60px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .controls { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .search-wrap { flex: 1; min-width: 200px; position: relative; }
        .table-wrap { background: var(--bg-2); border: 1px solid var(--border); border-radius: 14px; overflow-x: auto; overflow-y: hidden; }

        /* desktop shows the table, mobile shows cards */
        .user-cards { display: none; }

        .seen { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
        .seen-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--ink-4, #9a9a9a); }
        .seen-now  .seen-dot { background: var(--green); box-shadow: 0 0 0 3px var(--green-bg); }
        .seen-week .seen-dot { background: var(--gold); }
        .seen-now  .seen-text { color: var(--ink); font-weight: 700; }
        .seen-week .seen-text { color: var(--ink); font-weight: 600; }

        /* ── user cards (mobile) ── */
        .user-card { padding: 14px 14px 13px; border-bottom: 1px solid var(--border); }
        .user-card:last-child { border-bottom: none; }
        .uc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .uc-email { flex: 1; min-width: 0; font-size: 14px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; line-height: 1.35; }
        .uc-badge { flex: none; display: inline-flex; align-items: center; font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px; white-space: nowrap; }
        .uc-seen { margin-top: 10px; padding: 9px 11px; border-radius: 10px; background: var(--bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .uc-seen-k { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-3); }
        .uc-seen .seen-text { font-size: 13px; color: var(--ink-2); }
        .uc-meta { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .uc-k { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-3); margin-bottom: 3px; }
        .uc-v { display: block; font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
        .card-state { text-align: center; padding: 40px 16px; color: var(--ink-3); font-size: 13px; }
        .card-state i { display: block; font-size: 28px; margin-bottom: 10px; color: var(--ink-4); }

        @media (max-width: 720px) {
          .stats-page { padding: 0 14px 48px; }
          .summary-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
          .search-wrap { flex: 1 1 100%; min-width: 0; }
          .controls .filter-select { flex: 1 1 0; min-width: 0; }
          .users-table { display: none; }
          .user-cards { display: block; }
          .pagination { padding: 12px 14px !important; }
        }
      `}</style>

      <div id="page" className="stats-page">
        <div id="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo" style={{ width: 34, height: 34, background: 'var(--gold-bg)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontSize: 15 }}><i className="fa-solid fa-coins" /></div>
            <span className="wordmark" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>XauTracker <span style={{ color: 'var(--gold)' }}>Admin</span></span>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <a href="/admin" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)', transition: 'all .18s' }}>
              <i className="fa-solid fa-arrow-left" /> Dashboard
            </a>
            <button className="theme-btn" onClick={toggleTheme} title="Toggle theme" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--ink-2)', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, transition: 'all .18s' }}>
              <i id="theme-icon" className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            </button>
            <button className="btn btn-outline btn-sm" onClick={doLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)', transition: 'all .18s' }}>
              <i className="fa-solid fa-right-from-bracket" /> Sign Out
            </button>
          </div>
        </div>

        {/* Login screen */}
        {!isAdmin && (
          <div id="login-screen" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="login-box" style={{ width: '100%', maxWidth: 360, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 18, padding: 28 }}>
              <div className="login-logo" style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--gold-bg)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 18 }}><i className="fa-solid fa-lock" /></div>
              <h2 style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Admin Access</h2>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-3)', marginBottom: 18 }}>Sign in to view user stats</p>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '12px 0 6px', fontWeight: 700 }}>Email</label>
              <input type="email" id="login-email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@email.com"
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', fontSize: 14, padding: '11px 13px', outline: 'none', transition: 'border-color .2s' }} />
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '12px 0 6px', fontWeight: 700 }}>Password</label>
              <input type="password" id="login-pass" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="••••••••"
                onKeyDown={(e) => { if (e.key === 'Enter') doLogin(); }}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', fontSize: 14, padding: '11px 13px', outline: 'none', transition: 'border-color .2s' }} />
              {loginErr && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 8, display: 'block' }}>{loginErr}</p>}
              <button className="btn btn-gold" onClick={doLogin} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all .18s', background: 'var(--ink)', color: 'var(--bg)', width: '100%', marginTop: 14, justifyContent: 'center' }}>
                <i className="fa-solid fa-right-to-bracket" /> Sign In
              </button>
            </div>
          </div>
        )}

        {/* Admin app */}
        {isAdmin && (
          <div id="admin-app">
            {/* Summary cards */}
            <div className="summary-grid">
              <div className="sum-card" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                <div className="sum-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-3)', marginBottom: 8 }}>Total Users</div>
                <div className="sum-val" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{allUsers.length}</div>
                <div className="sum-sub" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>all registered</div>
              </div>
              <div className="sum-card" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                <div className="sum-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-3)', marginBottom: 8 }}>Pro</div>
                <div className="sum-val" style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>{pro}</div>
                <div className="sum-sub" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>active subscribers</div>
              </div>
              <div className="sum-card" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                <div className="sum-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-3)', marginBottom: 8 }}>Trial</div>
                <div className="sum-val" style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{trial}</div>
                <div className="sum-sub" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>active trials</div>
              </div>
              <div className="sum-card" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                <div className="sum-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-3)', marginBottom: 8 }}>Manual</div>
                <div className="sum-val" style={{ fontSize: 28, fontWeight: 800, color: '#6060dd', lineHeight: 1 }}>{manual}</div>
                <div className="sum-sub" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>granted access</div>
              </div>
            </div>

            {/* Controls */}
            <div className="controls">
              <div className="search-wrap">
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', fontSize: 13, pointerEvents: 'none' }} />
                <input className="search-input" type="text" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search by email..."
                  style={{ width: '100%', padding: '10px 12px 10px 34px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', fontSize: 13, outline: 'none', transition: 'border-color .2s' }} />
              </div>
              <select className="filter-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                style={{ padding: '10px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="all">All Statuses</option>
                <option value="pro">Pro</option>
                <option value="trial">Trial</option>
                <option value="manual">Manual</option>
                <option value="expired">Expired</option>
                <option value="none">No Access</option>
              </select>
              <button className="btn btn-outline btn-sm" onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)', transition: 'all .18s' }}>
                <i className="fa-solid fa-download" /> Export CSV
              </button>
              <button className="btn btn-outline btn-sm" onClick={loadUsers} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)', transition: 'all .18s' }}>
                <i className="fa-solid fa-rotate-right" /> Refresh
              </button>
            </div>

            {/* Users: table on desktop, cards on phones */}
            <div className="table-wrap">
              <table className="users-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>Email</th>
                    <th style={TH}>Status</th>
                    <th style={TH}>Registered</th>
                    <th style={TH}>Last Seen</th>
                    <th style={TH}>Expires / Ends</th>
                  </tr>
                </thead>
                <tbody id="user-tbody">
                  {loadingTable ? (
                    <tr className="state-row"><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 13 }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ display: 'block', fontSize: 28, marginBottom: 10, color: 'var(--ink-4)' }} />Loading users...
                    </td></tr>
                  ) : slice.length === 0 ? (
                    <tr className="state-row"><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 13 }}>
                      <i className="fa-solid fa-users-slash" style={{ display: 'block', fontSize: 28, marginBottom: 10, color: 'var(--ink-4)' }} />No users match your search.
                    </td></tr>
                  ) : (
                    slice.map(u => {
                      const status = getStatusInfo(u);
                      const registered = u.createdAt ? fmtDate(toMs(u.createdAt)) : '—';
                      const seenMs = toMs(u.lastSeen);
                      const expiry = getExpiry(u);
                      return (
                        <tr key={u._id} style={{ transition: 'background .13s' }}>
                          <td className="td-email" title={u.email || u._id} style={{ padding: '13px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle', fontWeight: 600, color: 'var(--ink)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || u._id}</td>
                          <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                            <span className={`badge ${status.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{status.label}</span>
                          </td>
                          <td className="td-mono" style={TD_MONO}>{registered}</td>
                          <td className="td-mono" title={fmtDateTime(seenMs)} style={TD_MONO}>
                            <span className={`seen seen-${seenTone(seenMs)}`}>
                              <span className="seen-dot" />
                              <span className="seen-text">{timeAgo(seenMs)}</span>
                            </span>
                          </td>
                          <td className="td-mono" style={TD_MONO}>{expiry}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="user-cards">
                {loadingTable ? (
                  <div className="card-state">
                    <i className="fa-solid fa-spinner fa-spin" />Loading users...
                  </div>
                ) : slice.length === 0 ? (
                  <div className="card-state">
                    <i className="fa-solid fa-users-slash" />No users match your search.
                  </div>
                ) : (
                  slice.map(u => {
                    const status = getStatusInfo(u);
                    const registered = u.createdAt ? fmtDate(toMs(u.createdAt)) : '—';
                    const seenMs = toMs(u.lastSeen);
                    const expiry = getExpiry(u);
                    return (
                      <div key={u._id} className="user-card">
                        <div className="uc-head">
                          <div className="uc-email">{u.email || u._id}</div>
                          <span className={`uc-badge ${status.cls}`}>{status.label}</span>
                        </div>
                        <div className="uc-seen" title={fmtDateTime(seenMs)}>
                          <span className="uc-seen-k">Last seen</span>
                          <span className={`seen seen-${seenTone(seenMs)}`}>
                            <span className="seen-dot" />
                            <span className="seen-text">{timeAgo(seenMs)}</span>
                          </span>
                        </div>
                        <div className="uc-meta">
                          <div>
                            <span className="uc-k">Registered</span>
                            <span className="uc-v">{registered}</span>
                          </div>
                          <div>
                            <span className="uc-k">Expires / Ends</span>
                            <span className="uc-v">{expiry}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
                <span className="page-info" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {filtered.length} user{filtered.length !== 1 ? 's' : ''} · Page {safePage} of {totalPages}
                </span>
                <div className="page-btns" style={{ display: 'flex', gap: 6 }}>
                  <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: safePage <= 1 ? 'not-allowed' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-2)', transition: 'all .15s', opacity: safePage <= 1 ? 0.35 : 1 }}>
                    ← Prev
                  </button>
                  <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-2)', transition: 'all .15s', opacity: safePage >= totalPages ? 0.35 : 1 }}>
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div id="toast" ref={toastRef} style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%) translateY(20px)', background: 'var(--ink)', color: 'var(--bg)', padding: '10px 18px', borderRadius: 20, fontSize: 12, fontWeight: 600, opacity: 0, transition: 'all .28s', pointerEvents: 'none', zIndex: 300, whiteSpace: 'nowrap' }} />
    </>
  );
}
