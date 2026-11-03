// Digi Store - Shared Firebase Modular Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export const firebaseConfig = {
  projectId: "gen-lang-client-0131035247",
  appId: "1:597772284805:web:237d20f70eedd2a42b8aec",
  apiKey: "AIzaSyBKFpdO_IJ78AsnbAHsAmKgJOJVU7Prcas",
  authDomain: "gen-lang-client-0131035247.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-digistoreadvance-09f27aee-e9c9-48cc-b04c-c6396f12f523",
  storageBucket: "gen-lang-client-0131035247.firebasestorage.app",
  messagingSenderId: "597772284805"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
