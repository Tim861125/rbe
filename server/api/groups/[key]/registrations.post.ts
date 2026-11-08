import { isValidGroupKey, adjustGroup } from "../../../utils/db";
import { parseAmount } from "../../../utils/validation";

/**
 * POST /api/groups/:key/registrations
 * body: { amount }
 * 成功 200: { ok: true, count, announced, lineSent }（announced = amount > 0；lineSent 本 task 恆 false，Task 5 串接 LINE 後改寫）
 * 驗證失敗 400: { ok: false, error }
 */
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key");
  if (!key || !isValidGroupKey(key)) {
    setResponseStatus(event, 400);
    return { ok: false, error: "未知小組" };
  }

  const body = await readBody<{ amount?: unknown }>(event).catch(() => undefined);
  const parsed = parseAmount(body?.amount ?? null);
  if (!parsed.ok) {
    setResponseStatus(event, 400);
    return { ok: false, error: parsed.error };
  }

  const env = event.context.cloudflare?.env;
  if (!env?.DB) {
    throw createError({
      statusCode: 500,
      statusMessage: "D1 binding 'DB' is not available",
    });
  }

  const row = await adjustGroup(env.DB, key, parsed.amount);
  if (!row) {
    setResponseStatus(event, 400);
    return { ok: false, error: "人數不足，不得減少超過目前人數" };
  }

  return {
    ok: true,
    count: row.count,
    announced: parsed.amount > 0,
    lineSent: false, // Task 5 串接 LINE 通知後改寫
  };
});
