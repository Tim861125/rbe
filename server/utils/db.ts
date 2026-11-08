import { GROUPS, findGroup, type GroupKey } from "./groups";

export type GroupRow = { key: GroupKey; name: string; count: number };

type CountRow = { key: string; count: number };

/**
 * 讀取四組人數，結果依 GROUPS 定義順序（台北/中壢/新竹/台中）重排，不受 DB 回傳順序影響。
 */
export async function listGroups(db: D1Database): Promise<GroupRow[]> {
  const { results } = await db
    .prepare("SELECT key, count FROM groups")
    .all<CountRow>();

  const countByKey = new Map<string, number>();
  for (const row of results ?? []) {
    countByKey.set(row.key, row.count);
  }

  return GROUPS.map((g) => ({ ...g, count: countByKey.get(g.key) ?? 0 }));
}

export function isValidGroupKey(key: string): boolean {
  return findGroup(key) !== undefined;
}

/**
 * 套用一次人數異動。
 * 核心寫入為單一原子相對增量：`count = count + ? ... AND count + ? >= 0`，
 * guard 在 DB 端判定（key 不存在或會減成負數 → 0 列被改寫），避免
 * 「先 SELECT、再以預算好的絕對值 UPDATE」的 lost-update（TOCTOU）問題。
 * 不使用 batch（D1 batch 非條件式：guard 未通過時第二句 INSERT 仍會執行，
 * 而寫入一筆「未生效異動」紀錄，違反 spec 硬不變量）。改為順序式：
 * 1. UPDATE 先 `.run()`，以其 `meta.changes` 判斷成功與否；changes=0 → 直接回 null，
 *    此路徑**不寫任何 updates 紀錄**（不送出 INSERT）。
 * 2. 通過後才 `INSERT INTO updates (group_key, amount)` `.run()`。
 * 3. 最後 SELECT 一次取得 DB 權威值回傳（並行下計算值不可信）。
 */
export async function adjustGroup(
  db: D1Database,
  key: string,
  amount: number,
): Promise<GroupRow | null> {
  const group = findGroup(key);
  if (!group) return null;

  const updateResult = await db
    .prepare("UPDATE groups SET count = count + ? WHERE key = ? AND count + ? >= 0")
    .bind(amount, key, amount)
    .run();
  if ((updateResult.meta?.changes ?? 0) === 0) return null;

  await db
    .prepare("INSERT INTO updates (group_key, amount) VALUES (?, ?)")
    .bind(key, amount)
    .run();

  const row = await db
    .prepare("SELECT key, count FROM groups WHERE key = ?")
    .bind(key)
    .first<CountRow>();
  if (!row) return null;

  return { ...group, count: row.count };
}
