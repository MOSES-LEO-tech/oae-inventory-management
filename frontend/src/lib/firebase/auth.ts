import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  getIdTokenResult,
  User,
  UserCredential,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collectionGroup,
  query,
  where,
  limit,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./config";
import { clearCachedSession } from "./session-cache";
import type { FacilityUser, OnboardingData } from "@/types";
import { getDutiesForJobTitle } from "@/stores/auth-store";

const TRIAL_DAYS = 30;

/**
 * Resolve the app session for a Firebase Auth user (client-side, no server session).
 * Tier 1: custom claim isSuperAdmin
 * Tier 2: superAdmin/{uid} document (singular, matches firestore.rules)
 * Tier 3: user-lookup/{uid} -> facilities/{facilityId}/users/{uid}
 * Tier 4: first sign-in via staff email-link invitation (invite-index)
 */
// The auth-state listener (auth-provider) and the login form both call this
// the instant an email-link sign-in completes. Concurrent resolutions would
// both attempt invite materialization; the second setDoc over an
// already-created doc evaluates as an UPDATE, and user-lookup updates are
// super-admin-only → "permission-denied" thrown into the login handler.
// Share one in-flight promise per uid; cleared on settle so failures retry.
const inFlightSessions = new Map<string, Promise<FacilityUser | null>>();

export function resolveUserSession(user: User): Promise<FacilityUser | null> {
  const pending = inFlightSessions.get(user.uid);
  if (pending) return pending;
  const promise = resolveUserSessionUncached(user).finally(() => {
    inFlightSessions.delete(user.uid);
  });
  inFlightSessions.set(user.uid, promise);
  return promise;
}

