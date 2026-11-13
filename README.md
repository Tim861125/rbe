# RBE 小組報名人數統計

> 統計台北、中壢、新竹、台中四組報名人數的網站 — Nuxt 4 SSR + Nitro `cloudflare_module` 部署於 Cloudflare Workers，資料存 D1，加人時推播 LINE 群組公告，全站由 Cloudflare Access 保護（僅限公司 email）。

## 功能

- **人數總覽** — 四組人數卡片 + 總人數 + rough.js 手繪長條圖（帶手繪動畫）
- **一鍵更新** — 每組卡片 `−`/`+` 按一次 ±1 人，下拉選單快速加減 5 / 10 人，按「送出」才寫入
- **LINE 公告** — 送出後淨增幅 > 0 才推播各組最新人數到 LINE 群組；減人不公告
- **深色 / 淺色切換** — 記住偏好（localStorage），手繪圖表依主題重繪
- **手機優先 RWD** — 單欄卡片直式排列，觸控友善；桌面雙欄版面
- **Access 保護** — 全站包在 Cloudflare Access 後面（Google 登入 + email allowlist），API 另驗 `Cf-Access-Jwt-Assertion` JWT 防繞過直打

## 架構

| 位置 | 角色 |
|---|---|
| `app/` | Nuxt 4 前端（shadcn-vue + Tailwind 4 + rough.js + vue-sonner） |
| `server/api/` | Nitro route handlers，透過 D1 binding 讀寫 `groups` / `updates` |
| `server/middleware/0.auth.ts` | 僅攔 `/api/*` 的 Cloudflare Access JWT guard |
| `server/utils/line.ts` | LINE Messaging API push；缺 secrets 時自動 mock（訊息只印 log） |

## 前置需求

- [bun](https://bun.sh)
- Cloudflare 帳號，並先登入：`bunx wrangler login`

## Bun scripts

| 指令 | 說明 |
|---|---|
| `bun run dev` | 本地開發（`nuxt dev`），不需要 Access / LINE 設定 |
| `bun run build` | 建置（產物在 `.output/`） |
| `bun run preview` | 建置後以 `wrangler dev` 本地模擬執行 |
| `bun run deploy` | `bun run build && wrangler deploy` |
| `bun test` | 跑單元測試 |
| `bun run cf-typegen` | 產生 Workers 環境型別（`wrangler types`） |

## 本地開發

```bash
bun install
bun run dev
```

> [!TIP]
> 不申請任何服務也能完整開發：`CF_ACCESS_AUD` 未設時 API 驗證直接放行（dev 模式），LINE 兩個 secrets 未設時自動 mock（訊息只印 log、不推播）。

本地要模擬 secrets 時：

```bash
cp .dev.vars.example .dev.vars   # .dev.vars 已 gitignore
```

本地模擬 DB 用同一份 schema：

```bash
bunx wrangler d1 execute rbe-db --file=schema.sql   # 不帶 --remote 即打本地模擬 DB
```

## 部署

### 1. 建立 D1，填回 database_id

```bash
bunx wrangler d1 create rbe-db
```

> [!IMPORTANT]
> 把輸出裡的 `database_id` 貼到 `wrangler.jsonc` 的 `d1_databases[0].database_id`（目前是 `PLACEHOLDER_TODO_REPLACE`），首次部署前必須替換。

### 2. 遠端建表（含四組預覽資料）

```bash
bunx wrangler d1 execute rbe-db --remote --file=schema.sql
```

### 3. 設定 Secrets

```bash
bunx wrangler secret put CF_ACCESS_TEAM_DOMAIN      # 例：https://<team>.cloudflareaccess.com
bunx wrangler secret put CF_ACCESS_AUD              # 見 docs/CLOUDFLARE-ACCESS-SETUP.md
bunx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN  # 見 docs/LINE-SETUP.md
bunx wrangler secret put LINE_GROUP_ID              # 見 docs/LINE-SETUP.md
```

> [!NOTE]
> LINE 兩個 secret 可以之後再補：未設之前系統自動走 mock 模式（公告訊息印在 `bunx wrangler tail`），網站功能不受影響。

### 4. 建立 Cloudflare Access 應用

照 [docs/CLOUDFLARE-ACCESS-SETUP.md](docs/CLOUDFLARE-ACCESS-SETUP.md) 建 Access application（Google login + email allowlist），記下 team domain 與應用的 `AUD` tag，回到第 3 步設進 secrets。

### 5. 建置並部署

```bash
bun run deploy
```

部署後先做驗證（gate）：在尚未設 `CF_ACCESS_AUD` 的 dev 模式下直接打 API，

```bash
curl https://<your-worker-url>/api/groups
```

> [!IMPORTANT]
> **看到 200 JSON 且含四組資料才算部署成功**；不是 200 就檢查 D1 `database_id`、secrets 與 `bunx wrangler tail` 再重部署。

之後可用 `bunx wrangler deployments list` 查部署紀錄、`bunx wrangler tail` 看即時 log（mock 模式下 LINE 訊息就印在這裡）。

### 6. 補 LINE（可之後再做）

照 [docs/LINE-SETUP.md](docs/LINE-SETUP.md) 申請 Messaging API，取得 token 與群組 ID 後重跑第 3 步的兩條 `secret put`。`wrangler secret put` 會立即套用到線上 Worker，不用重新部署。

> [!NOTE]
> LINE push 免費額度為 200 則/月。本網站只在「加人」時發送，正常使用下不會超。

## API

| Method | Path | 說明 |
|---|---|---|
| `GET` | `/api/groups` | 回傳 `{ groups, total }` |
| `POST` | `/api/groups/:key/registrations` | body `{ amount }`（正負整數）；成功 200 `{ ok, count, announced, lineSent }`，驗證失敗 400 `{ ok: false, error }` |

## 相關文件

- [docs/LINE-SETUP.md](docs/LINE-SETUP.md) — LINE 官方帳號 → Messaging API → channel access token → 群組 ID
- [docs/CLOUDFLARE-ACCESS-SETUP.md](docs/CLOUDFLARE-ACCESS-SETUP.md) — Zero Trust Access app + Google login + email allowlist + AUD
- [設計規格](docs/superpowers/specs/2026-11-08-group-registration-site-design.md)
- [實作計畫](docs/superpowers/plans/2026-11-08-group-registration-site.md)
