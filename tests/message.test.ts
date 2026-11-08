import { describe, it, expect } from "bun:test";
import { buildAnnouncement } from "../server/utils/message";

const SPEC_EXAMPLE = `中壢新增2人參加，目前各組人數如下
台北 10 人
中壢 15 人
新竹 7 人
台中 8 人`;

describe("buildAnnouncement", () => {
  it("規格範例：buildAnnouncement('中壢',2,[台北10,中壢15,新竹7,台中8]) === 規格範例全文", () => {
    const groups = [
      { name: "台北", count: 10 },
      { name: "中壢", count: 15 },
      { name: "新竹", count: 7 },
      { name: "台中", count: 8 },
    ];
    expect(buildAnnouncement("中壢", 2, groups)).toBe(SPEC_EXAMPLE);
  });

  it("輸入 groups 亂序 → 輸出仍依 台北→中壢→新竹→台中 順序", () => {
    const shuffled = [
      { name: "台中", count: 8 },
      { name: "新竹", count: 7 },
      { name: "台北", count: 10 },
      { name: "中壢", count: 15 },
    ];
    expect(buildAnnouncement("中壢", 2, shuffled)).toBe(SPEC_EXAMPLE);
  });

  it("delta=1 → 首行 '台北新增1人參加，目前各組人數如下'", () => {
    const result = buildAnnouncement("台北", 1, [
      { name: "台北", count: 1 },
      { name: "中壢", count: 2 },
      { name: "新竹", count: 3 },
      { name: "台中", count: 4 },
    ]);
    expect(result.split("\n")[0]).toBe("台北新增1人參加，目前各組人數如下");
  });

  it("各組行格式：'{name} {count} 人'", () => {
    const result = buildAnnouncement("台中", 1, [
      { name: "台北", count: 42 },
      { name: "中壢", count: 0 },
      { name: "新竹", count: 7 },
      { name: "台中", count: 100 },
    ]);
    const lines = result.split("\n");
    expect(lines[1]).toBe("台北 42 人");
    expect(lines[2]).toBe("中壢 0 人");
    expect(lines[3]).toBe("新竹 7 人");
    expect(lines[4]).toBe("台中 100 人");
  });
});
