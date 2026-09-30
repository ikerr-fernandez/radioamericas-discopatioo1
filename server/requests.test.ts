import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { TEAM_ACCESS_CODE } from "./_core/teamAuth";
import { HIDDEN_REQUEST_IDS } from "./db";
import { isLikelyExplicitSong, TERMS_VERSION } from "../shared/contentModeration";

function context(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const teamContext = () => context({ id: 0, openId: "disco-patio-team", email: null, name: "Equipo Disco Patio", loginMethod: "team-code", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });

describe("song requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns an audio preview from the music search", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [{ trackId: 7, trackName: "Tema", artistName: "Artista", previewUrl: "https://example.com/preview.m4a", trackExplicitness: "explicit" }] }), { status: 200 })));
    const result = await appRouter.createCaller(teamContext()).music.search({ query: "Tema" });
    expect(result[0]).toMatchObject({ title: "Tema", artist: "Artista", previewUrl: "https://example.com/preview.m4a", explicitness: "explicit" });
  });

  it("rejects a request without the required artist", async () => {
    const caller = appRouter.createCaller(teamContext());
    await expect(caller.requests.create({ songTitle: "Una canción" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps the admin list private", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.requests.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps the four requested records outside the mailbox", () => {
    expect(HIDDEN_REQUEST_IDS).toEqual([1, 30001, 240001, 270001]);
  });

  it("accepts the team code without Manus login", async () => {
    const setCookie = vi.fn();
    const caller = appRouter.createCaller({ ...context(), res: { cookie: setCookie } as TrpcContext["res"] });
    await expect(caller.team.login({ code: TEAM_ACCESS_CODE })).resolves.toEqual({ success: true });
    expect(setCookie).toHaveBeenCalledOnce();
  });

  it("rejects an incorrect team code", async () => {
    const caller = appRouter.createCaller({ ...context(), res: { cookie: vi.fn() } as TrpcContext["res"] });
    await expect(caller.team.login({ code: "AAAAAAAAAAAAAAAAAAAAA" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("blocks an explicit request until the warning is confirmed", async () => {
    const caller = appRouter.createCaller(teamContext());
    await expect(caller.requests.create({ songTitle: "F0LLAAAAAR", artist: "Artista", requesterName: "Alumno", course: "4º ESO", termsAccepted: true, termsVersion: TERMS_VERSION, explicitWarningAccepted: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("detects accents, obfuscation and explicit phrases", () => {
    expect(isLikelyExplicitSong("PÚTAAAA", "Artista")).toBe(true);
    expect(isLikelyExplicitSong("Dame más", "Artista")).toBe(true);
    expect(isLikelyExplicitSong("Canción normal", "Artista", "explicit")).toBe(true);
    expect(isLikelyExplicitSong("Canción normal", "Artista", "notExplicit")).toBe(false);
  });

  it("rejects invalid status updates", async () => {
    const caller = appRouter.createCaller(teamContext());
    await expect(caller.requests.update({ id: 1, status: "unknown" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
