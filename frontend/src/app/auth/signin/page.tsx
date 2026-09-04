import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign In - InventoryOS",
  description: "Sign in to your inventory management system",
};

// LoginForm owns the full-screen layout (split brand panel + form card).
export default function SignInPage() {
  return <LoginForm />;
}
