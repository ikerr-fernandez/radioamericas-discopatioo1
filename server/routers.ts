import { createHash } from "node:crypto";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { accessCodeRole, clearTeamCookie, createTeamSession, LEGACY_SINGLE_USE_CODE, OWNER_ACCESS_CODE, setTeamCookie, TEAM_ACCESS_CODES } from "./_core/teamAuth";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { countSongRequestsSince, createRequestActivity, createSiteFeedback, createSongRequest, createStudentAccessCode, getAnalyticsSummary, getSiteControl, isAccessCodeAvailable, isStudentAccessCodeAvailable, listActiveVisitors, listRequestActivity, listSiteFeedback, listSongRequests, listStudentAccessCodes, recordAnalyticsEvent, redeemAccessCode, redeemStudentAccessCode, updateSiteControl, updateSongRequest, upsertActiveVisitor } from "./db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isLikelyExplicitSong, TERMS_VERSION } from "@shared/contentModeration";

const requestInput = z.object({
  songTitle: z.string().trim().min(1).max(255),
  artist: z.string().trim().min(1).max(255),
  album: z.string().trim().max(255).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  requesterName: z.string().trim().min(1, "El nombre del alumno es obligatorio").max(120),
  course: z.string().trim().min(1, "El curso es obligatorio").max(80),
  dedication: z.string().trim().max(1000).optional(),
  sourceUrl: z.string().url().max(500).optional(),
  termsAccepted: z.literal(true, { error: "Debes aceptar los términos para enviar la petición" }),
  termsVersion: z.literal(TERMS_VERSION),
  explicitWarningAccepted: z.boolean().default(false),
  accessCode: z.string().trim().regex(/^[A-Z0-9]{6,21}$/i, "El código no tiene un formato válido").optional(),
});

const FIRST_OPEN_AT = Date.parse("2026-10-07T12:00:00Z");
// Apertura excepcional solicitada para el sábado 3 de octubre de 2026.
// 12:21 CEST = 10:21 UTC; 18:00 CEST = 16:00 UTC.
const TEMPORARY_OPEN_FROM = Date.parse("2026-10-03T10:21:00Z");
const TEMPORARY_OPEN_UNTIL = Date.parse("2026-10-03T16:00:00Z");
const REQUEST_LIMIT = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function nextUnlockAt(now = Date.now()) {
  if (now < FIRST_OPEN_AT) return FIRST_OPEN_AT;
  return FIRST_OPEN_AT + (Math.floor((now - FIRST_OPEN_AT) / WEEK_MS) + 1) * WEEK_MS;
}

async function getPauseState() {
  const now = Date.now();
  if (now >= TEMPORARY_OPEN_FROM && now < TEMPORARY_OPEN_UNTIL) {
    return { paused: false, count: 0, limit: REQUEST_LIMIT, unlockAt: null };
  }
  const windowStart = now < FIRST_OPEN_AT ? FIRST_OPEN_AT : FIRST_OPEN_AT + Math.floor((now - FIRST_OPEN_AT) / WEEK_MS) * WEEK_MS;
  const count = now < FIRST_OPEN_AT ? 0 : await countSongRequestsSince(new Date(windowStart));
  const paused = now < FIRST_OPEN_AT || count >= REQUEST_LIMIT;
  return { paused, count, limit: REQUEST_LIMIT, unlockAt: paused ? nextUnlockAt(now) : null };
}

const getClientIp = (req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }) => String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
const getActivityMetadata = (req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }) => {
  const userAgent = String(req.headers["user-agent"] ?? "").toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = createHash("sha256").update(`${ENV.cookieSecret || ENV.appId || "activity-salt"}|${day}|${getClientIp(req)}`).digest("hex").slice(0, 32);
  const deviceType = /tablet|ipad/.test(userAgent) ? "tablet" : /mobile|android|iphone/.test(userAgent) ? "móvil" : "ordenador";
  const browser = /edg\//.test(userAgent) ? "Edge" : /chrome\//.test(userAgent) ? "Chrome" : /firefox\//.test(userAgent) ? "Firefox" : /safari\//.test(userAgent) ? "Safari" : "Otro";
  return { ipHash, deviceType, browser } as const;
};

