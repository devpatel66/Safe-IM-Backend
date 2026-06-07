import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, UserRole } from "../db/schema";

export const userService = {
  // List all users — never return the password column
  async list() {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users);
  },

  async getById(id: number) {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));
    return user ?? null;
  },

  // Change a user's role
  async updateRole(id: number, role: UserRole) {
    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      });
    return updated ?? null;
  },

  // Soft-disable — user still exists in DB, just can't log in
  // Safer than deleting (preserves audit trail on invoices they created)
  async setActive(id: number, isActive: boolean) {
    const [updated] = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      });
    return updated ?? null;
  },
};