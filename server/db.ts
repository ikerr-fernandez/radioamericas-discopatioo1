import { desc, eq, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertSongRequest, InsertUser, songRequests, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Estas peticiones se conservan en la base de datos, pero dejan de formar parte
// del buzón operativo del equipo y no deben volver a aparecer en su listado.
export const HIDDEN_REQUEST_IDS = [1, 30001, 240001, 270001];

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSongRequest(input: InsertSongRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(songRequests).values(input);
  return { id: Number(result[0].insertId) };
}

export async function listSongRequests() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(songRequests).where(notInArray(songRequests.id, HIDDEN_REQUEST_IDS)).orderBy(desc(songRequests.createdAt));
}

export async function updateSongRequest(id: number, input: Partial<InsertSongRequest>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(songRequests).set(input).where(eq(songRequests.id, id));
  const rows = await db.select().from(songRequests).where(eq(songRequests.id, id)).limit(1);
  return rows[0];
}
