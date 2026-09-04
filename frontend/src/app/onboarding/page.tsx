import type { Metadata } from "next";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata: Metadata = {
  title: "Set up your business | InventoryOS",
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to InventoryOS</h1>
          <p className="mt-2 text-muted-foreground">
            Let&apos;s set up your business in a few quick steps
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
