import { Timestamp } from "firebase/firestore";

// JSON has no Timestamp serialization: JSON.stringify reduces Firestore
// Timestamps to plain {seconds, nanoseconds} objects. Deep-walk a persisted
// value and restore every such object to a real Timestamp so consumers can
// keep calling Timestamp methods (toDate()/toMillis()) exactly as they do on
// live `doc.data()` rows. Numbers, strings, Dates and unknown shapes pass
// through untouched; recursion depth is bounded by row shape (2-3 levels).
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

export function reviveFirestoreTimestamps<T>(value: T): T {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => reviveFirestoreTimestamps(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    if (isTimestampLike(value)) {
      const ts = value as { seconds: number; nanoseconds: number };
      return new Timestamp(ts.seconds, ts.nanoseconds) as unknown as T;
    }
    const revived: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      revived[key] = reviveFirestoreTimestamps(entry);
    }
    return revived as unknown as T;
  }
  return value;
}
