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

// Facility-scoped collection path helpers
export function facilityCol(facilityId: string, subcollection: string) {
  return collection(db(), "facilities", facilityId, subcollection);
}

export function facilityDoc(facilityId: string, subcollection: string, docId: string) {
  // Empty subcollection targets the facility's root document
  // (e.g. fetchStores/fetchFacilitySettings pass "" to read facilities/{fid}).
  return subcollection
    ? doc(db(), "facilities", facilityId, subcollection, docId)
    : doc(db(), "facilities", facilityId);
}

export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const docRef = doc(db(), collectionName, docId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as T;
}

export async function getFacilityDocument<T>(
  facilityId: string,
  subcollection: string,
  docId: string
): Promise<T | null> {
  const docRef = facilityDoc(facilityId, subcollection, docId);
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

export async function getFacilityDocuments<T>(
  facilityId: string,
  subcollection: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const q = query(facilityCol(facilityId, subcollection), ...constraints);
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

export async function addFacilityDocument<T extends Record<string, unknown>>(
  facilityId: string,
  subcollection: string,
  data: T
): Promise<string> {
  const docRef = await addDoc(facilityCol(facilityId, subcollection), {
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

export async function updateFacilityDocument<T extends Record<string, unknown>>(
  facilityId: string,
  subcollection: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  const docRef = facilityDoc(facilityId, subcollection, docId);
  await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  const docRef = doc(db(), collectionName, docId);
  await deleteDoc(docRef);
}

export async function deleteFacilityDocument(
  facilityId: string,
  subcollection: string,
  docId: string
): Promise<void> {
  const docRef = facilityDoc(facilityId, subcollection, docId);
  await deleteDoc(docRef);
}

export { db, collection, doc, query, where, orderBy, limit, writeBatch, Timestamp };
export const getDb = db;
export type { QueryConstraint };
