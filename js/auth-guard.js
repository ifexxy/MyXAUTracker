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

const app  = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig, 'auth-guard');
const auth = getAuth(app);
const db   = getFirestore(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      window.location.href = 'subscribe.html';
      return;
    }

    const d   = snap.data();
    const now = Date.now();

    const trialActive =
      d.trialEndsAt && new Date(d.trialEndsAt).getTime() > now;

    const subscriptionActive =
      d.subscriptionStatus === 'active' &&
      d.currentPeriodEnd &&
      new Date(d.currentPeriodEnd).getTime() > now;

    const manualActive =
      d.manualAccess === true &&
      (!d.manualAccessExpiresAt ||
        new Date(d.manualAccessExpiresAt).getTime() > now);

    if (trialActive || subscriptionActive || manualActive) {
      /* Access granted — do nothing, page loads normally */
      return;
    }

    /* No valid access — send to subscribe */
    window.location.href = 'subscribe.html';

  } catch (e) {
    console.error('Auth guard error:', e);
    window.location.href = 'subscribe.html';
  }
});
