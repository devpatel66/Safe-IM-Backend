import { UserRole } from "../db/schema";

// This type describes every permission in the system.
// Add a new entry here whenever you add a new protected action.
export type Permission =
  | "business_profile:manage"
  | "clients:manage"
  | "clients:read"
  | "plans:manage"
  | "plans:read"
  | "invoices:create"
  | "invoices:update"
  | "invoices:delete"
  | "invoices:read"
  | "statements:create"
  | "statements:update"
  | "statements:delete"
  | "statements:read"
  | "festivals:manage"
  | "users:manage";

// The source of truth — maps every role to what it can do.
// To change a permission, you change it HERE, nowhere else.
export const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    "business_profile:manage",
    "clients:manage",
    "clients:read",
    "plans:manage",
    "plans:read",
    "invoices:create",
    "invoices:update",
    "invoices:delete",
    "invoices:read",
    "statements:create",
    "statements:update",
    "statements:delete",
    "statements:read",
    "festivals:manage",
    "users:manage",
  ],

  staff: [
    "clients:read",
    "plans:read",
    "invoices:create",
    "invoices:update",
    "invoices:read",
    "statements:create",
    "statements:update",
    "statements:read",
  ],

  viewer: [
    "clients:read",
    "plans:read",
    "invoices:read",
    "statements:read",
  ],
};

// Helper — check if a role has a specific permission.
// Used in Step 5 by the authorize middleware.
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}