"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
import { User } from "firebase/auth";
import { onAuthChange, getCurrentUserProfile } from "@/lib/firebase/auth";
import { useAuthStore } from "@/stores/auth-store";

const AuthContext = createContext<{
  isLoading: boolean;
  isAuthenticated: boolean;
}>({ isLoading: true, isAuthenticated: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setLoading, clearUser, isLoading, isAuthenticated } =
    useAuthStore();

  useEffect(() => {
    // DEV BYPASS: If no Firebase config, use mock user for preview.
    // Optional `?role=admin|manager|clerk` query param lets you preview
    // each role's dashboard in separate tabs side by side.
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "your-api-key" || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const roleParam = new URLSearchParams(window.location.search).get("role");
      const previewRole =
        roleParam === "clerk" || roleParam === "manager" ? roleParam : "admin";
      const previewName =
        previewRole === "admin"
          ? "Admin User"
          : previewRole === "manager"
            ? "Store Manager"
            : "Sales Clerk";
      setUser({
        uid: "dev-user-001",
        name: previewName,
        email: `preview-${previewRole}@oae.dev`,
        role: previewRole,
        storeId: previewRole === "manager" ? "store-b" : "main-stores",
      });
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          const profile = await getCurrentUserProfile(firebaseUser.uid);
          if (profile) {
            setUser(profile);
          } else {
            clearUser();
          }
        } catch {
          clearUser();
        }
      } else {
        clearUser();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading, clearUser]);

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
