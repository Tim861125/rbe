import { requireAccess } from "../utils/auth";

/**
 * 僅攔 /api/*：站前由 Cloudflare Access 保護，這裡擋的是繞過 Access
 * 直接打 API 的呼叫（缺 / 假 / 過期的 Access JWT）。
 * SSR 頁面不在程式內驗證（由 Access edge 保護）。
 * CF_ACCESS_AUD 未設（dev/mock）→ requireAccess 直通。
 */
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) return;

  const ok = await requireAccess(event);
  if (!ok) {
    throw createError({
      statusCode: 401,
      data: { ok: false, error: "unauthorized" },
    });
  }
});
