/**
 * BL-012-F006a · canonical "is this user an admin?" helper.
 *
 * Source of truth for the admin-tier role check across the app. The real
 * role enum (docs/dev/architecture.md §3.3) is:
 *
 *   platform_admin  — sees every tenant + has every write
 *   tenant_admin    — sees own tenant + has every write within it
 *   marketer        — KOL / Campaign / Email writes only
 *   client          — single candidate-list scope (share token)
 *
 * Both *_admin tiers are admins for our purposes. F001 verifying-2026-05-08
 * caught the route checking `role === "admin"` (a value the schema never
 * produces). Centralising the check here ensures the page gate (page.tsx)
 * and the avatar-menu admin section (UserAvatarMenu.tsx, F006a) stay in
 * lockstep — bumping one role also bumps the other.
 */
export function isAdminRole(role?: string | null): boolean {
  return role === "platform_admin" || role === "tenant_admin";
}
