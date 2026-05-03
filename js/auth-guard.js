import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVUXlnWPqtVQnqxHNyABktkFxnRj3mFvs",
  authDomain: "xautracker.firebaseapp.com",
  projectId: "xautracker",
  storageBucket: "xautracker.firebasestorage.app",
  messagingSenderId: "831752609455",
  appId: "1:831752609455:web:ea9be478691744afa73e5a"
};

/* Use same app name as login.html so auth state is shared */
let app;
try {
  app = getApp('login');
} catch {
  app = initializeApp(firebaseConfig, 'login');
}

const auth = getAuth(app);
const db   = getFirestore(app);

document.documentElement.style.visibility = 'hidden';

let redirected = false;

function safeRedirect(url) {
  if (redirected) return;
  redirected = true;
  window.location.href = url;
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    safeRedirect('login.html');
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));

    if (!snap.exists()) {
      safeRedirect('subscribe.html');
      return;
    }

    const d   = snap.data();
    const now = Date.now();

    const trialActive =
      d.trialEndsAt &&
      new Date(d.trialEndsAt).getTime() > now;

    const subscriptionActive =
      d.subscriptionStatus === 'active' &&
      d.currentPeriodEnd &&
      new Date(d.currentPeriodEnd).getTime() > now;

    const manualActive =
      d.manualAccess === true &&
      (!d.manualAccessExpiresAt ||
        new Date(d.manualAccessExpiresAt).getTime() > now);

    if (trialActive || subscriptionActive || manualActive) {
      document.documentElement.style.visibility = 'visible';
      return;
    }

    safeRedirect('subscribe.html');

  } catch (e) {
    console.error('Auth guard error:', e.message);
    document.documentElement.style.visibility = 'visible';
  }
});
