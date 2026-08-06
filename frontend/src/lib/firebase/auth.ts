import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./config";
import { AppUser } from "@/types";

export async function signIn(email: string, password: string): Promise<AppUser> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  const credential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", credential.user.uid));

  if (!userDoc.exists()) {
    throw new Error("User profile not found. Contact an administrator.");
  }

  const userData = userDoc.data() as Omit<AppUser, "uid">;
  return { uid: credential.user.uid, ...userData };
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentUserProfile(uid: string): Promise<AppUser | null> {
  const db = getFirebaseDb();
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) return null;
  const data = userDoc.data() as Omit<AppUser, "uid">;
  return { uid, ...data };
}
