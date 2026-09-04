"use client";

import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, signInWithEmailLink, isSignInWithEmailLink } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import {
  Loader2,
  Boxes,
  ClipboardList,
  ShieldCheck,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { resolveUserSession, signOut } from "@/lib/firebase/auth";
import { useAuthStore } from "@/stores/auth-store";
import { LOGO_DATA_URL } from "@/lib/logo-data";
import { SplashScreen } from "@/components/auth/splash-screen";

interface LoginFormData {
  email: string;
  password: string;
}

const FEATURES = [
  {
    icon: Boxes,
    title: "Live stock levels",
    text: "Inventory across every store stays accurate as sales and deliveries happen.",
  },
  {
    icon: ClipboardList,
    title: "One movement ledger",
    text: "Stock-in, stock-out, transfers, and adjustments tracked in a single trail.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by role",
    text: "Duty-based access keeps every staff member in their lane.",
  },
];

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [linkStep, setLinkStep] = useState<"detecting" | "none" | "confirm" | "processing">("detecting");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkError, setLinkError] = useState("");
  const [showSplash, setShowSplash] = useState(false);
  const splashTimer = useRef<number | null>(null);

  const router = useRouter();
  const auth = getFirebaseAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  // Detect if the current URL is an email sign-in link (staff invitation flow).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Pre-fill email from localStorage (same-device completion).
      const savedEmail = window.localStorage.getItem("emailForSignIn");
      if (savedEmail) setLinkEmail(savedEmail);

      // Check if this is an email sign-in link (SDK-verified, not substring sniffing)
      if (isSignInWithEmailLink(auth, window.location.href)) {
        setLinkStep("confirm");
      } else {
        setLinkStep("none");
      }
    } catch (e) {
      console.warn("[Auth] Email-link detection failed:", e);
      setLinkStep("none");
    }
  }, []);

  // Clear the splash timer if the component unmounts mid-splash.
  useEffect(() => {
    return () => {
      if (splashTimer.current !== null) window.clearTimeout(splashTimer.current);
    };
  }, []);

  const handleEmailLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkEmail) return;
    setLinkStep("processing");
    setLinkError("");
    try {
      // For email link sign-in, we use signInWithEmailLink
      await signInWithEmailLink(auth, linkEmail, window.location.href);
      window.localStorage.removeItem("emailForSignIn");
      toast.success("Signed in successfully via email link!");
      // After successful sign-in, resolve the session
      const profile = await resolveUserSession(auth.currentUser!);
      if (profile) {
        useAuthStore.getState().setUser(profile);
        if (profile.isSuperAdmin) {
          router.replace("/super-admin/dashboard");
        } else {
          // First-time invitees set their password before entering the workspace
          // (email-link sign-in satisfies Firebase's requires-recent-login check).
          router.replace("/set-password");
        }
      } else {
        // Authenticated but no membership (and no invitation matched).
        toast.error("No workspace found for this account. Contact your administrator.");
        await signOut();
        setLinkStep("none");
      }
    } catch (err: any) {
      const code = err?.code;
      const message = err?.message || "";
      console.error("[Login] email link sign-in failed:", code || "(no code)", message);

      if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found"
      ) {
        setLinkError("Invalid link or email. Please try again.");
      } else if (code === "auth/too-many-requests") {
        setLinkError("Too many attempts. Please try again later.");
      } else if (code === "auth/network-request-failed") {
        setLinkError("Network error. Check your connection and try again.");
      } else if (
        code === "auth/api-key-not-valid" ||
        message.includes("API key not valid") ||
        message.includes("REQUEST_DENIED") ||
        message.includes("API_KEY_HTTP_REFERRER_BLOCKED")
      ) {
        console.error("[Login] API key restriction detected. Ensure the deployed domain is in Firebase Console → Authentication → Settings → Authorized Domains.");
        setLinkError("Authentication service unavailable. Please contact support.");
      } else {
        setLinkError(toUserMessage(err, "Sign-in failed. The link may have expired."));
      }
      setLinkStep("confirm");
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const profile = await resolveUserSession(credential.user);
      if (!profile) {
        // Signed in but no facility membership — clean up before leaving.
        toast.error("No workspace found for this account. Contact your administrator.");
        await signOut();
        return;
      }
      useAuthStore.getState().setUser(profile);
      toast.success("Signed in successfully!");
      // Brief brand splash before entering the workspace.
      setShowSplash(true);
      splashTimer.current = window.setTimeout(() => {
        router.push(profile.isSuperAdmin ? "/super-admin/dashboard" : "/dashboard");
      }, 3000);
    } catch (error: any) {
      let message = "Failed to sign in";
      const code = error?.code;
      const errorMessage = error?.message || "";

      // Enhanced error mapping with API key restriction detection
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        message = "Invalid email or password";
      } else if (code === "auth/user-disabled") {
        message = "This account has been deactivated. Contact your facility admin.";
      } else if (code === "auth/too-many-requests") {
        message = "Too many failed attempts. Please try again later or reset your password.";
      } else if (code === "auth/network-request-failed") {
        message = "Network error. Please check your connection and try again.";
      } else if (code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (
        code === "auth/api-key-not-valid" ||
        errorMessage.includes("API key not valid") ||
        errorMessage.includes("REQUEST_DENIED") ||
        errorMessage.includes("API_KEY_HTTP_REFERRER_BLOCKED") ||
        errorMessage.includes("referer")
      ) {
        // API key restriction - likely missing deployed domain in Firebase Console
        console.error("[Login] API key restriction detected. Ensure the deployed domain is in Firebase Console → Authentication → Settings → Authorized Domains.");
        message = "Authentication service unavailable. Please contact support.";
      } else if (code === "auth/missing-or-invalid-nonce") {
        message = "Authentication error. Please clear your browser cache and try again.";
      } else {
        // Default error handling for any other errors
        if (errorMessage.includes("Email not found")) {
          message = "No account found with this email. Please sign up or check your email.";
        } else if (errorMessage.includes("Password incorrect")) {
          message = "Incorrect password. Please try again.";
        } else {
          message = toUserMessage(error, "Something went wrong. Please try again.");
        }
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* Post-auth splash (3s) — overlays everything until redirect */}
      {showSplash && <SplashScreen />}
      {/* Brand panel — desktop only */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink p-10 xl:p-14 text-paper">
        {/* Subtle radial light spots */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.9) 0, transparent 45%), radial-gradient(circle at 78% 82%, rgba(255,255,255,0.55) 0, transparent 50%)",
          }}
        />

        {/* Top: brand lockup */}
        <div className="relative flex items-center gap-2.5">
          {/* Transparent logo blends directly into the background — no container */}
          <img src={LOGO_DATA_URL} alt="OAE Logo" className="h-10 w-auto" />
          <span className="font-heading text-lg font-semibold tracking-tight">InventoryOS</span>
        </div>

        {/* Center: value propositions */}
        <div className="relative space-y-8 max-w-md">
          <div>
            <p className="font-heading text-2xl xl:text-3xl font-bold leading-tight">
              Every item, accounted for
            </p>
            <p className="mt-3 text-sm xl:text-base text-paper/70 leading-relaxed">
              Inventory management for stationery businesses that keeps working when the connection drops.
            </p>
          </div>

          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper/10">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-heading text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-paper/60 leading-relaxed">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: copyright */}
        <p className="relative text-xs xl:text-sm text-paper/50">
          &copy; 2026 InventoryOS. Built for stationery businesses.
        </p>
      </div>

      {/* Form side */}
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          {/* Transparent logo blends directly into the background — no container */}
          <img src={LOGO_DATA_URL} alt="OAE Logo" className="h-9 w-auto" />
          <span className="font-heading text-xl font-semibold tracking-tight text-ink">InventoryOS</span>
        </div>

        <div className="w-full max-w-md space-y-6 rounded-3xl border border-hairline bg-paper p-6 shadow-subtle sm:p-8">
          {linkStep === "detecting" ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Detecting sign-in link...</span>
            </div>
          ) : linkStep === "confirm" || linkStep === "processing" ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 text-center">
                <Mail className="mx-auto h-8 w-8 text-primary mb-2" />
                <p className="font-medium text-sm">Staff Invitation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Confirm your email to accept the invitation and sign in.
                </p>
              </div>
              <form onSubmit={handleEmailLinkSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="link-email">Your email</Label>
                  <Input
                    id="link-email"
                    type="email"
                    value={linkEmail}
                    onChange={(e) => setLinkEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                {linkError && (
                  <p className="text-sm text-destructive text-center">{linkError}</p>
                )}
                <Button type="submit" className="w-full min-h-[44px]" disabled={linkStep === "processing"}>
                  {linkStep === "processing" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {linkStep === "processing" ? "Signing in..." : "Continue"}
                </Button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  {...register("email", { required: "Email is required" })}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2 relative">
                <div className="flex justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a href="/reset-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password", { required: "Password is required" })}
                  className="pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
