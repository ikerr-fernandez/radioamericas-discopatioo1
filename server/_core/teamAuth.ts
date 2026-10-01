import { timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { CookieOptions, Request, Response } from "express";
import { TEAM_COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";

export const TEAM_ACCESS_CODE = "VZXT5D4YGB0XR90P1F62F";
const TEAM_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const secretKey = () => new TextEncoder().encode(ENV.cookieSecret || "disco-patio-local-secret");

export function isValidTeamCode(value: string) {
  const received = Buffer.from(value.trim().toUpperCase());
  const expected = Buffer.from(TEAM_ACCESS_CODE);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function createTeamSession() {
  return new SignJWT({ kind: "disco-patio-team", name: "Equipo Disco Patio" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + TEAM_SESSION_TTL_MS) / 1000))
    .sign(secretKey());
}

export async function verifyTeamSession(token: string | undefined) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.kind === "disco-patio-team";
  } catch {
    return false;
  }
}

export function teamCookieOptions(req: Request): CookieOptions {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps = req.protocol === "https" || (typeof forwardedProto === "string" && forwardedProto.split(",").some(value => value.trim() === "https"));
  return { httpOnly: true, path: "/", sameSite: "none", secure: isHttps, maxAge: TEAM_SESSION_TTL_MS };
}

export function setTeamCookie(res: Response, req: Request, token: string) {
  res.cookie(TEAM_COOKIE_NAME, token, teamCookieOptions(req));
}

export function clearTeamCookie(res: Response, req: Request) {
  res.clearCookie(TEAM_COOKIE_NAME, { ...teamCookieOptions(req), maxAge: -1 });
}
