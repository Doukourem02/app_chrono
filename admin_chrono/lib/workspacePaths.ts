/**
 * Routes « plates » du dashboard servies par la route interne /workspace (keep-alive).
 * Doit rester synchronisé avec middleware.ts (réécriture vers /workspace).
 */
export const EXACT_WORKSPACE_PATHS = [
  "/dashboard",
  "/tracking",
  "/orders",
  "/message",
  "/analytics",
  "/reports",
  "/finance",
  "/finances",
  "/commissions",
  "/users",
  "/drivers",
  "/gamification",
  "/maintenance",
  "/planning",
  "/promo-codes",
  "/disputes",
  "/settings",
  "/profile",
  "/ratings",
] as const;

export const EXACT_WORKSPACE_PATH_SET = new Set<string>(EXACT_WORKSPACE_PATHS);

/** Identifiant de panneau (clé du registre dynamique), ex. "promo-codes" */
export function pathnameToPanelId(pathname: string): string | null {
  const n = pathname.replace(/\/$/, "") || "/";
  if (!EXACT_WORKSPACE_PATH_SET.has(n)) return null;
  return n.slice(1) || "dashboard";
}
