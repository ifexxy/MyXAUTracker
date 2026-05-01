/* api/_firebase.js
   ─────────────────────────────────────────────────────────────────
   Shared Firebase Admin SDK initializer.
   Underscore prefix = Vercel will NOT expose this as a route.
   Every serverless function imports { db, adminAuth } from here.

   Required Vercel Environment Variables:
     FIREBASE_PROJECT_ID     — e.g. xau-tracker-12345
     FIREBASE_CLIENT_EMAIL   — e.g. firebase-adminsdk-xxx@xau-tracker.iam.gserviceaccount.com
     FIREBASE_PRIVATE_KEY    — The full private key from the service account JSON.
                               In Vercel, paste it exactly as-is including newlines.
                               The .replace() below handles escaped \n automatically.

   How to get these values:
     Firebase Console → Project Settings → Service Accounts → Generate New Private Key
     Download the JSON file. Copy projectId, client_email, private_key into Vercel.
   ─────────────────────────────────────────────────────────────────
*/

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';
import { getAuth }                       from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const db        = getFirestore();
export const adminAuth = getAuth();
