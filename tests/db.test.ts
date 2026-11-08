import { describe, it, expect } from "bun:test";
import { GROUPS, findGroup, type GroupKey } from "../server/utils/groups";
import { listGroups, adjustGroup, isValidGroupKey } from "../server/utils/db";

/**
 * 極簡 D1 stub：
 * - prepare(sql) → statement（可 bind(...params)，鏈式）
 * - first() 支援 `SELECT ... FROM groups WHERE key = ?`
 * - all() 支援 `SELECT key, count FROM groups`，回 目前內部資料列
 * - run() 依 guard 語義執行並記錄 SQL/參數：
 *   - UPDATE `count = count + ? ... AND count + ? >= 0`：以 guard 判定，通過才套用，
 *     回 { meta: { changes: 1 } }；不通過（key 不存在或會減成負數）回 changes: 0。
 *   - 其餘語句回 { meta: { changes: 1 } }。
 * - adjustGroup 為順序式兩次 .run()，無 batch；changes=0 時 INSERT 不會被送出。
 */
function createStubD1(initial?: Array<{ key: GroupKey; count: number }>) {
  const rows: Array<{ key: GroupKey; name: string; count: number }> =
    initial
      ? initial.map((i) => ({ ...GROUPS.find((g) => g.key === i.key)!, count: i.count }))
      : GROUPS.map((g) => ({ ...g, count: 0 }));

  const executed: Array<{ sql: string; params: unknown[] }> = [];

  const ADJUST_SQL = "UPDATE groups SET count = count + ? WHERE key = ? AND count + ? >= 0";

  type Stub = {
    sql: string;
    params: unknown[];
    bind: (...params: unknown[]) => Stub;
    first: <T>() => Promise<T | null>;
    all: <T>() => Promise<{ results: T[] }>;
    run: () => Promise<unknown>;
  };

  const makeStatement = (sql: string): Stub => {
    const statement: Stub = {
      sql,
      params: [],
      bind(...params: unknown[]) {
        statement.params = params;
        return statement;
      },
      async first<T>() {
        executed.push({ sql, params: statement.params });
        if (sql.includes("FROM groups WHERE key = ?")) {
          const found = rows.find((r) => r.key === statement.params[0]);
          return found ? ({ key: found.key, count: found.count } as T) : null;
        }
        return null;
      },
      async all<T>() {
        executed.push({ sql, params: statement.params });
        if (sql.includes("SELECT key, count FROM groups")) {
          return {
            results: rows.map((r) => ({ key: r.key, count: r.count })) as T[],
          };
        }
        return { results: [] as T[] };
      },
      async run() {
        executed.push({ sql, params: statement.params });
        if (sql === ADJUST_SQL) {
          const [amount, key] = statement.params;
          const row = rows.find((r) => r.key === key);
          if (row && row.count + (amount as number) >= 0) {
            row.count += amount as number;
            return { meta: { changes: 1 } };
          }
          // guard 未通過（key 不存在 / 會減成負數）→ 0 列被改寫
          return { meta: { changes: 0 } };
        }
        return { meta: { changes: 1 } };
      },
    };
    return statement;
  };

  const db = {
    prepare(sql: string) {
      return makeStatement(sql);
    },
  };

  return { db: db as unknown as D1Database, rows, executed };
}

describe("groups.ts", () => {
  it("GROUPS 依序為 台北/中壢/新竹/台中", () => {
    expect(GROUPS.map((g) => g.key)).toEqual([
      "taipei",
      "zhongli",
      "hsinchu",
      "taichung",
    ]);
    expect(GROUPS.map((g) => g.name)).toEqual(["台北", "中壢", "新竹", "台中"]);
  });

  it("findGroup 命中已知 key；未知回 undefined", () => {
    expect(findGroup("taipei")).toEqual({ key: "taipei", name: "台北" });
    expect(findGroup("nope")).toBeUndefined();
  });
});

describe("listGroups", () => {
  it("依 GROUPS 順序回傳（DB 亂序也重排）", async () => {
    const { db } = createStubD1();
    const result = await listGroups(db);
    expect(result.map((g) => g.key)).toEqual(GROUPS.map((g) => g.key));
    expect(result.map((g) => g.name)).toEqual(GROUPS.map((g) => g.name));
    expect(result.every((g) => g.count === 0)).toBe(true);
  });

  it("DB 亂序資料也正確對應 count（回傳仍依 GROUPS 順序）", async () => {
    // stub 的 all() 依 rows 陣列既有順序回傳 → 這裡刻意用亂序初始化，模擬 DB 回傳順序不受控
    const { db } = createStubD1([
      { key: "taichung", count: 9 },
      { key: "hsinchu", count: 3 },
      { key: "taipei", count: 1 },
      { key: "zhongli", count: 7 },
    ]);
    const result = await listGroups(db);
    expect(result.map((g) => g.key)).toEqual(GROUPS.map((g) => g.key)); // 順序重排
    const byKey = Object.fromEntries(result.map((g) => [g.key, g.count]));
    expect(byKey).toEqual({
      taipei: 1,
      zhongli: 7,
      hsinchu: 3,
      taichung: 9,
    });
  });
});

