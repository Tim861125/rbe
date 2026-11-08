# 小組報名人數統計網站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 四小組（台北/中壢/新竹/台中）報名人數統計網站，部署 Cloudflare Workers + D1，加人時以 LINE Messaging API 推播各組人數到群組，手繪風格、手機優先。

**Architecture:** 單一 Cloudflare Worker：Nuxt 4（Nitro `cloudflare_module` preset）SSR 前端 + `/api/*` server routes；D1 存各組人數與異動紀錄；`/api` 由 Nitro middleware 驗 Cloudflare Access JWT；LINE 在 POST 成功後由 server route 直接 push（無 token 時 mock 只印 log）。

**Tech Stack:** bun、Nuxt 4 + Nitro、shadcn-vue（shadcn-nuxt、TailwindCSS v4）、roughjs、D1、wrangler、jose、bun:test

**Spec:** `docs/superpowers/specs/2026-11-08-group-registration-site-design.md`

## Global Constraints

- 套件管理與執行一律用 `bun`（`bun install` / `bun run *` / `bunx` / `bun test`）。
- 小組固定順序與名稱（不得更動順序）：`taipei→台北`、`zhongli→中壢`、`hsinchu→新竹`、`taichung→台中`。
- LINE 訊息格式固定：
  首行 `{組名}新增{N}人參加，目前各組人數如下`，其餘各行 `{組名} {人數} 人`。
  推播僅在 `amount > 0` 時發送；減人（amount ≤ 0）不發。
- `amount` 條件：整數、非零、`|amount| ≤ 100`、調整後人數不得 < 0（任一違反 → HTTP 400，訊息見各案例）。
- Nuxt config：`compatibilityDate: "2025-07-17"`（或更晚）、`nitro: { preset: "cloudflare_module", cloudflare: { deployConfig: true, nodeCompat: true } }`。wrangler.jsonc **不得**設 `main` / `assets`（Nitro 於 build 產生）。
- Secrets 名稱固定：`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_GROUP_ID`、`CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD`。本機用 gitignored `.dev.vars`；token/group 未設 → mock 模式（只 console.log 訊息、回 `lineSent:false`、不算錯誤）。
- 純函式測試用 `bun test`（`bun:test`），測試檔放 `tests/`；`server/utils` 下供測試的純模組不得 import Nitro/Nuxt 別名（`~`、`#imports`、`#app`）。
- UI：RWD 斷點 手機預設/`sm`/`lg` = 1/2/4 欄；按鈕觸控熱區 ≥ 44×44px；dark mode 由 `@nuxtjs/color-mode`（`classSuffix: ''`）掛 `html.dark`，rough.js 圖表 watch 主題重繪。

## Review Focus

1. `amount = 0` 送出 → 不寫 D1、不推播、回 400 `"請輸入非零人數"`。（Task 4 測試 pin）
2. 減到負數（如 0 人再送 −1）→ 回 400 且**不**寫入任何紀錄。（Task 3/4 測試 pin）
3. LINE push 網路失敗/非 2xx → 註冊資料仍成功寫入，HTTP 回 200 且 `lineSent:false`，錯誤寫 log。（Task 5 測試 pin）
4. `LINE_CHANNEL_ACCESS_TOKEN` 未設 → mock：確切訊息內容印進 Worker log、不 fetch、回 `lineSent:false`。（Task 5 測試 pin）
5. 無/偽造 `Cf-Access-Jwt-Assertion` → 401；`CF_ACCESS_AUD` 未設為 dev 模式放行。（Task 8 測試 pin）

---

### Task 1: 專案骨架（Nuxt 4 + Cloudflare config + bun）

**Files:**
- Create: `package.json`、`nuxt.config.ts`、`tsconfig.json`、`wrangler.jsonc`、`.gitignore`、`app/app.vue`（佔位）、`app/assets/css/tailwind.css`

**Interfaces:**
- Produces: 可 `bun run build` 的空白 Nuxt 應用；wrangler.jsonc 含 D1 binding `DB`；scripts：`dev`、`build`、`preview`（= `build && wrangler dev`）、`deploy`（= `build && wrangler deploy`）、`test`、`cf-typegen`（= `wrangler types`）。

