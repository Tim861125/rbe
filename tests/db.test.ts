import { describe, it, expect } from "bun:test";
import { GROUPS, findGroup, type GroupKey } from "../server/utils/groups";
import {
  listGroups,
  adjustGroup,
  isValidGroupKey,
  type GroupRow,
} from "../server/utils/db";

/**
 * 極簡 D1 stub：
 * - prepare(sql) → statement（可 bind(...params)，鏈式）
 * - first() 支援 `SELECT ... FROM groups WHERE key = ?`
 * - all() 支援 `SELECT key, count FROM groups`，回 目前內部資料列
 * - batch() 記錄語句與參數，並真的套用 UPDATE groups SET count=? 的效果（供後續查詢驗證）
 */
function createStubD1(initial?: Array<{ key: GroupKey; count: number }>) {
  const rows: Array<{ key: GroupKey; name: string; count: number }> =
    initial
      ? initial.map((i) => ({ ...GROUPS.find((g) => g.key === i.key)!, count: i.count }))
      : GROUPS.map((g) => ({ ...g, count: 0 }));

  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const batches: Array<Array<{ sql: string; params: unknown[] }>> = [];

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
        return {};
      },
    };
    return statement;
  };

  const db = {
    prepare(sql: string) {
      return makeStatement(sql);
    },
    async batch(statements: Stub[]) {
      batches.push(
        statements.map((s) => ({ sql: s.sql, params: [...s.params] })),
      );
      for (const s of statements) {
        executed.push({ sql: s.sql, params: [...s.params] });
        if (s.sql.includes("UPDATE groups SET count = ? WHERE key = ?")) {
          const [count, key] = s.params;
          const row = rows.find((r) => r.key === key);
          if (row) row.count = count as number;
        }
      }
      return statements.map(() => ({}));
    },
  };

  return { db: db as unknown as D1Database, rows, executed, batches };
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
  it("減到負數 → 回 null 且不執行 batch", async () => {
    const { db, batches } = createStubD1([{ key: "taipei", count: 1 }]);
    const result = await adjustGroup(db, "taipei", -2);
    expect(result).toBeNull();
    expect(batches).toHaveLength(0);
  });

  it("成功 → batch 含 UPDATE 與 INSERT 參數正確，並回傳新值", async () => {
    const { db, batches, rows } = createStubD1([{ key: "hsinchu", count: 5 }]);
    void rows;
    const result = await adjustGroup(db, "hsinchu", 2);
    expect(result).toEqual({ key: "hsinchu", name: "新竹", count: 7 });

    expect(batches).toHaveLength(1);
    const [statements] = batches;
    expect(statements).toEqual([
      { sql: "UPDATE groups SET count = ? WHERE key = ?", params: [7, "hsinchu"] },
      { sql: "INSERT INTO updates (group_key, amount) VALUES (?, ?)", params: ["hsinchu", 2] },
    ]);

    // stub 已套用 UPDATE 效果 → 後續查詢反映新值
    const after = await listGroups(db);
    expect(after.find((g) => g.key === "hsinchu")!.count).toBe(7);
    void rows;
  });

  it("扣減剛好歸零 → 成功（count 不小於 0）", async () => {
    const { db, batches } = createStubD1([{ key: "zhongli", count: 3 }]);
    const result = await adjustGroup(db, "zhongli", -3);
    expect(result).toEqual({ key: "zhongli", name: "中壢", count: 0 });
    expect(batches).toHaveLength(1);
  });

  it("未知 key → null", async () => {
    const { db, batches, executed } = createStubD1();
    expect(await adjustGroup(db, "kaohsiung", 1)).toBeNull();
    expect(batches).toHaveLength(0);
    expect(executed).toHaveLength(0); // 提前短路，連 SELECT 都不執行
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

// 型別層面確認：GroupRow 可作為止標註（避免 unused import 誤刪）
export type _Keep = GroupRow;
