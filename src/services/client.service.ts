import { eq, ilike, or, count } from "drizzle-orm";
import { db } from "../db";
import { clients } from "../db/schema";
import { CreateClientInput, UpdateClientInput } from "../validators/client.validator";
import { paginate, buildPaginationMeta } from "../utils/pagination";
import { escapeLike } from "../utils/escapeLike";

export const clientService = {
  async create(data: CreateClientInput) {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  },

  async getById(id: number) {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client ?? null;
  },

  async getByName(name: string) {
    const [client] = await db.select().from(clients).where(ilike(clients.name, name));
    return client ?? null;
  },

  async list(page: number, limit: number, search?: string) {
    const { offset } = paginate(page, limit);

    const where = search
      ? or(
          ilike(clients.name, `%${escapeLike(search)}%`),
          ilike(clients.phone, `%${escapeLike(search)}%`),
          ilike(clients.email, `%${escapeLike(search)}%`)
        )
      : undefined;

    const [rows, [{ value: total }]] = await Promise.all([
      db.select().from(clients).where(where).limit(limit).offset(offset),
      db.select({ value: count() }).from(clients).where(where),
    ]);

    return {
      data: rows,
      pagination: buildPaginationMeta(Number(total), page, limit),
    };
  },

  async update(id: number, data: UpdateClientInput) {
    const [updated] = await db
      .update(clients)
      .set(data)
      .where(eq(clients.id, id))
      .returning();
    return updated ?? null;
  },

  async delete(id: number) {
    const [deleted] = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning();
    return deleted ?? null;
  },
};
