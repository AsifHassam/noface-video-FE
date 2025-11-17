import type { ReactNode } from "react";

/**
 * Payment Layout - No Auth Gate
 * This layout bypasses authentication for payment callback pages
 * so Paystack can redirect here without requiring user to be logged in
 */
export default function PaymentLayout({ children }: { children: ReactNode }) {
  // Don't wrap in AuthGate - payment callbacks don't require auth
  // The backend will identify user by email from Paystack
  return <>{children}</>;
}

