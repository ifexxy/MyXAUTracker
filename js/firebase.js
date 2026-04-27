/* js/firebase.js
   Shared Firebase init — loaded by both admin.html and news.html */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVUXlnWPqtVQnqxHNyABktkFxnRj3mFvs",
    authDomain: "xautracker.firebaseapp.com",
    projectId: "xautracker",
    storageBucket: "xautracker.firebasestorage.app",
    messagingSenderId: "831752609455",
    appId: "1:831752609455:web:ea9be478691744afa73e5a"
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);
