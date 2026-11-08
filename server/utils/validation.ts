export type ParseAmountResult = { ok: true; amount: number } | { ok: false; error: string };

/**
 * 解析單次人數異動：整數、非零、|amount| ≤ 100。
 * 字串數字可轉型（form/JSON 輸入常見為字串）；非數值字串、null/undefined、物件/陣列等一律回 error。
 */
export function parseAmount(input: unknown): ParseAmountResult {
  let value: number;
  if (typeof input === "number") {
    value = input;
  } else if (typeof input === "string") {
    value = Number(input);
    if (Number.isNaN(value)) {
      return { ok: false, error: "請輸入人數" };
    }
  } else {
    return { ok: false, error: "請輸入人數" };
  }

  if (!Number.isInteger(value)) {
    return { ok: false, error: "請輸入整數" };
  }
  if (value === 0) {
    return { ok: false, error: "請輸入非零人數" };
  }
  if (Math.abs(value) > 100) {
    return { ok: false, error: "單次調整上限100人" };
  }

  return { ok: true, amount: value };
}
