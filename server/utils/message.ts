import { GROUPS } from "./groups";

/**
 * 組合 LINE 公告訊息。
 * groups 可亂序輸入，輸出依 GROUPS 順序（台北→中壢→新竹→台中）。
 * 格式（硬驗收字串，不得更動）：
 *   {groupName}新增{delta}人參加，目前各組人數如下
 *   {name} {count} 人   ← 每組一行
 */
export function buildAnnouncement(
  groupName: string,
  delta: number,
  groups: Array<{ name: string; count: number }>,
): string {
  const countByName = new Map(groups.map((g) => [g.name, g.count]));
  const lines = GROUPS.map((g) => `${g.name} ${countByName.get(g.name) ?? 0} 人`);
  return `${groupName}新增${delta}人參加，目前各組人數如下\n${lines.join("\n")}`;
}
