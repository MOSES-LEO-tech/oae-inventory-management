"use client";

import { useState, useEffect } from "react";
import { updatePassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { sendPasswordReset } from "@/lib/firebase/auth";
import { LOGO_DATA_URL } from "@/lib/logo-data";

/**
 * First-time password set for email-link invitees (Medicore parity, Firebase-native).
 * Reached only right after signInWithEmailLink, which satisfies Firebase's
 * requires-recent-login check — so updatePassword succeeds without re-auth.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      setReady(true);
      return;
    }
    // Firebase may still be restoring the session from persistence.
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) {
        setReady(true);
      } else {
        router.replace("/auth/signin");
      }
    });
    return () => unsub();
  }, [router]);

  const dashboardRoute = user?.isSuperAdmin
    ? "/super-admin/dashboard"
    : "/dashboard";

  const handleSkip = () => router.replace(dashboardRoute);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const auth = getFirebaseAuth();
      const current = auth.currentUser;
      if (!current) throw new Error("Session expired. Please sign in again.");
      await updatePassword(current, password);
      toast.success("Password set. Welcome aboard!");
      router.replace(dashboardRoute);
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "auth/weak-password") {
        setError("Password is too weak. Use at least 8 characters.");
      } else if (code === "auth/requires-recent-login") {
        // Sign-in happened too long ago — offer the reset-email path instead.
        try {
          if (user?.email) await sendPasswordReset(user.email);
          setError(
            "For security we've sent a password reset link to your email. Set your password there, then sign in."
          );
        } catch {
          setError("Session expired. Please sign in again.");
        }
      } else {
        setError("Could not set password. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-2.5">
        <img src={LOGO_DATA_URL} alt="OAE Logo" className="h-9 w-auto" />
        <span className="font-heading text-xl font-semibold tracking-tight text-ink">
          InventoryOS
        </span>
      </div>

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-hairline bg-paper p-6 shadow-subtle sm:p-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold">Set your password</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re signed in. Create a password so you can sign in with email
              and password next time.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={show ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <Button type="submit" className="w-full min-h-[44px]" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting password...
              </>
            ) : (
              "Set password & continue"
            )}
          </Button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
