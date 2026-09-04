"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { sendPasswordReset } from "@/lib/firebase/auth";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else if (code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection and try again.");
      } else if (code === "auth/user-not-found") {
        // Do not reveal whether the account exists.
        setSent(true);
      } else {
        console.error("Password reset failed:", error);
        toast.error("Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <MailCheck className="mx-auto h-10 w-10 text-primary" />
                <p className="text-sm font-medium">Check your email</p>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium">{email}</span>, a
                  password reset link has been sent. Follow the link to set a new password,
                  then sign in.
                </p>
                <a
                  href="/auth/signin"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
                >
                  Back to Sign In
                </a>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  Remembered it?{" "}
                  <a href="/auth/signin" className="text-primary hover:underline font-medium">
                    Back to Sign In
                  </a>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
