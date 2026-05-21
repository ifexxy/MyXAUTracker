import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { fbConfig } from './firebase-config';

let appInstance;

function hasFirebaseClientConfig() {
  return Boolean(
    fbConfig.apiKey &&
    fbConfig.authDomain &&
    fbConfig.projectId &&
    fbConfig.appId
  );
}

export function getFirebaseApp() {
  if (!hasFirebaseClientConfig()) {
    throw new Error(
      'Firebase client config is missing. Set NEXT_PUBLIC_FIREBASE_* values in your environment.'
    );
  }

  if (!appInstance) {
    appInstance = getApps().length ? getApp() : initializeApp(fbConfig);
  }

  return appInstance;
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}

export { hasFirebaseClientConfig };