- [ ] **Step 1: 寫 package.json（deps: nuxt ^4、roughjs、jose；devDeps: wrangler、typescript；scripts 用 bun；postinstall: `nuxt prepare`）與 nuxt.config.ts**

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: "2025-07-17",
  nitro: {
    preset: "cloudflare_module",
    cloudflare: { deployConfig: true, nodeCompat: true },
  },
});
```

- [ ] **Step 2: 建 wrangler.jsonc（無 main/assets）與 .gitignore（含 `.wrangler`、`.dev.vars*`、`node_modules`、`.nuxt`、`.output`、`.env`、`dist`）**

```jsonc
// wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "rbe-groups",
  "compatibility_date": "2025-07-17",
  "observability": { "enabled": true },
  "d1_databases": [
    { "binding": "DB", "database_name": "rbe-db", "database_id": "PLACEHOLDER_TODO_REPLACE" }
  ]
}
```

- [ ] **Step 3: 空值驗證**

Run: `bun install && bun run build`
Expected: BUILD PASS；`.output/server/wrangler.json` 由 Nitro 產生；build log 無 "main/assets overridden" 警告。D1 binding 於本機 dev 不需真實 database_id（cloudflare-dev 模式以 wrangler.jsonc binding 名即可）。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: scaffold nuxt + cloudflare workers config"
```

### Task 2: Tailwind v4 + shadcn-vue + 深色模式切換

**Files:**
- Modify: `nuxt.config.ts`（modules）、`app/assets/css/tailwind.css`（shadcn 主題變數，含 `.dark` 變數組）
- Create: `app/components/DarkModeToggle.vue`、`app/pages/index.vue`（本 task 僅放標題 + toggle 的佔位頁，正式版在 Task 6）

**Interfaces:**
- Produces: `DarkModeToggle.vue`（無 props，`bun x shadcn-vue@latest add button` 產生的元件；lucide 圖示 Sun/Moon，`useColorMode().preference = 'light'|'dark'`）；shadcn 安裝流程（repo 內 `components.json`）；`cn()` 位於 `app/lib/utils.ts`。

- [ ] **Step 1: 安裝與設定**

```bash
bun add -d tailwindcss @nuxtjs/tailwindcss@7.0.0-beta.1 @nuxtjs/color-mode shadcn-nuxt
bunx shadcn-vue@latest init    # style: default, css variables: yes, base color: neutral
bunx shadcn-vue@latest add button card select
```

```ts
// nuxt.config.ts
modules: ["@nuxtjs/tailwindcss", "@nuxtjs/color-mode", "shadcn-nuxt"],
colorMode: { classSuffix: "" },
```

- [ ] **Step 2: 實作 `DarkModeToggle.vue`（單顆 Button，月亮/太陽 icon 隨 mode 切）**

- [ ] **Step 3: 驗證**

