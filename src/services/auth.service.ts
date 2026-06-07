import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { LoginInput, RegisterInput } from "../validators/auth.validator";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 12;
// 12 rounds = ~300ms to hash. Slow enough to frustrate brute-force,
// fast enough for a real user logging in. Never go below 10.

export const authService = {
  async register(data: RegisterInput) {
    // 1. Check if email is already taken
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existing.length > 0) {
      const err = new Error("Email already registered") as any;
      err.status = 409; // Conflict
      throw err;
    }

    // 2. Hash the password — NEVER insert data.password directly
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    // 3. Insert the user
    const [user] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        password: hashedPassword, // hash goes in, plain text never touches the DB
        role: "viewer", // always default — admins promote via /users/:id/role
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        // ⚠️ password intentionally excluded from returning()
      });

    return user;
  },

  async login(data: LoginInput) {
    // 1. Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    // 2. Generic error — never say "email not found" or "wrong password"
    //    separately. Always say the same thing. This prevents user enumeration
    //    attacks (attacker probing which emails are registered).
    if (!user) {
      const err = new Error("Invalid email or password") as any;
      err.status = 401;
      throw err;
    }

    // 3. Check if account is active
    if (!user.isActive) {
      const err = new Error("Account is deactivated") as any;
      err.status = 403;
      throw err;
    }

    // 4. Compare the submitted password against the stored hash
    //    bcrypt.compare does the heavy lifting — it extracts the salt
    //    from the stored hash, re-hashes the plain text, and compares.
    const passwordMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordMatch) {
      const err = new Error("Invalid email or password") as any;
      err.status = 401;
      throw err;  // same message as "email not found" — intentional
    }

    // 5. Sign the JWT
    //    Payload: only what middleware needs to make auth decisions.
    //    Never put password, full address, or anything sensitive here.
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as any }
    );

    // 6. Return token + safe user object (no password)
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  },
};
