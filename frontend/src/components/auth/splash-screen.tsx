import { LOGO_DATA_URL } from "@/lib/logo-data";

/**
 * Full-screen splash shown briefly after successful authentication.
 * Uses the base64-encoded OAE mark so it renders identically offline,
 * on desktop and mobile alike. Mirrors the Legacy Medicore loading style
 * (centered mark + thin spinning ring).
 */
export function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background"
      role="status"
      aria-label="Signing you in"
    >
      {/* Transparent logo blends directly into the splash background — no container */}
      <img src={LOGO_DATA_URL} alt="OAE Logo" className="h-24 w-auto" />
      <span className="font-heading text-xl font-semibold tracking-tight">InventoryOS</span>
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}
