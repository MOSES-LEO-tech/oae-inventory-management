import { UserRole } from "@/types";

export type RouteRule = {
  pattern: RegExp;
  roles: UserRole[];
  /** Clerk can only view this route's data, not manage it */
  clerkReadOnly?: boolean;
};

/**
 * Route → role permission matrix.
 * First matching rule wins. Routes without a rule default to all roles.
 */
export const ROUTE_RULES: RouteRule[] = [
  // Admin only
  { pattern: /^\/settings/, roles: ["admin"] },
  // Stock Taking — admin + manager
  { pattern: /^\/stock-taking/, roles: ["admin", "manager"] },
  // Stock In — admin + manager
  { pattern: /^\/stock-in/, roles: ["admin", "manager"] },
  // Transfers — admin + manager
  { pattern: /^\/transfers/, roles: ["admin", "manager"] },
  // Reports — admin + manager
  { pattern: /^\/reports/, roles: ["admin", "manager"] },
  // Inventory — all roles; clerk is read-only
  { pattern: /^\/inventory/, roles: ["admin", "manager", "clerk"], clerkReadOnly: true },
  // Stock Out — all roles
  { pattern: /^\/stock-out/, roles: ["admin", "manager", "clerk"] },
  // Dashboard — all roles
  { pattern: /^\/dashboard/, roles: ["admin", "manager", "clerk"] },
];

export interface RouteAccess {
  /** Whether the user's role is allowed on this route */
  allowed: boolean;
  /** Whether the user should only be able to view (not manage) data here */
  readOnly: boolean;
}

export function getRouteAccess(pathname: string, role: UserRole): RouteAccess {
  const rule = ROUTE_RULES.find((r) => r.pattern.test(pathname));

  if (!rule) {
    return { allowed: true, readOnly: false };
  }

  const allowed = rule.roles.includes(role);
  const readOnly = role === "clerk" && !!rule.clerkReadOnly;

  return { allowed, readOnly };
}
