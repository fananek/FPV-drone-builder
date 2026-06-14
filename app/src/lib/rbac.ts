import { type Role } from "@/db/schema";

// RBAC Permissions Matrix defining which roles are allowed to perform which operations
const PERMISSIONS: Record<string, Role[]> = {
  "read:parts": ["anonymous", "registered_user", "moderator", "metadata_admin", "system_admin", "api_client"],
  "write:parts": ["metadata_admin", "system_admin"],
  "read:public-builds": ["anonymous", "registered_user", "moderator", "metadata_admin", "system_admin", "api_client"],
  "clone:public-build": ["anonymous", "registered_user", "moderator", "metadata_admin", "system_admin"],
  "rate:build": ["registered_user", "moderator", "metadata_admin", "system_admin"],
  "manage:own-builds": ["anonymous", "registered_user", "moderator", "metadata_admin", "system_admin"],
  "manage:all-builds": ["moderator", "system_admin"],
  "bulk-import:parts": ["metadata_admin", "system_admin", "api_client"],
  "upload:thrust-data": ["metadata_admin", "system_admin", "api_client"],
  "read:logs": ["system_admin"],
};

/**
 * Checks if a user's roles grant a specific permission.
 * Roles are cumulative; a user has the union of permissions of all their roles.
 * A system_admin has unrestricted access to all operations.
 */
export function hasPermission(roles: Role[] | undefined | null, permission: string): boolean {
  // Safe fallback to anonymous if no roles are present
  const activeRoles = (roles && roles.length > 0) ? roles : (["anonymous"] as Role[]);

  // System Admin overrides all checks (unrestricted full access)
  if (activeRoles.includes("system_admin")) {
    return true;
  }

  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }

  // Check if any of the user's active roles has the permission
  return activeRoles.some((role) => allowedRoles.includes(role));
}
