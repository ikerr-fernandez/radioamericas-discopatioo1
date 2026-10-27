import { timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { CookieOptions, Request, Response } from "express";
import { TEAM_COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";

export const TEAM_ACCESS_CODES = ["4719RADIEROS2026", "VZXT5D4YGB0XR90P1F62F"] as const;
export const TEAM_ACCESS_CODE = "VZXT5D4YGB0XR90P1F62F";
export const LEGACY_SINGLE_USE_CODE = "NV4SXULY75CS1DABNGXD0";
export const PUBLIC_ACCESS_COOKIE_NAME = "disco_patio_public_access";
export const PUBLIC_ACCESS_CODE = "JUEVES";
const secretKey = () => new TextEncoder().encode(ENV.cookieSecret || "disco-patio-local-secret");
const safeEqual = (value: string, expectedValue: string) => {
  const received = Buffer.from(value.trim().toUpperCase());
  const expected = Buffer.from(expectedValue);
  return received.length === expected.length && timingSafeEqual(received, expected);
};

export function accessCodeRole(value: string): "owner" | "team" | null {
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
  return { httpOnly: true, path: "/", sameSite: "none", secure: isHttps };
}

export function setTeamCookie(res: Response, req: Request, token: string) {
  res.cookie(TEAM_COOKIE_NAME, token, teamCookieOptions(req));
}

export function clearTeamCookie(res: Response, req: Request) {
  res.clearCookie(TEAM_COOKIE_NAME, { ...teamCookieOptions(req), maxAge: -1 });
}

export async function createPublicAccessSession() {
  return new SignJWT({ kind: "disco-patio-public-access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .sign(secretKey());
}

export async function verifyPublicAccessSession(token: string | undefined) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.kind === "disco-patio-public-access";
  } catch {
    return false;
  }
}

export function setPublicAccessCookie(res: Response, req: Request, token: string) {
  res.cookie(PUBLIC_ACCESS_COOKIE_NAME, token, { ...teamCookieOptions(req), maxAge: 31536000000 });
}

export function clearPublicAccessCookie(res: Response, req: Request) {
  res.clearCookie(PUBLIC_ACCESS_COOKIE_NAME, { ...teamCookieOptions(req), maxAge: -1 });
}
