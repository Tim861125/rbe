import { GROUPS, findGroup } from "./groups";
export type { GroupKey } from "./groups";
export { GROUPS, findGroup } from "./groups";

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
 * 回傳 null：key 不存在，或套用後人數小於 0（兩者皆不會寫入 DB）。
 * 成功時以 db.batch() 原子性寫入：UPDATE groups 的新人數 + INSERT updates 的異動紀錄。
 */
export async function adjustGroup(
  db: D1Database,
  key: string,
  amount: number,
): Promise<GroupRow | null> {
  const group = findGroup(key);
  if (!group) return null;

  const row = await db
    .prepare("SELECT key, count FROM groups WHERE key = ?")
    .bind(key)
    .first<CountRow>();
  if (!row) return null;

  const newCount = row.count + amount;
  if (newCount < 0) return null;

  await db.batch([
    db.prepare("UPDATE groups SET count = ? WHERE key = ?").bind(newCount, key),
    db.prepare("INSERT INTO updates (group_key, amount) VALUES (?, ?)").bind(key, amount),
  ]);

  return { ...group, count: newCount };
}
