import { describe, it, expect } from "bun:test";
import { sendLineAnnouncement } from "../server/utils/line";

type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

function stubFetch(
  respond: (call: FetchCall) => Response | Promise<Response> | never,
  options?: { reject?: Error },
): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (options?.reject) throw options.reject;
    const headers: Record<string, string> = {};
    for (const [k, v] of new Headers(init?.headers ?? {}).entries()) {
      headers[k] = v;
    }
    const call: FetchCall = {
      url: String(input),
      method: init?.method ?? "GET",
      headers,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const ENV = {
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  LINE_GROUP_ID: "test-group-id",
};

describe("sendLineAnnouncement", () => {
  it("無 token → 不呼叫 fetch、整段訊息印進 logger、回 false", async () => {
    const logs: unknown[] = [];
    const logger = { log: (...args: unknown[]) => logs.push(args) };
    const message = "測試公告\n台北 1 人";
    const stub = stubFetch(() => {
      throw new Error("fetch must not be called");
    });

    try {
      for (const env of [
        undefined,
        {},
        { LINE_GROUP_ID: ENV.LINE_GROUP_ID },
        { LINE_CHANNEL_ACCESS_TOKEN: ENV.LINE_CHANNEL_ACCESS_TOKEN },
      ]) {
        logs.length = 0;
        stub.calls.length = 0;
        const result = await sendLineAnnouncement(message, env, logger);
        expect(result).toBe(false);
        expect(stub.calls.length).toBe(0);
        // 整段訊息出現在 log 參數中（含換行原樣，未被截斷）
        expect(logs.flat()).toContain(message);
      }
    } finally {
      stub.restore();
    }
  });

  it("無 groupId → 同樣不呼叫 fetch、回 false、印訊息", async () => {
    const logs: unknown[] = [];
    const logger = { log: (...args: unknown[]) => logs.push(args) };
    const stub = stubFetch(() => new Response(null, { status: 200 }));
    try {
      const result = await sendLineAnnouncement("訊息", { LINE_CHANNEL_ACCESS_TOKEN: "t" }, logger);
      expect(result).toBe(false);
      expect(stub.calls.length).toBe(0);
      expect(logs.flat()).toContain("訊息");
    } finally {
      stub.restore();
    }
  });

  it("有 token+groupId → fetch 呼叫正確 URL/method/headers/body，2xx 回 true", async () => {
    const stub = stubFetch(() => new Response(null, { status: 200 }));
    const message = "中壢新增2人參加，目前各組人數如下\n台北 10 人\n中壢 15 人\n新竹 7 人\n台中 8 人";
    try {
      const result = await sendLineAnnouncement(message, ENV);
      expect(result).toBe(true);
      expect(stub.calls.length).toBe(1);
      const call = stub.calls[0];
      expect(call.url).toBe("https://api.line.me/v2/bot/message/push");
      expect(call.method).toBe("POST");
      expect(call.headers["authorization"]).toBe(`Bearer ${ENV.LINE_CHANNEL_ACCESS_TOKEN}`);
      expect(call.body).toEqual({
        to: ENV.LINE_GROUP_ID,
        messages: [{ type: "text", text: message }],
      });
    } finally {
      stub.restore();
    }
  });

  it("fetch 回 400 → 回 false 並紀錄錯誤 log", async () => {
    const logs: unknown[] = [];
    const logger = { log: (...args: unknown[]) => logs.push(args) };
    const stub = stubFetch(() => new Response("bad request", { status: 400 }));
    try {
      const result = await sendLineAnnouncement("訊息", ENV, logger);
      expect(result).toBe(false);
      expect(logs.length).toBeGreaterThan(0);
    } finally {
      stub.restore();
    }
  });

  it("fetch 丟錯 → 回 false 並紀錄錯誤 log（finally 還原 fetch）", async () => {
    const logs: unknown[] = [];
    const logger = { log: (...args: unknown[]) => logs.push(args) };
    const stub = stubFetch(() => {
      throw new Error("never");
    }, { reject: new Error("network down") });
    try {
      const result = await sendLineAnnouncement("訊息", ENV, logger);
      expect(result).toBe(false);
      expect(logs.length).toBeGreaterThan(0);
    } finally {
      stub.restore();
    }
  });

  it("未帶 logger → 預設 console（不丟錯即可）", async () => {
    const stub = stubFetch(() => new Response(null, { status: 200 }));
    try {
      const result = await sendLineAnnouncement("訊息", ENV);
      expect(result).toBe(true);
    } finally {
      stub.restore();
    }
  });
});
