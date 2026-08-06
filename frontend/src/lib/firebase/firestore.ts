import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "./config";

// Generic CRUD helpers — extend as needed per collection

const db = () => getFirebaseDb();

export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const docRef = doc(db(), collectionName, docId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as T;
}

export async function getDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const q = query(collection(db(), collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export async function addDocument<T extends Record<string, unknown>>(
  collectionName: string,
  data: T
): Promise<string> {
  const docRef = await addDoc(collection(db(), collectionName), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateDocument<T extends Record<string, unknown>>(
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  const docRef = doc(db(), collectionName, docId);
  await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  const docRef = doc(db(), collectionName, docId);
  await deleteDoc(docRef);
}

export { db, collection, doc, query, where, orderBy, limit, writeBatch, Timestamp };
export type { QueryConstraint };
