import { Timestamp } from "firebase/firestore";
import type { FacilityUser } from "@/types";

// Offline session grace: a small localStorage snapshot of the last resolved
// session so a reload while offline — or a transient auth-null while the SDK
// reconnects — keeps the user signed in instead of dumping them at /login.
// Pattern proven in production by Legacy Medicore (`jl_auth_session`).
// Cleared on every sign-out path BEFORE Firebase drops its auth state, so a
// null auth emission can never resurrect a signed-out user.
const SESSION_KEY = "inv_auth_session";
const SESSION_EXPIRY_DAYS = 7;
const MAX_AGE_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

interface CachedSession {
  session: FacilityUser;
  firebaseUid: string;
  cachedAt: number;
}

function isTimestampLike(
  value: unknown
): value is { seconds: number; nanoseconds: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { seconds?: unknown }).seconds === "number" &&
    typeof (value as { nanoseconds?: unknown }).nanoseconds === "number"
  );
}

// JSON has no Timestamp serialization — `JSON.stringify` reduces Firestore
// Timestamps to plain {seconds, nanoseconds} objects, and session consumers
// call real Timestamp methods (e.g. `user.createdAt.toDate()` on the profile
// page). Revive the three Timestamp fields on every read.
function reviveSession(session: FacilityUser): FacilityUser {
  const revived = { ...session } as FacilityUser & Record<string, unknown>;
  for (const field of ["invitedAt", "lastLoginAt", "createdAt"] as const) {
    const value: unknown = revived[field];
    if (isTimestampLike(value)) {
      revived[field] = new Timestamp(value.seconds, value.nanoseconds);
    }
  }
  return revived;
}

export function cacheSession(profile: FacilityUser, firebaseUid: string): void {
  try {
    // Never cache a half-built session. Super-admins legitimately have no
    // facilityId — hence the isSuperAdmin escape.
    if (!profile.facilityId && !profile.isSuperAdmin) return;
    const cached: CachedSession = {
      session: profile,
      firebaseUid,
      cachedAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(cached));
  } catch {
    // Storage unavailable or over quota — offline grace silently degrades.
  }
}

export function getCachedSession(): FacilityUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    let cached: CachedSession;
    try {
      cached = JSON.parse(raw) as CachedSession;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (!cached?.session?.id || typeof cached.firebaseUid !== "string") {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (!cached.cachedAt || Date.now() - cached.cachedAt > MAX_AGE_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return reviveSession(cached.session);
  } catch {
    return null;
  }
}

export function clearCachedSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
