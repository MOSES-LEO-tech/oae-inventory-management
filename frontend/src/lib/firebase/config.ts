import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
  Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    // initializeFirestore is required for custom settings in firebase v12 —
    // passing settings to getFirestore() misparses them as a database ID.
    // Browser: single-tab IndexedDB persistence keeps the app offline-first.
    // Node/prerender: memory cache (IndexedDB does not exist there).
    // Signatures verified against @firebase/firestore index.d.ts (v12.17).
    db = initializeFirestore(getFirebaseApp(), {
      localCache:
        typeof window !== "undefined"
          ? persistentLocalCache({
              cacheSizeBytes: 50 * 1024 * 1024, // 50MB
              tabManager: persistentSingleTabManager({ forceOwnership: false }),
            })
          : memoryLocalCache(),
    });
  }
  return db;
}

export { getFirebaseApp };
