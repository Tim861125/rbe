import type { H3Event } from "h3";
import {
  createRemoteJWKSet,
  importJWK,
  jwtVerify,
  type JWK,
  type JWKS,
  type JWTVerifyGetKey,
} from "jose";

/**
 * Cloudflare Access JWT 驗證（僅 /api/*，由 server/middleware/0.auth.ts 呼叫）。
 *
 * 純模組：不 import nitro 別名（`#imports`、`~`），H3Event 僅 type-only import，
 * header 以本地 getHeader 讀取，方便 bun test 餵 fake event；verify 邊界（getKeySet）
 * 可注入，測試用本地 JWKS，不需網路。
 */

const JWT_HEADER = "cf-access-jwt-assertion";

export type AccessEnv = {
  CF_ACCESS_TEAM_DOMAIN?: string | undefined;
  CF_ACCESS_AUD?: string | undefined;
};

export type AccessDeps = {
  /** 驗證金鑰來源：JWTVerifyGetKey、回傳 JWKS 的 async function，或靜態 JWKS 物件（測試注入用）。 */
  getKeySet?: JWTVerifyGetKey | (() => Promise<JWKS>) | JWKS;
};

/** 讀 request header；fake event 只需 `headers` record，真 H3Event 走 headers.get()。 */
function getHeader(event: H3Event | { headers?: Record<string, string> }, name: string) {
  const raw =
    event.headers instanceof Headers
      ? event.headers.get(name)
      : event.headers?.[name] ?? event.headers?.[name.toLowerCase()];
  return raw ?? undefined;
}

/** secret 文件寫法 `https://<team>.cloudflareaccess.com`；JWT `iss` 是裸網域，需 strip protocol。 */
export function normalizeIssuer(teamDomain: string): string {
  return teamDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

const jwksCache = new Map<string, JWTVerifyGetKey>();
const remoteJwksFor = (teamDomain: string): JWTVerifyGetKey => {
  const issuer = normalizeIssuer(teamDomain);
  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${issuer}/cdn-cgi/access/certs`));
    jwksCache.set(issuer, jwks);
  }
  return jwks;
};

/**
 * - `CF_ACCESS_AUD` 未設 → true（dev/mock 模式，不讀 header）。
 * - 有設 → 須有 `cf-access-jwt-assertion` header，且 jwtVerify 成功
 *   （issuer = TEAM_DOMAIN 減去 protocol，audience = AUD），否則 false。
 */
export async function requireAccess(
  event: H3Event,
  env: AccessEnv = event.context.cloudflare?.env ?? {},
  deps: AccessDeps = {},
): Promise<boolean> {
  const aud = env.CF_ACCESS_AUD;
  if (!aud) return true;

  const raw = getHeader(event, JWT_HEADER);
  if (!raw) return false;

  const depsSource = deps.getKeySet ?? remoteJwksFor(env.CF_ACCESS_TEAM_DOMAIN ?? "");
  // 注入邊界可傳 JWTVerifyGetKey 或靜態 JWKS 物件（測試用）；後者 jwtVerify 不直接支援，
  // 由首把 key 解出驗證金鑰。
  const getKeySet: JWTVerifyGetKey =
    typeof depsSource === "function"
      ? (depsSource as JWTVerifyGetKey)
      : async (protectedHeader) => {
          const jwk = (depsSource as JWKS).keys[0] as JWK | undefined;
          if (!jwk) throw new Error("JWKS has no keys");
          return importJWK({ ...jwk, alg: jwk.alg ?? protectedHeader.alg }, protectedHeader.alg);
        };

  try {
    await jwtVerify(raw, getKeySet, {
      issuer: normalizeIssuer(env.CF_ACCESS_TEAM_DOMAIN ?? ""),
      audience: aud,
    });
    return true;
  } catch {
    return false;
  }
}
