import { initializeApp, getApps }
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

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

document.documentElement.style.visibility = 'hidden';

let redirected = false;

function safeRedirect(url) {
  if (redirected) return;
  redirected = true;
  window.location.href = url;
}

/* Give Firebase 3 seconds max to restore session */
const timeout = setTimeout(() => {
  if (!redirected) {
    safeRedirect('login.html');
  }
}, 3000);

onAuthStateChanged(auth, async user => {
  clearTimeout(timeout);

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
    /* On any error show the page rather than loop */
    document.documentElement.style.visibility = 'visible';
  }
});
