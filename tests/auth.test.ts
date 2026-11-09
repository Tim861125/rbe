import { describe, expect, it } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { requireAccess } from "../server/utils/auth";

/**
 * auth.ts 是純模組：不 import nitro 別名，H3Event 僅 type-only import。
 * 測試以 fake event（只需 headers）＋注入 deps.getKeySet（本地 JWKS），
 * 走真實 jose.jwtVerify，零網路。
 */
type FakeEvent = { headers: Record<string, string> };
const fakeEvent = (headers: Record<string, string> = {}): FakeEvent => ({ headers });

const JWT_HEADER = "cf-access-jwt-assertion";
const ENV = {
  CF_ACCESS_TEAM_DOMAIN: "https://x.cloudflareaccess.com",
  CF_ACCESS_AUD: "aud1",
};

async function makeKey() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  return { privateKey, jwks: { keys: [{ ...jwk, alg: "RS256", use: "sig" }] } };
}

const sign = (privateKey: CryptoKey, iss: string, aud: string, exp: number) =>
  new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(iss)
    .setAudience(aud)
    .setExpirationTime(exp)
    .sign(privateKey);

const now = () => Math.floor(Date.now() / 1000);

describe("requireAccess", () => {
  it("未設 CF_ACCESS_AUD → true 且不讀 header", async () => {
    // env 沒有 CF_ACCESS_AUD（連 team domain 也沒有）→ dev/mock 直通；
    // deps 全炸的 stub 證明 header 與 verify 完全沒被碰。
    const ok = await requireAccess(fakeEvent() as never, {} as never, {
      getKeySet: () => {
        throw new Error("must not be called");
      },
    } as never);
    expect(ok).toBe(true);
  });

  it("有 AUD 設定但缺 jwt header → false", async () => {
    const ok = await requireAccess(fakeEvent() as never, ENV as never, {
      getKeySet: async () => {
        throw new Error("verify should not be called without a header");
      },
    } as never);
    expect(ok).toBe(false);
  });

  it("header 帶假 token → false", async () => {
    const ok = await requireAccess(
      fakeEvent({ [JWT_HEADER]: "not-a-jwt" }) as never,
      ENV as never,
    );
    expect(ok).toBe(false);
  });

  it("合法 token（本地 JWKS 注入）→ true", async () => {
    const { privateKey, jwks } = await makeKey();
    const token = await sign(privateKey, "x.cloudflareaccess.com", "aud1", now() + 3600);
    const ok = await requireAccess(
      fakeEvent({ [JWT_HEADER]: token }) as never,
      ENV as never,
      { getKeySet: jwks as never },
    );
    expect(ok).toBe(true);
  });

  it("TEAM_DOMAIN 帶 https:// 時，仍比對 bare team domain 的 iss", async () => {
    // 真實 CF Access JWT 的 iss 是裸網域；secret 文件寫法帶 protocol。
    // 若實作未 strip protocol，jose 的 exact-string issuer 比對會失敗 → false。
    const { privateKey, jwks } = await makeKey();
    const token = await sign(privateKey, "x.cloudflareaccess.com", "aud1", now() + 3600);
    const ok = await requireAccess(
      fakeEvent({ [JWT_HEADER]: token }) as never,
      ENV as never,
      { getKeySet: jwks as never },
    );
    expect(ok).toBe(true);
  });

  it("過期 token → false", async () => {
    const { privateKey, jwks } = await makeKey();
    const token = await sign(privateKey, "x.cloudflareaccess.com", "aud1", now() - 60);
    const ok = await requireAccess(
      fakeEvent({ [JWT_HEADER]: token }) as never,
      ENV as never,
      { getKeySet: jwks as never },
    );
    expect(ok).toBe(false);
  });

  it("audience 不符 → false", async () => {
    const { privateKey, jwks } = await makeKey();
    const token = await sign(privateKey, "x.cloudflareaccess.com", "other-aud", now() + 3600);
    // iss 對、aud 錯
    const ok = await requireAccess(
      fakeEvent({ [JWT_HEADER]: token }) as never,
      ENV as never,
      { getKeySet: jwks as never },
    );
    expect(ok).toBe(false);
  });

  it("issuer 是其他 team → false", async () => {
    const { privateKey, jwks } = await makeKey();
    const token = await sign(privateKey, "evil.cloudflareaccess.com", "aud1", now() + 3600);
    const ok = await requireAccess(
      fakeEvent({ [JWT_HEADER]: token }) as never,
      ENV as never,
      { getKeySet: jwks as never },
    );
    expect(ok).toBe(false);
  });
});
