// Firebase configuration for ZWash
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyA494dTlkaD2_xhYlOPpycejd3oC85siJE",
  authDomain: "zwash-45167.firebaseapp.com",
  projectId: "zwash-45167",
  storageBucket: "zwash-45167.firebasestorage.app",
  messagingSenderId: "185894598420",
  appId: "1:185894598420:web:42202806e41ff24f67f401",
  measurementId: "G-4WS00MZJ5H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;
