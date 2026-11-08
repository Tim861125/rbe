export type LineEnv = {
  LINE_CHANNEL_ACCESS_TOKEN?: string | undefined;
  LINE_GROUP_ID?: string | undefined;
};

export type LineLogger = { log: (...args: unknown[]) => void };

const PUSH_URL = "https://api.line.me/v2/bot/message/push";

/**
 * 送出 LINE 群組公告。
 * - token 或 groupId 缺任一 → 用 logger（預設 console）印整段訊息、不 fetch、回 false。
 * - 有齊 → POST {PUSH_URL}，headers Authorization: Bearer <token>，
 *   body { to, messages: [{ type: "text", text }] }。
 * - 非 2xx / fetch 丟錯 → log 錯、回 false；2xx → true。
 */
export async function sendLineAnnouncement(
  message: string,
  env: LineEnv,
  logger?: LineLogger,
): Promise<boolean> {
  const log = logger ?? console;
  const token = env?.LINE_CHANNEL_ACCESS_TOKEN;
  const groupId = env?.LINE_GROUP_ID;

  if (!token || !groupId) {
    log.log(message);
    return false;
  }

  try {
    const response = await fetch(PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: groupId, messages: [{ type: "text", text: message }] }),
    });
    if (!response.ok) {
      log.log(`[line] push failed: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    log.log(`[line] push error: ${error}`);
    return false;
  }
}
