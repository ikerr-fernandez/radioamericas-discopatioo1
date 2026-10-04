import { and, desc, eq, isNull, lt, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { accessCodes, activeVisitors, analyticsEvents, InsertAnalyticsEvent, InsertRequestActivity, InsertSiteFeedback, InsertSongRequest, InsertUser, requestActivity, siteControl, siteFeedback, songRequests, studentAccessCodes, users } from "../drizzle/schema";
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

export async function createRequestActivity(input: InsertRequestActivity) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(requestActivity).values(input);
}

export async function upsertActiveVisitor(input: typeof activeVisitors.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  await db.delete(activeVisitors).where(lt(activeVisitors.lastSeen, cutoff));
  await db.insert(activeVisitors).values({ ...input, lastSeen: new Date() }).onDuplicateKeyUpdate({ set: { ipHash: input.ipHash, deviceType: input.deviceType, browser: input.browser, lastSeen: new Date() } });
}

export async function listActiveVisitors() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  await db.delete(activeVisitors).where(lt(activeVisitors.lastSeen, new Date(Date.now() - 60 * 60 * 1000)));
  return db.select().from(activeVisitors).where(sql`${activeVisitors.lastSeen} >= ${cutoff}`).orderBy(desc(activeVisitors.lastSeen));
}

export async function listRequestActivity() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ requestId: songRequests.id, songTitle: songRequests.songTitle, artist: songRequests.artist, requesterName: songRequests.requesterName, course: songRequests.course, createdAt: songRequests.createdAt, ipHash: requestActivity.ipHash, deviceType: requestActivity.deviceType, browser: requestActivity.browser, accessCodeUsed: requestActivity.accessCodeUsed }).from(requestActivity).innerJoin(songRequests, eq(requestActivity.requestId, songRequests.id)).orderBy(desc(songRequests.createdAt)).limit(50);
}

export async function countSongRequestsSince(since: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.select({ count: sql<number>`count(*)` }).from(songRequests).where(sql`${songRequests.createdAt} >= ${since}`);
  return Number(result[0]?.count ?? 0);
}

export async function isAccessCodeAvailable(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select({ code: accessCodes.code }).from(accessCodes).where(and(eq(accessCodes.code, code), isNull(accessCodes.usedAt))).limit(1);
  return rows.length > 0;
}

export async function redeemAccessCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.update(accessCodes).set({ usedAt: new Date() }).where(and(eq(accessCodes.code, code), isNull(accessCodes.usedAt)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function isStudentAccessCodeAvailable(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select({ code: studentAccessCodes.code }).from(studentAccessCodes).where(and(eq(studentAccessCodes.code, code), isNull(studentAccessCodes.usedAt))).limit(1);
  return rows.length > 0;
}

export async function redeemStudentAccessCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.update(studentAccessCodes).set({ usedAt: new Date() }).where(and(eq(studentAccessCodes.code, code), isNull(studentAccessCodes.usedAt)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function createStudentAccessCode(input: { code: string; studentName: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(studentAccessCodes).values(input);
  return input;
}

export async function listStudentAccessCodes() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(studentAccessCodes).orderBy(desc(studentAccessCodes.createdAt)).limit(100);
}

export async function getSiteControl() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(siteControl).where(eq(siteControl.id, 1)).limit(1);
  return rows[0] ?? { id: 1, blocked: false, unlockAt: null, bannerEnabled: false, bannerText: null, bannerPosition: "top" as const, bannerColor: "cyan", updatedAt: new Date() };
}

export async function updateSiteControl(input: Partial<typeof siteControl.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(siteControl).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
  return getSiteControl();
}

export async function recordAnalyticsEvent(input: InsertAnalyticsEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(analyticsEvents).values(input);
}

export async function getAnalyticsSummary() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(analyticsEvents).where(lt(analyticsEvents.createdAt, new Date(Date.now() - 25 * 30 * 24 * 60 * 60 * 1000)));
  return db.select({ day: analyticsEvents.day, page: analyticsEvents.page, eventType: analyticsEvents.eventType, views: sql<number>`sum(case when ${analyticsEvents.eventType} = 'page_view' then 1 else 0 end)`, sessions: sql<number>`sum(case when ${analyticsEvents.eventType} = 'session_end' then 1 else 0 end)`, totalSeconds: sql<number>`sum(${analyticsEvents.durationSeconds})`, clicks: sql<number>`sum(${analyticsEvents.clicks})`, country: analyticsEvents.country, deviceType: analyticsEvents.deviceType }).from(analyticsEvents).groupBy(analyticsEvents.day, analyticsEvents.page, analyticsEvents.eventType, analyticsEvents.country, analyticsEvents.deviceType).orderBy(desc(analyticsEvents.day)).limit(500);
}

export async function ensurePauseAccessCode() {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`CREATE TABLE IF NOT EXISTS access_codes (code varchar(32) NOT NULL PRIMARY KEY, usedAt timestamp NULL)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS active_visitors (sessionId varchar(64) NOT NULL PRIMARY KEY, ipHash varchar(128), deviceType varchar(32), browser varchar(80), lastSeen timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS request_activity (requestId int NOT NULL PRIMARY KEY, ipHash varchar(128), deviceType varchar(32), browser varchar(80), accessCodeUsed boolean NOT NULL DEFAULT false)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS student_access_codes (code varchar(6) NOT NULL PRIMARY KEY, studentName varchar(120) NOT NULL, usedAt timestamp NULL, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS site_control (id int NOT NULL PRIMARY KEY, blocked boolean NOT NULL DEFAULT false, unlockAt timestamp NULL, bannerEnabled boolean NOT NULL DEFAULT false, bannerText text NULL, bannerPosition enum('top','middle','bottom') NOT NULL DEFAULT 'top', bannerColor varchar(24) NOT NULL DEFAULT 'cyan', updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS analytics_events (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, day varchar(10) NOT NULL, page varchar(255) NOT NULL, eventType enum('page_view','session_end','click') NOT NULL, durationSeconds int NOT NULL DEFAULT 0, clicks int NOT NULL DEFAULT 0, country varchar(2) NOT NULL DEFAULT 'XX', deviceType varchar(32) NOT NULL DEFAULT 'desconocido', createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.insert(siteControl).values({ id: 1 }).onDuplicateKeyUpdate({ set: { id: 1 } });
  await db.insert(accessCodes).values({ code: "NV4SXULY75CS1DABNGXD0" }).onDuplicateKeyUpdate({ set: { code: "NV4SXULY75CS1DABNGXD0" } });
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

export async function createSiteFeedback(input: InsertSiteFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(siteFeedback).values(input);
  return { success: true } as const;
}

export async function listSiteFeedback() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(siteFeedback).orderBy(desc(siteFeedback.createdAt)).limit(100);
}
