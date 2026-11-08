export type GroupKey = "taipei" | "zhongli" | "hsinchu" | "taichung";

export const GROUPS: Array<{ key: GroupKey; name: string }> = [
  { key: "taipei", name: "台北" },
  { key: "zhongli", name: "中壢" },
  { key: "hsinchu", name: "新竹" },
  { key: "taichung", name: "台中" },
];

export function findGroup(key: string): { key: GroupKey; name: string } | undefined {
  return GROUPS.find((g) => g.key === key);
}
