import { eq, and, lte, gte } from "drizzle-orm";
import { db } from "../db";
import { festivals } from "../db/schema";
import { CreateFestivalInput, UpdateFestivalInput } from "../validators/misc.validator";

export const festivalService = {
  async create(data: CreateFestivalInput) {
    const [festival] = await db
      .insert(festivals)
      .values({
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      })
      .returning();
    return festival;
  },

  async getById(id: number) {
    const [festival] = await db.select().from(festivals).where(eq(festivals.id, id));
    return festival ?? null;
  },

  async list() {
    return db.select().from(festivals);
  },

  async getActive() {
    const now = new Date();
    return db
      .select()
      .from(festivals)
      .where(
        and(
          eq(festivals.isActive, true),
          lte(festivals.startDate, now),
          gte(festivals.endDate, now)
        )
      );
  },

  async update(id: number, data: UpdateFestivalInput) {
    const updatePayload: Record<string, any> = { ...data };
    if (data.startDate) updatePayload.startDate = new Date(data.startDate);
    if (data.endDate) updatePayload.endDate = new Date(data.endDate);

    const [updated] = await db
      .update(festivals)
      .set(updatePayload)
      .where(eq(festivals.id, id))
      .returning();
    return updated ?? null;
  },

  async delete(id: number) {
    const [deleted] = await db.delete(festivals).where(eq(festivals.id, id)).returning();
    return deleted ?? null;
  },
};