async function resolveUserSessionUncached(
  user: User
): Promise<FacilityUser | null> {
  const db = getFirebaseDb();

  // Tier 1: custom claim
  try {
    const token = await getIdTokenResult(user);
    if (token.claims.isSuperAdmin === true) {
      return buildSuperAdminSession(user);
    }
  } catch (e) {
    console.warn("[Auth] Custom claim check failed, falling back to doc lookup:", e);
  }

  // Tier 2: super admin document
  try {
    const saDoc = await getDoc(doc(db, "superAdmin", user.uid));
    if (saDoc.exists()) {
      return buildSuperAdminSession(user);
    }
  } catch (e) {
    console.warn("[Auth] superAdmin doc lookup failed:", e);
  }

  // Tier 3: facility user via lookup (with retry for Firestore eventual consistency)
  let facilityId: string | undefined;
  const maxRetries = 3;
  const baseDelay = 300; // ms
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const lookup = await getDoc(doc(db, "user-lookup", user.uid));
      if (lookup.exists()) {
        facilityId = lookup.data().facilityId as string | undefined;
        break;
      }
      // Document doesn't exist yet - wait before retry (eventual consistency)
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // 300ms, 600ms, 1200ms
        console.log(`[Auth] user-lookup not found, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (e) {
      console.error("[Auth] user-lookup read failed:", e);
      if (attempt === maxRetries - 1) return null;
    }
  }
  // Tier 4: first sign-in via staff email-link invitation — materialize
  // membership + user-lookup from invite-index/{lowercasedEmail} (written
  // atomically with the placeholder at invite time) and consume the invite.
  if (!facilityId && user.email) {
    const profile = await materializeFromInvite(
      db,
      user,
      user.email.toLowerCase()
    );
    if (profile) return profile;
  }

  if (!facilityId) return null;

  try {
    const userSnap = await getDoc(
      doc(db, "facilities", facilityId, "users", user.uid)
    );
    if (!userSnap.exists()) {
      // Heal: an interrupted invite sign-in can leave a stale user-lookup
      // with no membership row (and a consumed invite). If the admin has
      // re-invited, invite-index resolves again — materialize from it.
      if (user.email) {
        const healed = await materializeFromInvite(
          db,
          user,
          user.email.toLowerCase()
        );
        if (healed) return healed;
      }
      return null;
    }
    const membership = userSnap.data() as Omit<FacilityUser, "id">;
    // Deactivated staff are blocked from signing in entirely.
    if (membership.active === false) {
      console.warn("[Auth] Deactivated staff attempted sign-in:", user.email);
      return null;
    }
    // facilityId comes from the user-lookup path; older membership docs may
    // lack the field, so guarantee it on the session object.
    return { id: user.uid, ...membership, facilityId };
  } catch (e) {
    console.error("[Auth] Facility membership read failed:", e);
    return null;
  }
}

/**
 * Tier 4 / heal path: materialize a staff membership from an invitation.
 * Primary source: invite-index/{lowercasedEmail} — a deterministic getDoc by
 * ID: no query, no index, no collection-group rule, nothing to deny.
 * Medicore does this server-side (sync-user); this is the client-side
 * equivalent. Idempotent: existence-checks both docs first so a repeated or
 * concurrent run never turns the creates into rules-denied updates, and the
 * stale-placeholder sweep never deletes the just-created membership doc.
 */
async function materializeFromInvite(
  db: Firestore,
  user: User,
  emailKey: string
): Promise<FacilityUser | null> {
  let inviteDoc: DocumentSnapshot | null = null;
  try {
    inviteDoc = await getDoc(doc(db, "invite-index", emailKey));
  } catch (e) {
    console.warn("[Auth] invite-index read failed:", e);
  }
  if (!inviteDoc?.exists()) {
    try {
      const inviteSnap = await getDocs(
        query(
          collectionGroup(db, "users"),
          where("email", "==", emailKey),
          limit(1)
        )
      );
      if (!inviteSnap.empty) inviteDoc = inviteSnap.docs[0];
    } catch (e) {
      console.warn("Invite resolution skipped:", e);
    }
  }
  const fid = inviteDoc?.data()?.facilityId ?? inviteDoc?.ref.parent.parent?.id;
  if (!inviteDoc || !fid) return null;
  const data = inviteDoc.data() as Omit<FacilityUser, "id">;

  // Create ONLY missing docs: a repeat/concurrent run must not setDoc over
  // an existing doc (evaluates as UPDATE; user-lookup update is
  // super-admin-only → permission-denied).
  const membershipRef = doc(db, "facilities", fid, "users", user.uid);
  const lookupRef = doc(db, "user-lookup", user.uid);
  let membershipExists = false;
  let lookupExists = false;
  try {
    const [membershipSnap, lookupSnap] = await Promise.all([
      getDoc(membershipRef),
      getDoc(lookupRef),
    ]);
    membershipExists = membershipSnap.exists();
    lookupExists = lookupSnap.exists();
  } catch {
    // Reading not-yet-created docs can be denied by rules (null resource) —
    // treat as missing; the create rules below will still pass or fail with
    // a clear error surfaced by the batch commit.
  }
  if (!membershipExists || !lookupExists) {
    const batch = writeBatch(db);
    if (!membershipExists) {
      batch.set(membershipRef, {
        ...data,
        id: user.uid,
        facilityId: fid,
        // Preserve a pre-signin deactivation (admin may have disabled the
        // invite placeholder before the member ever signed in).
        active: data.active !== false,
        onboarded: true,
        lastLoginAt: serverTimestamp(),
      });
    }
    if (!lookupExists) {
      // Self-heal user-lookup (Medicore sync-user parity) — the keystone
      // doc for all non-superadmin authorization.
      batch.set(lookupRef, {
        email: emailKey,
        facilityId: fid,
        role: data.role ?? "staff",
        createdAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (e) {
      // Nothing was written (batch is atomic) — surface as unresolved
      // session instead of throwing into the login handler.
      console.error("[Auth] Invite materialization failed:", e);
      return null;
    }
  }

  try {
    await deleteDoc(inviteDoc.ref);
    // Sweep legacy placeholder rows from duplicate invite sends (pre-batch
    // era) — NEVER the membership doc we just materialized (same email).
    const stale = await getDocs(
      query(collectionGroup(db, "users"), where("email", "==", emailKey))
    );
    for (const d of stale.docs) {
      if (d.ref.parent.parent?.id === fid && d.ref.id === user.uid) continue;
      await deleteDoc(d.ref);
    }
  } catch (e) {
    // Placeholder cleanup is best-effort; stale rows are cosmetic.
    console.warn("[Auth] Invite placeholder cleanup skipped:", e);
  }

  return {
    ...data,
    id: user.uid,
    facilityId: fid,
    normalizedEmail: emailKey,
    active: data.active !== false,
    onboarded: true,
  };
}

function buildSuperAdminSession(user: User): FacilityUser {
  return {
    id: user.uid,
    facilityId: "",
    name: user.displayName || "Super Admin",
    email: user.email || "",
    normalizedEmail: (user.email || "").toLowerCase(),
    jobTitle: "Super Admin",
    role: "admin",
    duties: getDutiesForJobTitle("Admin"),
    storeIds: [],
    active: true,
    onboarded: true,
    invitedBy: "system",
    invitedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    isSuperAdmin: true,
  };
}

/**
 * Complete onboarding (client-side).
 * 1. Create the Firebase Auth account (or recover an orphaned one)
 * 2. Reuse facilityId on retry via user-lookup
 * 3. Atomic batch: facilities/{fid} + facilities/{fid}/users/{uid} + user-lookup/{uid}
 * 4. Best-effort trial license at licenses/{fid} (top-level, keyed by facilityId)
 * 5. Sign out — login happens through the normal sign-in flow afterwards
 */
export async function completeOnboarding(
  data: OnboardingData
): Promise<{ facilityId: string }> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const email = data.adminEmail.trim().toLowerCase();

  // 1. Create the account, or sign into an orphaned one from a failed attempt
  let cred: UserCredential;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, data.adminPassword);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "auth/email-already-in-use"
    ) {
      cred = await signInWithEmailAndPassword(auth, email, data.adminPassword);
    } else {
      throw err;
    }
  }
  const uid = cred.user.uid;

  // 2. Idempotent facilityId — reuse on retry after partial failure
  let facilityId = crypto.randomUUID();
  try {
    const existingLookup = await getDoc(doc(db, "user-lookup", uid));
    const existingFacilityId = existingLookup.exists()
      ? (existingLookup.data().facilityId as string | undefined)
      : undefined;
    if (existingFacilityId) facilityId = existingFacilityId;
  } catch (e) {
    console.warn("[Auth] Facility reuse check failed, minting fresh facilityId:", e);
  }

  // 3. Atomic writes
  const trialEndsAt = addDays(new Date(), TRIAL_DAYS);
  const batch = writeBatch(db);

  batch.set(doc(db, "facilities", facilityId), {
    id: facilityId,
    name: data.businessName,
    businessType: data.businessType,
    facilityType: data.facilityType,
    stores: data.stores.map((s, i) => ({
      id: `store-${i + 1}`,
      name: s.name,
      type: s.type,
      address: s.address || null,
      isActive: true,
    })),
    currency: data.currency,
    phone: data.phone || null,
    adminEmail: email,
    address: data.address || null,
    createdAt: serverTimestamp(),
    onboardingCompletedAt: serverTimestamp(),
    licenseStatus: "trial",
    trialEndsAt: Timestamp.fromDate(trialEndsAt),
    settings: {
      defaultStoreId: "store-1",
      allowNegativeStock: false,
      requireTransferApproval: true,
      lowStockAlertEnabled: true,
      currency: data.currency,
      timezone: "Africa/Kampala",
    },
  });

  batch.set(doc(db, "facilities", facilityId, "users", uid), {
    id: uid,
    facilityId,
    name: data.adminName,
    email,
    normalizedEmail: email,
    phone: data.adminPhone || null,
    jobTitle: "Admin",
    role: "admin",
    duties: getDutiesForJobTitle("Admin"),
    storeIds: [],
    active: true,
    onboarded: true,
    invitedAt: serverTimestamp(),
    invitedBy: "system",
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, "user-lookup", uid), {
    email,
    facilityId,
    role: "admin",
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  // 4. Best-effort trial license (non-fatal on failure)
  try {
    await setDoc(
      doc(db, "licenses", facilityId),
      {
        facilityId,
        status: "trial",
        tier: "standard",
        currency: data.currency,
        createdBy: "self",
        notes: "",
        trialStartedAt: new Date().toISOString(),
        trialEndsAt: trialEndsAt.toISOString(),
        trialEndsAtTs: Timestamp.fromDate(trialEndsAt),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Trial license write skipped:", err);
  }

  // 5. End the auto-signin so no half-built session gets cached
  // (also drop any prior user's offline session cache before the auth
  // state change fires, so the listener can never resurrect it)
  clearCachedSession();
  await firebaseSignOut(auth);

  return { facilityId };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function signOut(): Promise<void> {
  // Clear the offline session cache BEFORE the SDK drops its auth state —
  // the listener's null emission must never resurrect a signed-out user.
  // Every logout path in the app routes through this wrapper.
  clearCachedSession();
  // Drop the service worker's cached page HTML too, so a signed-out browser
  // holds no authenticated shells (best-effort: dev has no service worker).
  navigator.serviceWorker?.controller?.postMessage({
    type: "CLEAR_NAV_CACHE",
  });
  await firebaseSignOut(getFirebaseAuth());
}

export async function sendPasswordReset(email: string): Promise<void> {
  // The reset email must go out now — this flow cannot be queued offline.
  if (!navigator.onLine) {
    throw new Error(
      "Password reset requires an internet connection. Please reconnect and try again."
    );
  }
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}