Run: `bun run build && bun run preview`
Expected: 瀏覽器點 toggle 後 `html` class 變 `dark`；重整後偏好保留（color-mode 模組 localStorage）。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: tailwind v4 + shadcn-vue + dark mode toggle"
```

### Task 3: D1 schema + 資料存取層 + `GET /api/groups`

**Files:**
- Create: `schema.sql`、`server/utils/groups.ts`、`server/utils/db.ts`、`server/api/groups.get.ts`
- Test: `tests/db.test.ts`（stub D1：實作 `prepare().bind()` 鏈與 `all()`/`first()`/`run()`/`batch()`，記錄 SQL 與參數）

**Interfaces:**
- Produces:
  - `server/utils/groups.ts`:
    `export type GroupKey = "taipei" | "zhongli" | "hsinchu" | "taichung";`
    `export const GROUPS: Array<{ key: GroupKey; name: string }> = [...依序 台北/中壢/新竹/台中];`
    `export function findGroup(key: string): { key: GroupKey; name: string } | undefined`
  - `server/utils/db.ts`（唯讀 D1，參數化 SQL）:
    `export async function listGroups(db: D1Database): Promise<Array<{ key: GroupKey; name: string; count: number }>>` — 依 GROUPS 順序回傳（DB 亂序也重排）
    `export function isValidGroupKey(key: string): boolean`
    `export async function adjustGroup(db: D1Database, key: string, amount: number): Promise<{ key: GroupKey; name: string; count: number } | null>` — `null` = key 不存在**或** `count + amount < 0`；成功時 `db.batch([UPDATE groups ... , INSERT updates ...])` 後回傳新值
  - `GET /api/groups` → `{ groups: Array<{ key; name; count }>, total: number }`

- [ ] **Step 1: schema.sql（建表 + seed upsert）**

```sql
CREATE TABLE IF NOT EXISTS groups (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO groups (key, name, count) VALUES
  ('taipei','台北',0),('zhongli','中壢',0),('hsinchu','新竹',0),('taichung','台中',0)
ON CONFLICT(key) DO NOTHING;
```

- [ ] **Step 2: 寫 failing tests（tests/db.test.ts）**

```ts
import { describe, it, expect } from "bun:test";
// stub d1：假的 prepare().all() 回固定列、batch() 記錄語句與參數
it("listGroups 依 GROUPS 順序回傳", ...);
it("adjustGroup 減到負數 → 回 null 且不執行 batch", ...);
it("adjustGroup 成功 → batch 含 UPDATE groups SET count=? 與 INSERT updates 參數正確", ...);
it("adjustGroup 未知 key → null", ...);
it("isValidGroupKey 大小寫不符/未知 → false", ...);
```

Run: `bun test`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 groups.ts / db.ts / groups.get.ts 使測試綠**

Run: `bun test` → PASS
Run: `bunx wrangler d1 execute rbe-db --local --file=schema.sql`，`bun run build && bun run preview` 後 `curl http://localhost:8787/api/groups`
Expected: 回四組 JSON、`total` 為加總。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: d1 data layer + GET /api/groups"
```

### Task 4: `POST /api/groups/:key/registrations`（驗證 + 寫入 + 紀錄）

**Files:**
- Create: `server/api/groups/[key]/registrations.post.ts`、`server/utils/validation.ts`
- Test: `tests/validation.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `adjustGroup()` / `isValidGroupKey()`
- Produces:
  - `server/utils/validation.ts`:
    `export type ParseAmountResult = { ok: true; amount: number } | { ok: false; error: string };`
    `export function parseAmount(input: unknown): ParseAmountResult` — 整數、非零、`|amount| ≤ 100`；字串數字可轉型
  - POST 路由：body `{ amount }` → 成功 200 `{ ok: true, count: number, announced: boolean, lineSent: boolean }`（`announced = amount > 0`；本 task 前 `lineSent` 恆 false，Task 5 串接）；任何驗證失敗 → 400 `{ ok: false, error: string }`

- [ ] **Step 1: 寫 failing tests（tests/validation.test.ts）**

```ts
it("parseAmount(2) → ok, amount=2");
it("parseAmount('2') → ok, amount=2（字串可轉）");
it("parseAmount(0) → error '請輸入非零人數'");
it("parseAmount(1.5) → error '請輸入整數'");
it("parseAmount(101) / (-101) → error '單次調整上限100人'");
it("parseAmount(null/undefined/'abc'/[]) → error '請輸入人數'");
```

Run: `bun test` → FAIL

- [ ] **Step 2: 實作 validation.ts → `bun test` PASS**

- [ ] **Step 3: 實作 POST route**（流程：`isValidGroupKey`? → 400 `"未知小組"` → `parseAmount`? → 400 帶訊息 → `adjustGroup` null → 400 `"人數不足，不得減少超過目前人數"` → 成功回傳）

Run preview 驗證:

```bash
curl -X POST http://localhost:8787/api/groups/zhongli/registrations -d '{"amount":2}'   # → 200 {"ok":true,"count":2,...}
curl -X POST http://localhost:8787/api/groups/zhongli/registrations -d '{"amount":0}'   # → 400 "請輸入非零人數"
curl -X POST http://localhost:8787/api/groups/nope/registrations   -d '{"amount":1}'   # → 400 "未知小組"
```

- [ ] **Step 4: 驗證不變量（Review Focus 1、2）**：`bun test` 綠 + curl 三種 400 案例（含 0 人減到負 以 `-5`於 count=2 之組）

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: POST registrations with validation + update log"
```

### Task 5: LINE 訊息組合 + 發送（含 mock）串接 POST

**Files:**
- Create: `server/utils/message.ts`、`server/utils/line.ts`
- Modify: `server/api/groups/[key]/registrations.post.ts`（成功後送訊／mock）
- Test: `tests/message.test.ts`、`tests/line.test.ts`（`globalThis.fetch` 以 stub 替換：記錄呼叫參數、可控回應/丟錯）

**Interfaces:**
- Consumes: Task 3 `GROUPS`；Task 4 POST 成功流程
- Produces:
  - `server/utils/message.ts`:
    `export function buildAnnouncement(groupName: string, delta: number, groups: Array<{ name: string; count: number }>): string` — groups 可亂序輸入，輸出依 GROUPS 順序
  - `server/utils/line.ts`:
    `export async function sendLineAnnouncement(message: string, env: { LINE_CHANNEL_ACCESS_TOKEN?: string | undefined; LINE_GROUP_ID?: string | undefined }, logger?: { log: (...args: unknown[]) => void }): Promise<boolean>`
    - token 或 group 缺任一 → 用 logger（預設 console）印整段訊息、不 fetch、回 false
    - 有其一 → `POST https://api.line.me/v2/bot/message/push`，headers `Authorization: Bearer <token>`，body `{ to: groupId, messages: [{ type: "text", text: message }] }`；非 2xx / 丟錯 → log 錯、回 false；2xx → true

- [ ] **Step 1: 寫 failing tests（tests/message.test.ts）**

```ts
it("buildAnnouncement('中壢',2,[{台北10},{中壢15},{新竹7},{台中8}]) === 規格範例全文", ...);
// 順序照 Global Constraints：首行 '中壢新增2人參加，目前各組人數如下' + 4 行
it("輸入 groups 亂序 → 輸出仍依 台北→中壢→新竹→台中", ...);
it("delta=1 → 首行 '...新增1人參加...'", ...);
```
run: `bun test` → FAIL

- [ ] **Step 2: 寫 failing tests（tests/line.test.ts）**

```ts
it("無 token → 不呼叫 fetch、整段訊息印進 logger、回 false", ...);
it("有 token+groupId → fetch 呼叫正確 URL/method/headers/body，2xx 回 true", ...);
it("fetch 丟錯 / 回 400 → 回 false 並紀錄錯誤 log", ...);
```
run: `bun test` → FAIL

- [ ] **Step 3: 實作兩檔，並在 POST route 成功分支串接：**

```ts
const lineSent = post.announced
  ? await sendLineAnnouncement(
      buildAnnouncement(group.name, amount, updatedGroups),
      event.context.cloudflare.env,  // 型式：{ LINE_CHANNEL_ACCESS_TOKEN, LINE_GROUP_ID }
    )
  : false;
```

Run: `bun test` → 全 PASS；preview curl `{ "amount": 2 }`（未設 token）→ 200、`lineSent:false`、wrangler console 印出規格訊息。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: line announcement builder + sender with mock fallback"
```

### Task 6: 首頁 UI（行動優先卡片 + ±按鈕 + 快速加減 + 送出）

**Files:**
- Create: `app/pages/index.vue`（正式版）、`app/components/GroupCard.vue`、`app/components/TotalCard.vue`、`app/composables/useGroups.ts`
- Modify: `app/app.vue`（加 `<NuxtPage />`）、`app/assets/css/tailwind.css`（紙張質感背景、手繪風字體 stack：Latin `ui-serif` + 系統 CJK，不載 webfont）

**Interfaces:**
- Consumes: Task 3 `GET /api/groups`、Task 4/5 `POST .../registrations`；shadcn `Button/Card/Select/Toast`
- Produces:
  - `app/composables/useGroups.ts`:
    `export function useGroups()` → `{ groups: Ref<Array<{key;name;count}>>, total: ComputedRef<number>, refresh(): Promise<void>, submit(key: GroupKey, amount: number): Promise<{ ok: boolean; count?: number; lineSent?: boolean }> }`
  - `app/components/GroupCard.vue`: props `{ group: { key: GroupKey; name: string; count: number } }`
    UI：組名 + 目前人數；`−`/`+` 按鈕（±1，本地 pending）；快速加減 `Select`（`+5/+10/−5/−10`，選後立即送出該組）；主要「送出」按鈕（pending ≠ 0 才亮起）；pending ≠ 0 且為負 → 卡上顯示預覽 `count + pending`；送出結果 toast（加人 → 「已更新並公告」；減人/未公告 → 「已更新（不對外公佈）」；API 400 → 錯誤訊息直接 display）
    觸控規則：所有 interactive 元素 min-h-[44px] / min-w-[44px]，`active:` 按壓回饋，无 hover 依賴
  - `app/pages/index.vue` 版面：Header（標題 + DarkModeToggle）→ `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` 四張 GroupCard → 總人數卡（TotalCard）→（Task 7 在此加 RoughBarChart）

- [ ] **Step 1: 實作 useGroups（`$fetch` 兩個 API route；submit 的錯誤由呼叫方顯示）**
- [ ] **Step 2: 實作 GroupCard / TotalCard / index.vue（手機單欄、≥44px、active: 樣式）**

- [ ] **Step 3: 瀏覽器驗證（Run: `bun run preview`）**

Expected: 375px 寬手機模擬下按鈕皆可按、不橫向滾動；`+2` 未送出時卡片顯示暫存預覽；送出失敗（如減過頭）畫面帶錯誤訊息；深色模式可切換且皆可讀。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: mobile-first group cards + update flow"
```

### Task 7: rough.js 手繪長條圖

**Files:**
- Create: `app/components/RoughBarChart.vue`
- Modify: `app/pages/index.vue`（總卡隔壁或下方加入）

**Interfaces:**
- Consumes: `useColorMode()`（Task 2）
- Produces: `RoughBarChart.vue`：props `{ data: Array<{ name: string; count: number }> }`；`<ClientOnly>` 包裹；`roughjs` 畫 4 條 bar（rectangle `fillStyle:'hachure'`）+ 手繪框線 + 各組名與人數文字；`watch(colorMode.value, redraw)` 換色重繪；`resize` listener 重繪；動畫：用 rAF 讓 bar 高度由 0 遞增至目標值逐步重繪（無外部動畫依賴）

- [ ] **Step 1: `bun add roughjs` 並實作 RoughBarChart.vue**
- [ ] **Step 2: 瀏覽器驗證**：`bun run preview` 手機檢視（375px）不溢出、深淺切換當場重繪、顏色兩套皆可讀。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: rough.js hand-drawn bar chart"
```

### Task 8: Cloudflare Access JWT 驗證 middleware

**Files:**
- Create: `server/utils/auth.ts`、`server/middleware/0.auth.ts`、`.dev.vars.example`（各 secrets 空預留）
- Modify: `package.json`（dep: `jose`）

**Interfaces:**
- Consumes: `jose`（`createRemoteJWKSet` + `jwtVerify`）；env `CF_ACCESS_TEAM_DOMAIN`（`https://<team>.cloudflareaccess.com`）、`CF_ACCESS_AUD`
- Produces:
  - `server/utils/auth.ts`: `export async function requireAccess(event: H3Event): Promise<boolean>`
    - `CF_ACCESS_AUD` 未設 → 回 true（dev/mock 模式）
    - 有設 → 須存在 request header `cf-access-jwt-assertion`，`jwtVerify(raw, jwks, { issuer: TEAM_DOMAIN, audience: AUD })` 成功 → true，否則 false
  - `server/middleware/0.auth.ts`: 僅攔 `startsWith('/api/')` 的請求；false → `throw createError({ statusCode: 401, data: { ok: false, error: 'unauthorized' } })`。SSR 頁面不在程式內驗證（由 Cloudflare Access edge 保護）。

- [ ] **Step 1: 寫 failing tests（tests/auth.test.ts，以可注入的 verify/dep 邊界或 stub jose）**

```ts
it("未設 CF_ACCESS_AUD → true 且不讀 header", ...);
it("有 AUD 設定但缺 jwt header → false", ...);
it("header 帶假 token → false", ...);
```
run: `bun test` → FAIL

- [ ] **Step 2: 實作 auth.ts + middleware → `bun test` PASS**
  preview 驗證：`.dev.vars` 設 `CF_ACCESS_AUD=mock_aud` → `curl /api/groups`（無 JWT）→ 401；移除後重啟 preview → 200。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: cloudflare access jwt guard for /api"
```

### Task 9: 部署文件 + 最終驗收

**Files:**
- Create: `README.md`（bun scripts、D1 建立含遠端遷移、secrets 指令、deploy 流程）、`docs/LINE-SETUP.md`（LINE 官方帳號 → 開通 Messaging API → 取 channel access token → 取得群組 ID 教學、push 免費 200 則/月提醒）、`docs/CLOUDFLARE-ACCESS-SETUP.md`（Zero Trust Access app + Google login + email allowlist + 取得 AUD）

**Interfaces:**
- Consumes: 前 8 個 task 成果
- Produces: 完整可部署狀態

- [ ] **Step 1: 寫三份文件**（指令皆 bun 版：`bunx wrangler d1 create rbe-db`、`bunx wrangler d1 execute rbe-db --remote --file=schema.sql`、四個 secrets `bunx wrangler secret put <NAME>`、`bun run build && bunx wrangler deploy`）

- [ ] **Step 2: 最終驗證**

```bash
bun run build            # PASS
bun test                 # PASS
bunx wrangler deploy --dry-run   # 組態可被解析、dry-run 無錯誤
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: deployment, line setup, cloudflare access guides"
```

---

## 部署後手動步驟（使用者操作）

1. `bunx wrangler d1 create rbe-db` → 把取得的 `database_id` 貼回 `wrangler.jsonc`
2. `bunx wrangler d1 execute rbe-db --remote --file=schema.sql`
3. 依 `docs/CLOUDFLARE-ACCESS-SETUP.md` 建 Access app（Google login + email allowlist）→ 記下 `AUD` 與 team domain
4. `bunx wrangler secret put CF_ACCESS_AUD`、`CF_ACCESS_TEAM_DOMAIN`（另 LINE 相關見第 6 步）
5. `bun run build && bunx wrangler deploy`
6. 依 `docs/LINE-SETUP.md` 申請 Messaging API → `bunx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN`、`LINE_GROUP_ID` → 再 deploy 一次（未設前系統自動 mock）
