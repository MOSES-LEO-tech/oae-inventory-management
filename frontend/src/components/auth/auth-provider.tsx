"use client";
import { ReactNode, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/config";
import { resolveUserSession } from "@/lib/firebase/auth";
import {
  cacheSession,
  clearCachedSession,
  getCachedSession,
} from "@/lib/firebase/session-cache";
import { useAuthStore } from "@/stores/auth-store";
import { useInventoryStore } from "@/stores/inventory-store";

// Custom hook to use auth state
export function useAuth() {
  const authStore = useAuthStore();
  return {
    isLoading: authStore.isLoading,
    isAuthenticated: !!authStore.user,
    user: authStore.user,
    setUser: authStore.setUser,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    // Restore the durable read cache (Phase B) before auth resolves so the
    // first paint after session recovery can use last-known data. SSR-safe:
    // skipHydration is set, so this only runs in the browser.
    useInventoryStore.persist.rehydrate();

    // Offline (or transient read failure) fallback: keep the last known-good
    // session for THIS uid. Offline, a null resolution can only come from a
    // failed read — detecting deactivation requires a successful membership
    // read. Online, null/failed resolution is a genuine negative and the
    // cached session is revoked.
    const retainOffline = (uid: string): boolean => {
      if (navigator.onLine) return false;
      const cached = getCachedSession();
      if (cached && cached.id === uid) {
        setUser(cached);
        return true;
      }
      return false;
    };

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
      // Skip session building while on /onboarding — the account exists but
      // facility/user/user-lookup docs may not be committed yet.
      if (window.location.pathname.startsWith("/onboarding")) return;

      if (!fbUser) {
        // Sign-out paths clear the cache before Firebase drops its auth
        // state, so a cache surviving here means the SDK lost auth without a
        // real sign-out (reload, tab restore, flaky auth persistence) —
        // grace-hydrate instead of dumping the user at /login.
        setUser(getCachedSession());
        return;
      }
      try {
        const profile = await resolveUserSession(fbUser);
        if (profile) {
          cacheSession(profile, fbUser.uid);
          setUser(profile);
          return;
        }
        if (retainOffline(fbUser.uid)) return;
        clearCachedSession();
        setUser(null);
      } catch (error) {
        console.error("Session resolution failed:", error);
        if (retainOffline(fbUser.uid)) return;
        clearCachedSession();
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, [setUser]);

  return <>{children}</>;
}
