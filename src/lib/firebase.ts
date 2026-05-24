import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCVUXlnWPqtVQnqxHNyABktkFxnRj3mFvs',
  authDomain: 'xautracker.firebaseapp.com',
  projectId: 'xautracker',
  storageBucket: 'xautracker.firebasestorage.app',
  messagingSenderId: '831752609455',
  appId: '1:831752609455:web:ea9be478691744afa73e5a',
};

let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

export function getFirebase() {
  if (app) return { app, auth: auth!, db: db! };
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  return { app, auth, db };
}

export { getAuth, getFirestore };
