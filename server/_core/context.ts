import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parse as parseCookieHeader } from "cookie";
import { TEAM_COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { verifyTeamSession } from "./teamAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
  if (await verifyTeamSession(cookies[TEAM_COOKIE_NAME])) {
    const now = new Date();
    user = {
      id: 0,
      openId: "disco-patio-team",
      name: "Equipo Disco Patio",
      email: null,
      loginMethod: "team-code",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  }

  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
