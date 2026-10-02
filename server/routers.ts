import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { clearTeamCookie, createTeamSession, isValidTeamCode, setTeamCookie } from "./_core/teamAuth";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { countSongRequestsSince, createSiteFeedback, createSongRequest, isAccessCodeAvailable, listSiteFeedback, listSongRequests, redeemAccessCode, updateSongRequest } from "./db";
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
  accessCode: z.string().trim().regex(/^[A-Z0-9]{21}$/i, "El código debe tener 21 caracteres").optional(),
});

const FIRST_OPEN_AT = Date.parse("2026-10-07T12:00:00Z");
const REQUEST_LIMIT = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function nextUnlockAt(now = Date.now()) {
  if (now < FIRST_OPEN_AT) return FIRST_OPEN_AT;
  return FIRST_OPEN_AT + (Math.floor((now - FIRST_OPEN_AT) / WEEK_MS) + 1) * WEEK_MS;
}

async function getPauseState() {
  const now = Date.now();
  const windowStart = now < FIRST_OPEN_AT ? FIRST_OPEN_AT : FIRST_OPEN_AT + Math.floor((now - FIRST_OPEN_AT) / WEEK_MS) * WEEK_MS;
  const count = now < FIRST_OPEN_AT ? 0 : await countSongRequestsSince(new Date(windowStart));
  const paused = now < FIRST_OPEN_AT || count >= REQUEST_LIMIT;
  return { paused, count, limit: REQUEST_LIMIT, unlockAt: paused ? nextUnlockAt(now) : null };
}

const teamOnly = adminProcedure.use(({ ctx, next }) => {
  if (ctx.user.loginMethod !== "team-code" || ctx.user.openId !== "disco-patio-team") throw new TRPCError({ code: "FORBIDDEN", message: "Necesitas el código privado de acceso." });
  return next({ ctx });
});

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
    login: publicProcedure.input(z.object({ code: z.string().trim().regex(/^[A-Z0-9]{21}$/i, "El código debe tener 21 caracteres") })).mutation(async ({ ctx, input }) => {
      if (!isValidTeamCode(input.code)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código incorrecto" });
      setTeamCookie(ctx.res, ctx.req, await createTeamSession());
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearTeamCookie(ctx.res, ctx.req);
      return { success: true } as const;
    }),
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
    status: publicProcedure.query(() => getPauseState()),
    checkAccessCode: publicProcedure.input(z.object({ code: z.string().trim().regex(/^[A-Z0-9]{21}$/i) })).mutation(async ({ input }) => ({ valid: await isAccessCodeAvailable(input.code.toUpperCase()) })),
    create: publicProcedure.input(requestInput).mutation(async ({ input }) => {
      if (input.termsVersion !== TERMS_VERSION) throw new TRPCError({ code: "BAD_REQUEST", message: "Debes aceptar la versión actual de los términos." });
      if (isLikelyExplicitSong(input.songTitle, input.artist) && !input.explicitWarningAccepted) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta canción parece contener contenido explícito. Confirma que quieres enviarla." });
      const pause = await getPauseState();
      const code = input.accessCode?.toUpperCase();
      if (pause.paused) {
        if (!code || !(await redeemAccessCode(code))) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Estamos recibiendo muchas solicitudes. Por favor, espera hasta que pase el tiempo del contador, o utiliza un código válido de un solo uso." });
      }
      const { explicitWarningAccepted: _explicitWarningAccepted, accessCode: _accessCode, ...request } = input;
      const result = await createSongRequest({ ...request, status: "pending" });
      return { success: true, id: result.id } as const;
    }),
    adminList: teamOnly.query(() => listSongRequests()),
    update: teamOnly.input(z.object({ id: z.number().int(), status: z.enum(["pending", "selected", "played", "rejected"]), notes: z.string().max(1000).optional() })).mutation(({ input }) => updateSongRequest(input.id, { status: input.status, notes: input.notes })),
  }),
  feedback: router({
    submit: publicProcedure.input(z.object({ requestId: z.number().int().positive(), rating: z.number().int().min(1).max(5) })).mutation(({ input }) => createSiteFeedback(input)),
    adminList: teamOnly.query(() => listSiteFeedback()),
  }),
});

export type AppRouter = typeof appRouter;
