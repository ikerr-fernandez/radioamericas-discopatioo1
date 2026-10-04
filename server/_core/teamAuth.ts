import { timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { CookieOptions, Request, Response } from "express";
import { TEAM_COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";

export const TEAM_ACCESS_CODES = ["4719RADIEROS2026", "VZXT5D4YGB0XR90P1F62F"] as const;
export const TEAM_ACCESS_CODE = "VZXT5D4YGB0XR90P1F62F";
export const OWNER_ACCESS_CODE = "X9RJX2OY5W03N87PVBBIE";
export const LEGACY_SINGLE_USE_CODE = "NV4SXULY75CS1DABNGXD0";
const TEAM_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const secretKey = () => new TextEncoder().encode(ENV.cookieSecret || "disco-patio-local-secret");
const safeEqual = (value: string, expectedValue: string) => {
  const received = Buffer.from(value.trim().toUpperCase());
  const expected = Buffer.from(expectedValue);
  return received.length === expected.length && timingSafeEqual(received, expected);
};

export function accessCodeRole(value: string): "owner" | "team" | null {
  if (safeEqual(value, OWNER_ACCESS_CODE)) return "owner";
  if (TEAM_ACCESS_CODES.some(code => safeEqual(value, code))) return "team";
  return null;
}

export function isValidTeamCode(value: string) {
  return accessCodeRole(value) !== null;
}

export async function createTeamSession(role: "owner" | "team" = "team") {
  return new SignJWT({ kind: "disco-patio-team", accessRole: role, name: role === "owner" ? "Propietario Radio Patio" : "Equipo Disco Patio" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + TEAM_SESSION_TTL_MS) / 1000))
    .sign(secretKey());
}

export async function verifyTeamSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.kind !== "disco-patio-team") return null;
    return payload.accessRole === "owner" ? "owner" : "team";
  } catch {
    return null;
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
