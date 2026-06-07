import { db } from "../db";
import { businessProfiles } from "../db/schema";
import { eq } from "drizzle-orm";
import { UpsertBusinessProfileInput } from "../validators/misc.validator";

// Single-profile app: always use id = 1
const PROFILE_ID = 1;

export const businessProfileService = {
  async get() {
    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.id, PROFILE_ID));
    return profile ?? null;
  },

  async upsert(data: UpsertBusinessProfileInput) {
    const existing = await this.get();

    if (existing) {
      const [updated] = await db
        .update(businessProfiles)
        .set(data)
        .where(eq(businessProfiles.id, PROFILE_ID))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(businessProfiles)
        .values(data)
        .returning();
      return created;
    }
  },
};
