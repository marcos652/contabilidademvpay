import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyApwNR-FiAuYpQEfzVGkm9X3B8xTdTIJ2s',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'contabilidademvpay.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'contabilidademvpay',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'contabilidademvpay.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '445769809483',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:445769809483:web:0524b444af8a3bf62897ce',
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