const teamOnly = adminProcedure.use(({ ctx, next }) => {
  if (ctx.user.loginMethod !== "team-code" || ctx.user.openId !== "disco-patio-team") throw new TRPCError({ code: "FORBIDDEN", message: "Necesitas el código privado de acceso." });
  return next({ ctx });
});
const ownerOnly = adminProcedure.use(({ ctx, next }) => {
  if (ctx.user.loginMethod !== "team-owner" || ctx.user.openId !== "disco-patio-team") throw new TRPCError({ code: "FORBIDDEN", message: "Necesitas el código de propietario." });
  return next({ ctx });
});

const manualControl = async () => getSiteControl();
const getAnalyticsCountry = (req: { headers: Record<string, string | string[] | undefined> }) => {
  const candidate = String(req.headers["cf-ipcountry"] ?? req.headers["x-country-code"] ?? req.headers["x-vercel-ip-country"] ?? "XX").toUpperCase();
  return /^[A-Z]{2}$/.test(candidate) ? candidate : "XX";
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      clearTeamCookie(ctx.res, ctx.req);
      return { success: true } as const;
    }),
  }),
  team: router({
    login: publicProcedure.input(z.object({ code: z.string().trim().regex(/^[A-Z0-9]{16,21}$/i, "Código incorrecto") })).mutation(async ({ ctx, input }) => {
      const role = accessCodeRole(input.code);
      if (!role) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código incorrecto" });
      setTeamCookie(ctx.res, ctx.req, await createTeamSession(role));
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearTeamCookie(ctx.res, ctx.req);
      return { success: true } as const;
    }),
  }),
  activity: router({
    heartbeat: publicProcedure.input(z.object({ sessionId: z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/) })).mutation(async ({ ctx, input }) => { await upsertActiveVisitor({ sessionId: input.sessionId, ...getActivityMetadata(ctx.req) }); return { ok: true } as const; }),
    adminLive: teamOnly.query(async () => ({ visitors: await listActiveVisitors(), requests: await listRequestActivity() })),
  }),
  analytics: router({
    record: publicProcedure.input(z.object({ page: z.string().trim().regex(/^\/[a-zA-Z0-9_\-./]{0,200}$/), eventType: z.enum(["page_view", "session_end", "click"]), durationSeconds: z.number().int().min(0).max(3600).default(0), clicks: z.number().int().min(0).max(100).default(0), deviceType: z.enum(["móvil", "tablet", "ordenador", "desconocido"]).default("desconocido") })).mutation(async ({ ctx, input }) => { await recordAnalyticsEvent({ ...input, day: new Date().toISOString().slice(0, 10), country: getAnalyticsCountry(ctx.req) }); return { ok: true } as const; }),
    summary: ownerOnly.query(() => getAnalyticsSummary()),
  }),
  music: router({
    search: publicProcedure.input(z.object({ query: z.string().trim().min(2).max(100) })).query(async ({ input }) => {
      const url = new URL("https://itunes.apple.com/search");
      url.searchParams.set("term", input.query);
      url.searchParams.set("entity", "song");
      url.searchParams.set("country", "ES");
      url.searchParams.set("lang", "es_es");
      url.searchParams.set("limit", "8");
      try {
        const response = await fetch(url, { headers: { "User-Agent": "DiscoPatioRadio/1.0 (IES Las Americas)" } });
        if (!response.ok) throw new Error("Music search unavailable");
        const data = await response.json() as { results?: Array<{ trackId?: number; trackName?: string; artistName?: string; collectionName?: string; releaseDate?: string; previewUrl?: string; trackViewUrl?: string; artworkUrl100?: string; trackExplicitness?: "explicit" | "cleaned" | "notExplicit" | "unknown"; }> };
        return (data.results ?? []).map(track => ({
          id: String(track.trackId ?? `${track.artistName}-${track.trackName}`),
          title: track.trackName ?? "Sin título",
          artist: track.artistName ?? "Artista desconocido",
          album: track.collectionName ?? "",
          year: track.releaseDate ? Number(track.releaseDate.slice(0, 4)) || undefined : undefined,
          previewUrl: track.previewUrl,
          artworkUrl: track.artworkUrl100?.replace("100x100", "300x300"),
          sourceUrl: track.trackViewUrl,
          explicitness: track.trackExplicitness ?? "unknown",
        }));
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "No se pudo consultar el buscador musical. Prueba de nuevo." });
      }
    }),
  }),
  requests: router({
    status: publicProcedure.query(async () => ({ ...(await getPauseState()), ...(await manualControl()) })),
    checkAccessCode: publicProcedure.input(z.object({ code: z.string().trim().regex(/^[A-Z0-9]{6,21}$/i) })).mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const permanent = accessCodeRole(code) !== null || TEAM_ACCESS_CODES.includes(code as typeof TEAM_ACCESS_CODES[number]) || code === OWNER_ACCESS_CODE;
      return { valid: permanent || code === LEGACY_SINGLE_USE_CODE ? (permanent || await isAccessCodeAvailable(code)) : await isStudentAccessCodeAvailable(code), permanent };
    }),
    create: publicProcedure.input(requestInput).mutation(async ({ ctx, input }) => {
      if (input.termsVersion !== TERMS_VERSION) throw new TRPCError({ code: "BAD_REQUEST", message: "Debes aceptar la versión actual de los términos." });
      if (isLikelyExplicitSong(input.songTitle, input.artist) && !input.explicitWarningAccepted) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta canción parece contener contenido explícito. Confirma que quieres enviarla." });
      const control = await manualControl();
      const pause = await getPauseState();
      const code = input.accessCode?.toUpperCase();
      const permanentBypass = code ? accessCodeRole(code) !== null : false;
      if ((pause.paused || control.blocked) && !permanentBypass) {
        if (!code) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "La página está bloqueada. Utiliza un código válido de un solo uso." });
        const redeemed = code.length === 6 ? await redeemStudentAccessCode(code) : await redeemAccessCode(code);
        if (!redeemed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Código no válido o ya utilizado." });
      }
      const { explicitWarningAccepted: _explicitWarningAccepted, accessCode: _accessCode, ...request } = input;
      const result = await createSongRequest({ ...request, status: "pending" });
      await createRequestActivity({ requestId: result.id, ...getActivityMetadata(ctx.req), accessCodeUsed: Boolean(code) });
      return { success: true, id: result.id } as const;
    }),
    adminList: teamOnly.query(() => listSongRequests()),
    update: teamOnly.input(z.object({ id: z.number().int(), status: z.enum(["pending", "selected", "played", "rejected"]), notes: z.string().max(1000).optional() })).mutation(({ input }) => updateSongRequest(input.id, { status: input.status, notes: input.notes })),
    deletePermanent: ownerOnly.input(z.object({ id: z.number().int().positive(), confirmation: z.literal("ELIMINAR") })).mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete((await import("../drizzle/schema")).songRequests).where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).songRequests.id, input.id));
      return { success: true } as const;
    }),
  }),
  owner: router({
    control: ownerOnly.query(() => getSiteControl()),
    updateControl: ownerOnly.input(z.object({ blocked: z.boolean().optional(), unlockAt: z.coerce.date().nullable().optional(), bannerEnabled: z.boolean().optional(), bannerText: z.string().max(500).nullable().optional(), bannerPosition: z.enum(["top", "middle", "bottom"]).optional(), bannerColor: z.string().max(24).optional() })).mutation(({ input }) => updateSiteControl(input)),
    codes: ownerOnly.query(() => listStudentAccessCodes()),
    createCode: ownerOnly.input(z.object({ studentName: z.string().trim().min(1).max(120) })).mutation(async ({ input }) => {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await createStudentAccessCode({ code, studentName: input.studentName });
      return { code, studentName: input.studentName };
    }),
  }),
  feedback: router({
    submit: publicProcedure.input(z.object({ requestId: z.number().int().positive(), rating: z.number().int().min(1).max(5) })).mutation(({ input }) => createSiteFeedback(input)),
    adminList: teamOnly.query(() => listSiteFeedback()),
  }),
});

export type AppRouter = typeof appRouter;
