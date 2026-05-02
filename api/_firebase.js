/* api/_firebase.js
   Shared Firebase Admin SDK initializer.
   Imported by every serverless function that needs Firestore or Auth.
   The underscore prefix means Vercel does NOT expose this as an API route.
*/

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';
import { getAuth }                       from 'firebase-admin/auth';

function init() {
  if (getApps().length > 0) return getApps()[0];

  /* These three env vars come from your Firebase service account JSON.
     Set them in Vercel → Project → Settings → Environment Variables.
     For FIREBASE_PRIVATE_KEY, paste the full key including -----BEGIN...
     Vercel stores it as-is; the .replace below handles escaped newlines. */
  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

init();

export const db        = getFirestore();
export const adminAuth = getAuth();
