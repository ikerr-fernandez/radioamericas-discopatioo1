import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const songRequests = mysqlTable("song_requests", {
  id: int("id").autoincrement().primaryKey(),
  songTitle: varchar("songTitle", { length: 255 }).notNull(),
  artist: varchar("artist", { length: 255 }).notNull(),
  album: varchar("album", { length: 255 }),
  year: int("year"),
  requesterName: varchar("requesterName", { length: 120 }),
  course: varchar("course", { length: 80 }),
  dedication: text("dedication"),
  sourceUrl: varchar("sourceUrl", { length: 500 }),
  termsAccepted: boolean("termsAccepted").notNull().default(false),
  termsVersion: varchar("termsVersion", { length: 32 }).notNull().default("2026-09-27-23:31"),
  status: mysqlEnum("status", ["pending", "selected", "played", "rejected"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const requestActivity = mysqlTable("request_activity", {
  requestId: int("requestId").primaryKey(),
  ipHash: varchar("ipHash", { length: 128 }),
  deviceType: varchar("deviceType", { length: 32 }),
  browser: varchar("browser", { length: 80 }),
  accessCodeUsed: boolean("accessCodeUsed").notNull().default(false),
});

export const activeVisitors = mysqlTable("active_visitors", {
  sessionId: varchar("sessionId", { length: 64 }).primaryKey(),
  ipHash: varchar("ipHash", { length: 128 }),
  deviceType: varchar("deviceType", { length: 32 }),
  browser: varchar("browser", { length: 80 }),
  lastSeen: timestamp("lastSeen").defaultNow().onUpdateNow().notNull(),
});

export const siteFeedback = mysqlTable("site_feedback", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  rating: int("rating").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const accessCodes = mysqlTable("access_codes", {
  code: varchar("code", { length: 32 }).primaryKey(),
  usedAt: timestamp("usedAt"),
});

export const studentAccessCodes = mysqlTable("student_access_codes", {
  code: varchar("code", { length: 6 }).primaryKey(),
  studentName: varchar("studentName", { length: 120 }).notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const siteControl = mysqlTable("site_control", {
  id: int("id").primaryKey(),
  blocked: boolean("blocked").notNull().default(false),
  unlockAt: timestamp("unlockAt"),
  bannerEnabled: boolean("bannerEnabled").notNull().default(false),
  bannerText: text("bannerText"),
  bannerPosition: mysqlEnum("bannerPosition", ["top", "middle", "bottom"]).notNull().default("top"),
  bannerColor: varchar("bannerColor", { length: 24 }).notNull().default("cyan"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SongRequest = typeof songRequests.$inferSelect;
export type InsertSongRequest = typeof songRequests.$inferInsert;
export type RequestActivity = typeof requestActivity.$inferSelect;
export type InsertRequestActivity = typeof requestActivity.$inferInsert;
export type ActiveVisitor = typeof activeVisitors.$inferSelect;
export type InsertActiveVisitor = typeof activeVisitors.$inferInsert;
export type SiteFeedback = typeof siteFeedback.$inferSelect;
export type InsertSiteFeedback = typeof siteFeedback.$inferInsert;
export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = typeof accessCodes.$inferInsert;
export type StudentAccessCode = typeof studentAccessCodes.$inferSelect;
export type InsertStudentAccessCode = typeof studentAccessCodes.$inferInsert;
export type SiteControl = typeof siteControl.$inferSelect;
export type InsertSiteControl = typeof siteControl.$inferInsert;
