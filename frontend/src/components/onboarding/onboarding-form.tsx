"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/lib/firebase/auth";
import type { OnboardingData, BusinessType, FacilityType, Currency, StoreType } from "@/types";

interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { title: "Business Details", description: "Tell us about your business" },
  { title: "Store Configuration", description: "Set up your store" },
  { title: "Admin Account", description: "Create your admin account" },
];

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "stationary" as BusinessType,
    facilityType: "retail" as FacilityType,
    currency: "UGX" as Currency,
    phone: "",
    email: "",
    address: "",
    hasMultipleStores: false,
    stores: [{ name: "Main Store", type: "main" as StoreType, address: "" }],
    adminName: "",
    adminEmail: "",
    adminPhone: "",
    adminPassword: "",
    confirmPassword: "",
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.push("/auth/signin");
    }
  };

  const handleSubmit = async () => {
    if (formData.adminPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setLoading(true);
      const data: OnboardingData = {
        ...formData,
        stores: formData.stores.map((s) => ({
          name: s.name,
          type: s.type,
          address: s.address,
        })),
      };
      const result = await completeOnboarding(data);
      toast.success("Business created! Please sign in to continue.");
      window.location.href = "/auth/signin?setup=complete&facility=" + result.facilityId;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: string }).code)
          : "";
      if (code === "auth/weak-password") {
        toast.error("Password must be at least 6 characters.");
      } else if (code === "auth/email-already-in-use") {
        toast.error("This email is already registered. Try signing in instead.");
      } else if (code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else {
        console.error("Onboarding failed:", error);
        toast.error("Onboarding failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const addStore = () => {
    setFormData({
      ...formData,
      stores: [...formData.stores, { name: "", type: "branch", address: "" }],
    });
  };

  const updateStore = (index: number, field: string, value: string) => {
    const updated = [...formData.stores];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, stores: updated });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Step {step + 1} of {STEPS.length}</CardTitle>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </div>
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent>
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facilityType">Facility Type *</Label>
                <Select
                  value={formData.facilityType}
                  onValueChange={(v) => setFormData({ ...formData, facilityType: v as FacilityType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData({ ...formData, currency: v as Currency })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UGX">UGX (Uganda Shilling)</SelectItem>
                    <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+256 123 4567"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@acmecorp.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, Country"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name *</Label>
              <Input
                id="storeName"
                value={formData.stores[0]?.name}
                onChange={(e) => updateStore(0, "name", e.target.value)}
                placeholder="Main Store"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeType">Store Type *</Label>
              <Select
                value={formData.stores[0]?.type || ""}
                onValueChange={(v) => { if (v) updateStore(0, "type", v); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main Store</SelectItem>
                  <SelectItem value="branch">Branch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeAddress">Store Address</Label>
              <Textarea
                id="storeAddress"
                value={formData.stores[0]?.address}
                onChange={(e) => updateStore(0, "address", e.target.value)}
                placeholder="456 Oak Ave, City, Country"
              />
            </div>
            {formData.hasMultipleStores && (
              <div className="space-y-2">
                <Label>Additional Stores</Label>
                {formData.stores.slice(1).map((store, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Store Name"
                      value={store.name}
                      onChange={(e) => updateStore(index + 1, "name", e.target.value)}
                    />
                    <Select
                      value={store.type || ""}
                      onValueChange={(v) => { if (v) updateStore(index + 1, "type", v); }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="main">Main</SelectItem>
                        <SelectItem value="branch">Branch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addStore}>
                  + Add Store
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminName">Admin Name *</Label>
              <Input
                id="adminName"
                value={formData.adminName}
                onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email *</Label>
              <Input
                id="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                placeholder="john@acmecorp.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPhone">Admin Phone</Label>
              <Input
                id="adminPhone"
                value={formData.adminPhone}
                onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                placeholder="+256 555 1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Password *</Label>
              <Input
                id="adminPassword"
                type="password"
                value={formData.adminPassword}
                onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> You will be set as the primary admin for this facility.
                Your account will have full access to all features.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={handleBack} disabled={loading}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Completing..." : "Complete Onboarding"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}