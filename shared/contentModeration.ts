export const TERMS_VERSION = "2026-09-27-23:31";
export const TERMS_LAST_UPDATED = "27/09/2026 · 23:31";
export const SITE_LAST_UPDATED = "02/10/2026 · 18:37";

const sensitivePatterns = [
  /\bput+a+s?\w*\b/,
  /\bsex(?:o|ual|uales)\w*\b/,
  /\bf+o+l{1,3}a{1,8}r\w*\b/,
  /\bc+o+g+e+r\w*\b/,
  /\bc+o+j+e+r\w*\b/,
  /\bpenetr+a+r\w*\b/,
  /\b(mamad+a|mama+r|poll+a|pen+e|verg+a|coñ+o|tet+a+s?|cul+o|porong+a)\w*\b/,
  /\b(jod+e+r|cabr+o+n|gilipoll)\w*\b/,
  /\b(f+u+c+k+|b+i+t+c+h|whor+e|sl+u+t|d+i+c+k|p+u+s+s+y|a+s+shol+e|nigg+a|nigg+e+r)\w*\b/,
  /\bdame\s+mas\b/,
  /\bhazme\s+tuya\b/,
];

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[@4]/g, "a")
  .replace(/[0]/g, "o")
  .replace(/[1!]/g, "i")
  .replace(/[3]/g, "e")
  .replace(/[5$]/g, "s");

export function isLikelyExplicitSong(title: string, artist: string, explicitness?: string) {
  if (explicitness === "explicit") return true;
  const normalized = normalize(`${title} ${artist}`);
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return sensitivePatterns.some(pattern => pattern.test(normalized) || pattern.test(compact));
}
