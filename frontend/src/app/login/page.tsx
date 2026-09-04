import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign In - InventoryOS",
  description: "Sign in to your inventory management system",
};

// Canonical email-link landing route: staff invitations are sent with
// url: origin/login (Medicore parity). Renders the same handler as
// /auth/signin so previously-sent invitation links resolve instead of 404.
export default function LoginPage() {
  return <LoginForm />;
}
