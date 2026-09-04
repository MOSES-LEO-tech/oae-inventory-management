import {
  collection,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import type { Currency, Facility, Store, FacilitySettings } from "@/types";

export async function getFacility(facilityId: string): Promise<Facility | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, "facilities", facilityId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as Facility;
}

export async function getFacilities(): Promise<Facility[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, "facilities")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Facility));
}

export async function createFacility(
  data: Omit<Facility, "id" | "createdAt" | "onboardingCompletedAt" | "licenseStatus" | "trialEndsAt">
): Promise<string> {
  const db = getDb();
  const facilityId = `fac_${Date.now().toString(36)}`;

  await setDoc(doc(db, "facilities", facilityId), {
    ...data,
    id: facilityId,
    createdAt: serverTimestamp(),
    onboardingCompletedAt: serverTimestamp(),
    licenseStatus: "trial",
    trialEndsAt: timestampFromDays(30),
  });

  return facilityId;
}

export async function createStore(
  facilityId: string,
  store: Omit<Store, "id"> & { id?: string }
): Promise<string> {
  const db = getDb();
  const storeId = store.id || `store_${Date.now().toString(36)}`;

  const facilityRef = doc(db, "facilities", facilityId);
  const facilitySnap = await getDoc(facilityRef);
  if (!facilitySnap.exists()) throw new Error("Facility not found");

  const facilityData = facilitySnap.data() as Facility;
  const updatedStores = [...facilityData.stores, { ...store, id: storeId }];

  await setDoc(facilityRef, {
    stores: updatedStores,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return storeId;
}

export async function getFacilityStores(facilityId: string): Promise<Store[]> {
  const facility = await getFacility(facilityId);
  return facility?.stores ?? [];
}

export async function updateFacilityProfile(
  facilityId: string,
  updates: { name?: string; currency?: Currency; settings?: FacilitySettings }
): Promise<void> {
  const db = getDb();
  await setDoc(
    doc(db, "facilities", facilityId),
    { ...updates, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

function timestampFromDays(days: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return Timestamp.fromDate(d);
}