import { Request, Response, NextFunction, RequestHandler } from "express";
import { UserRole } from "../db/schema";
import { rolePermissions, Permission } from "../config/permissions";
import { authenticate } from "./authenticate";

// authorize is a FACTORY function — it returns a middleware.
// You call it with the permission required for that route.
//
// Usage:  authorize("invoices:delete")
//         authorize("invoices:create")
//         authorize("clients:manage")

export function authorize(permission: Permission) {
  // This is the actual middleware Express will run
  return function (req: Request, res: Response, next: NextFunction) {
    // At this point, authenticate has already run and set req.user.
    // If somehow req.user is missing, that's a server-side bug — 500.
    if (!req.user) {
      return res.status(500).json({
        success: false,
        message: "authorize middleware used without authenticate",
      });
    }

    const userRole = req.user.role as UserRole;

    // Look up what this role is allowed to do
    const allowed = rolePermissions[userRole] ?? [];

    if (!allowed.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    // Role has the permission — pass to the next middleware or controller
    next();
  };
}

// Use when you want to restrict to specific roles, not a permission.
// Usage: authorizeRoles("admin")
//        authorizeRoles("admin", "staff")

export function authorizeRoles(...roles: UserRole[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(500).json({
        success: false,
        message: "authorizeRoles middleware used without authenticate",
      });
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({
        success: false,
        message: `Access restricted to: ${roles.join(", ")}`,
      });
    }

    next();
  };
}


export function can(permission: Permission): RequestHandler[] {
  return [authenticate, authorize(permission)];
}

// Same but for role-based checks
export function role(...roles: UserRole[]): RequestHandler[] {
  return [authenticate, authorizeRoles(...roles)];
}