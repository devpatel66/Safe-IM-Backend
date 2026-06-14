import { eq } from "drizzle-orm";
import { db } from "../db";
import { plans, planRates } from "../db/schema";
import {
  CreatePlanInput,
  UpdatePlanInput,
  CreatePlanRateInput,
  UpdatePlanRateInput,
} from "../validators/plan.validator";

export const planService = {
  // ── Plans ──────────────────────────────────────────────

  async create(data: CreatePlanInput) {
    const [plan] = await db.insert(plans).values(data).returning();
    return plan;
  },

  async getById(id: number) {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan ?? null;
  },

  async listByClient(clientId: number) {
    return db.select().from(plans).where(eq(plans.clientId, clientId));
  },

  async update(id: number, data: UpdatePlanInput) {
    const [updated] = await db
      .update(plans)
      .set(data)
      .where(eq(plans.id, id))
      .returning();
    return updated ?? null;
  },

  async delete(id: number) {
    return db.transaction(async (tx) => {
      // Cascade: delete rates first
      await tx.delete(planRates).where(eq(planRates.planId, id));
      const [deleted] = await tx.delete(plans).where(eq(plans.id, id)).returning();
      return deleted ?? null;
    });
  },

  // ── Plan Rates ─────────────────────────────────────────

  async createRate(data: CreatePlanRateInput) {
    const [rate] = await db
      .insert(planRates)
      .values({
        ...data,
        rate: data.rate !== undefined ? String(data.rate) : undefined,
        extraRate: data.extraRate !== undefined ? String(data.extraRate) : undefined,
      })
      .returning();
    return rate;
  },

  async getRateById(id: number) {
    const [rate] = await db.select().from(planRates).where(eq(planRates.id, id));
    return rate ?? null;
  },

  async listRatesByPlan(planId: number) {
    return db.select().from(planRates).where(eq(planRates.planId, planId));
  },

  async updateRate(id: number, data: UpdatePlanRateInput) {
    // Build the update payload, only including fields that are explicitly provided.
    // Spreading the raw `data` would set missing optional fields to undefined,
    // which Drizzle interprets as "SET column = NULL", wiping existing values.
    const updatePayload: Record<string, any> = {};
    if (data.serviceType !== undefined) updatePayload.serviceType = data.serviceType;
    if (data.vehicleType !== undefined) updatePayload.vehicleType = data.vehicleType;
    if (data.acType !== undefined) updatePayload.acType = data.acType;
    if (data.rate !== undefined) updatePayload.rate = String(data.rate);
    if (data.extraRate !== undefined) updatePayload.extraRate = String(data.extraRate);

    const [updated] = await db
      .update(planRates)
      .set(updatePayload)
      .where(eq(planRates.id, id))
      .returning();
    return updated ?? null;
  },

  async deleteRate(id: number) {
    const [deleted] = await db
      .delete(planRates)
      .where(eq(planRates.id, id))
      .returning();
    return deleted ?? null;
  },
};
