import { fbConfig } from './firebase-config.js';
import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app  = getApps().length ? getApps()[0] : initializeApp(fbConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace('/login');
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { window.location.replace('/login'); return; }

    const d   = snap.data();
    const now = Date.now();
    const hasAccess =
      (d.trialEndsAt && new Date(d.trialEndsAt).getTime() > now) ||
      (d.subscriptionStatus === 'active' && d.currentPeriodEnd && new Date(d.currentPeriodEnd).getTime() > now) ||
      (d.manualAccess && (!d.manualAccessExpiresAt || new Date(d.manualAccessExpiresAt).getTime() > now));

    if (!hasAccess) window.location.replace('/subscribe');
  } catch {
    window.location.replace('/login');
  }
});
