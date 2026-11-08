import { isValidGroupKey, adjustGroup, listGroups } from "../../../utils/db";
import { parseAmount } from "../../../utils/validation";
import { buildAnnouncement } from "../../../utils/message";
import { sendLineAnnouncement } from "../../../utils/line";

/**
 * POST /api/groups/:key/registrations
 * body: { amount }
 * 成功 200: { ok: true, count, announced, lineSent }
 * - announced = amount > 0
 * - lineSent：announced 時組合公告訊息並送 LINE；未設 token/group 時 sendLineAnnouncement
 *   以 console 印整段訊息並回 false（mock fallback）。未 announce 時不呼叫、恆 false。
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

  const announced = parsed.amount > 0;
  let lineSent = false;
  if (announced) {
    const updatedGroups = await listGroups(env.DB); // 已依 GROUPS 順序重排
    lineSent = await sendLineAnnouncement(
      buildAnnouncement(row.name, parsed.amount, updatedGroups),
      env, // 型式：{ LINE_CHANNEL_ACCESS_TOKEN, LINE_GROUP_ID }（缺任一 → console 印訊息，回 false）
    );
  }

  return {
    ok: true,
    count: row.count,
    announced,
    lineSent,
  };
});
