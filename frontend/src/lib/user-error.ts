// Translate technical errors (Firebase auth/firestore codes, network
// failures) into short plain-English messages a non-technical user can act
// on. Anything unrecognized falls back to `fallback`, which should describe
// what the user was trying to do — never the underlying technology.
const CODE_MESSAGES: Record<string, string> = {
  // Auth
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/weak-password": "Password is too weak — use at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "You appear to be offline. Check your connection and try again.",
  "auth/user-disabled": "This account has been disabled. Contact your administrator.",
  "auth/requires-recent-login": "For security, please sign in again and retry.",
  // Firestore / storage
  "permission-denied": "You don't have permission to do that. Ask an admin if you think this is a mistake.",
  "unauthenticated": "Your session expired. Please sign in again.",
  "unavailable": "Can't reach the server right now. Check your connection and try again.",
  "failed-precondition": "This action needs an internet connection.",
  "aborted": "The request was interrupted. Please try again.",
  "deadline-exceeded": "This is taking too long. Please try again.",
  "not-found": "That record no longer exists. Refresh the page and try again.",
  "already-exists": "A record like this already exists.",
  "resource-exhausted": "Service limit reached. Please try again later.",
};

// Some failures carry only a message (fetch layer, browser network errors).
const MESSAGE_PATTERNS: [RegExp, string][] = [
  [/failed to fetch|networkerror|load failed|fetch failed|network request failed/i,
    "You appear to be offline. Check your connection and try again."],
  [/missing or insufficient permissions/i,
    "You don't have permission to do that. Ask an admin if you think this is a mistake."],
];

export function toUserMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const mapped = CODE_MESSAGES[String((error as { code: unknown }).code)];
    if (mapped) return mapped;
  }
  if (error instanceof Error && error.message) {
    for (const [pattern, message] of MESSAGE_PATTERNS) {
      if (pattern.test(error.message)) return message;
    }
  }
  return fallback;
}
