import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { fbConfig } from './firebase-config';

const app = getApps().length ? getApp() : initializeApp(fbConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
