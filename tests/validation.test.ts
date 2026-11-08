import { describe, it, expect } from "bun:test";
import { parseAmount } from "../server/utils/validation";

describe("parseAmount", () => {
  it("parseAmount(2) → ok, amount=2", () => {
    expect(parseAmount(2)).toEqual({ ok: true, amount: 2 });
  });

  it("parseAmount('2') → ok, amount=2（字串可轉）", () => {
    expect(parseAmount("2")).toEqual({ ok: true, amount: 2 });
  });

  it("parseAmount('-3') → ok, amount=-3（字串負數可轉）", () => {
    expect(parseAmount("-3")).toEqual({ ok: true, amount: -3 });
  });

  it("parseAmount(0) → error '請輸入非零人數'", () => {
    expect(parseAmount(0)).toEqual({ ok: false, error: "請輸入非零人數" });
  });

  it("parseAmount('0') → error '請輸入非零人數'", () => {
    expect(parseAmount("0")).toEqual({ ok: false, error: "請輸入非零人數" });
  });

  it("parseAmount(1.5) → error '請輸入整數'", () => {
    expect(parseAmount(1.5)).toEqual({ ok: false, error: "請輸入整數" });
  });

  it("parseAmount(100) / (-100) → ok（邊界可接受）", () => {
    expect(parseAmount(100)).toEqual({ ok: true, amount: 100 });
    expect(parseAmount(-100)).toEqual({ ok: true, amount: -100 });
  });

  it("parseAmount(101) / ('101') → error '單次調整上限100人'", () => {
    expect(parseAmount(101)).toEqual({ ok: false, error: "單次調整上限100人" });
    expect(parseAmount("101")).toEqual({ ok: false, error: "單次調整上限100人" });
  });

  it("parseAmount(-101) → error '單次調整上限100人'", () => {
    expect(parseAmount(-101)).toEqual({ ok: false, error: "單次調整上限100人" });
  });

  it("parseAmount(null) → error '請輸入人數'", () => {
    expect(parseAmount(null)).toEqual({ ok: false, error: "請輸入人數" });
  });

  it("parseAmount(undefined) → error '請輸入人數'", () => {
    expect(parseAmount(undefined)).toEqual({ ok: false, error: "請輸入人數" });
  });

  it("parseAmount('abc') → error '請輸入人數'", () => {
    expect(parseAmount("abc")).toEqual({ ok: false, error: "請輸入人數" });
  });

  it("parseAmount([]) → error '請輸入人數'", () => {
    expect(parseAmount([])).toEqual({ ok: false, error: "請輸入人數" });
  });

  it("parseAmount({}) → error '請輸入人數'", () => {
    expect(parseAmount({})).toEqual({ ok: false, error: "請輸入人數" });
  });
});
