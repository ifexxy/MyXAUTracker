/* js/auth-guard.js
   Add as the FIRST script in predict.html:
   <script type="module" src="js/auth-guard.js"></script>

   Checks all three access paths in order:
   1. Manual access (admin granted)
   2. Active subscription (Flutterwave paid)
   3. Active free trial (3 days for new users)

   Redirects to login.html or subscribe.html if none match.
*/

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
apiKey: "AIzaSyCVUXlnWPqtVQnqxHNyABktkFxnRj3mFvs",
  authDomain: "xautracker.firebaseapp.com",
  databaseURL: "https://xautracker-default-rtdb.firebaseio.com",
  projectId: "xautracker",
  storageBucket: "xautracker.firebasestorage.app",
  messagingSenderId: "831752609455",
  appId: "1:831752609455:web:ea9be478691744afa73e5a"
};

const app  = getApps().find(a => a.name === 'guard')
          || initializeApp(firebaseConfig, 'guard');
const auth = getAuth(app);
const db   = getFirestore(app);

/* Hide page immediately — shown only after access confirmed */
const contentEl = document.getElementById('content');
if (contentEl) contentEl.style.visibility = 'hidden';

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'login.html'; return; }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { window.location.href = 'login.html'; return; }

    const d   = snap.data();
    const now = Date.now();

    /* ── Access checks ── */
    const trialActive  = d.trialEndsAt
                      && new Date(d.trialEndsAt).getTime() > now;

    const subActive    = d.subscriptionStatus === 'active'
                      && d.currentPeriodEnd
                      && new Date(d.currentPeriodEnd).getTime() > now;

    const manualActive = d.manualAccess === true
                      && (
                           !d.manualAccessExpiresAt ||
                           new Date(d.manualAccessExpiresAt).getTime() > now
                         );

    if (!trialActive && !subActive && !manualActive) {
      window.location.href = 'subscribe.html';
      return;
    }

    /* ── Show content ── */
    if (contentEl) contentEl.style.visibility = 'visible';

    /* ── Status banner ── */
    let bannerHtml = null;

    if (manualActive && !subActive) {
      const expiry = d.manualAccessExpiresAt
        ? `Expires ${new Date(d.manualAccessExpiresAt).toLocaleDateString('en-US', {
            day: 'numeric', month: 'short', year: 'numeric'
          })}`
        : 'Permanent access';
      bannerHtml = `
        <span style="display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-shield-halved"></i>
          <strong>Complimentary Access</strong> · ${expiry}
        </span>`;

    } else if (trialActive && !subActive) {
      const msLeft    = new Date(d.trialEndsAt).getTime() - now;
      const hoursLeft = Math.ceil(msLeft / 3600000);
      const daysLeft  = Math.ceil(msLeft / 86400000);
      const timeLabel = daysLeft > 1
        ? `${daysLeft} days`
        : hoursLeft > 1
          ? `${hoursLeft} hours`
          : 'less than 1 hour';
      bannerHtml = `
        <span style="display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-clock"></i>
          <strong>${timeLabel} left</strong> in your free trial
        </span>
        <a href="subscribe.html"
           style="color:#000;background:var(--gold);padding:5px 12px;
                  border-radius:8px;font-size:11px;font-weight:700;
                  text-decoration:none;white-space:nowrap;">
          Upgrade Now
        </a>`;

    } else if (subActive && d.subscriptionStatus === 'cancelled') {
      const until = d.currentPeriodEnd
        ? new Date(d.currentPeriodEnd).toLocaleDateString('en-US', {
            day: 'numeric', month: 'short', year: 'numeric'
          })
        : '';
      bannerHtml = `
        <span style="display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-circle-exclamation" style="color:var(--red)"></i>
          Cancelled — access ends <strong>${until}</strong>
        </span>
        <a href="subscribe.html"
           style="color:#000;background:var(--gold);padding:5px 12px;
                  border-radius:8px;font-size:11px;font-weight:700;
                  text-decoration:none;white-space:nowrap;">
          Resubscribe
        </a>`;
    }

    if (bannerHtml && contentEl) {
      const banner = document.createElement('div');
      banner.style.cssText = `
        margin:12px 16px 0;padding:10px 14px;
        background:var(--gold-glow);border:1px solid var(--gold-dim);
        border-radius:10px;font-size:12px;color:var(--gold);
        display:flex;align-items:center;justify-content:space-between;
        gap:10px;flex-wrap:wrap;`;
      banner.innerHTML = bannerHtml;
      contentEl.prepend(banner);
    }

  } catch (e) {
    console.error('[auth-guard]', e.message);
    window.location.href = 'login.html';
  }
});