describe("adjustGroup", () => {
  it("核心寫入為順序式兩次 .run()：guard UPDATE 先行（bind (amount, key, amount)）、INSERT 後置", async () => {
    const { db, executed } = createStubD1([{ key: "hsinchu", count: 5 }]);
    await adjustGroup(db, "hsinchu", 2);
    // 順序式：UPDATE 先送出（取得 changes 判斷），INSERT 待 UPDATE 通過後才執行
    expect(executed.slice(0, 2)).toEqual([
      {
        sql: "UPDATE groups SET count = count + ? WHERE key = ? AND count + ? >= 0",
        params: [2, "hsinchu", 2],
      },
      { sql: "INSERT INTO updates (group_key, amount) VALUES (?, ?)", params: ["hsinchu", 2] },
    ]);
  });

  it("成功 → UPDATE 套用相對增量、INSERT 記錄異動、回傳 DB 權威值", async () => {
    const { db, rows, executed } = createStubD1([{ key: "hsinchu", count: 5 }]);
    const result = await adjustGroup(db, "hsinchu", 2);
    expect(result).toEqual({ key: "hsinchu", name: "新竹", count: 7 });

    // stub 已套用相對增量效果 → 後續查詢反映新值
    expect(rows.find((r) => r.key === "hsinchu")!.count).toBe(7);

    // 執行序列：UPDATE（成功）→ INSERT → 事後 SELECT 權威值
    expect(executed.map((e) => e.sql)).toEqual([
      "UPDATE groups SET count = count + ? WHERE key = ? AND count + ? >= 0",
      "INSERT INTO updates (group_key, amount) VALUES (?, ?)",
      "SELECT key, count FROM groups WHERE key = ?",
    ]);

    const after = await listGroups(db);
    expect(after.find((g) => g.key === "hsinchu")!.count).toBe(7);
  });

  it("guard 生效（changes=0）：回 null、不寫入，且完全沒有任何 INSERT 發生", async () => {
    const { db, rows, executed } = createStubD1([{ key: "taipei", count: 1 }]);
    const result = await adjustGroup(db, "taipei", -2);
    expect(result).toBeNull();
    // count 未被改動
    expect(rows.find((r) => r.key === "taipei")!.count).toBe(1);
    // spec 硬不變量：UPDATE changes=0 時不得寫任何 updates 紀錄 —— INSERT 根本未送出
    expect(executed.map((e) => e.sql)).toEqual([
      "UPDATE groups SET count = count + ? WHERE key = ? AND count + ? >= 0",
    ]);
    expect(executed.some((e) => e.sql.includes("INSERT INTO updates"))).toBe(false);
  });

  it("扣減剛好歸零 → guard 通過（count+amount>=0），成功回 count=0", async () => {
    const { db, rows } = createStubD1([{ key: "zhongli", count: 3 }]);
    const result = await adjustGroup(db, "zhongli", -3);
    expect(result).toEqual({ key: "zhongli", name: "中壢", count: 0 });
    expect(rows.find((r) => r.key === "zhongli")!.count).toBe(0);
  });

  it("未知 key → findGroup 短路回 null（不送任何語句）", async () => {
    const { db, rows, executed } = createStubD1();
    expect(await adjustGroup(db, "kaohsiung", 1)).toBeNull();
    expect(executed).toHaveLength(0);
    expect(rows.every((r) => r.count === 0)).toBe(true);
  });
});

describe("isValidGroupKey", () => {
  it("已知 key → true", () => {
    for (const g of GROUPS) expect(isValidGroupKey(g.key)).toBe(true);
  });

  it("大小寫不符 / 未知 → false", () => {
    expect(isValidGroupKey("TAIPEI")).toBe(false);
    expect(isValidGroupKey("Taipei ")).toBe(false);
    expect(isValidGroupKey("kaohsiung")).toBe(false);
    expect(isValidGroupKey("")).toBe(false);
  });
});
