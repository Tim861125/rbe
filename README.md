# RBE 小組報名人數統計網站

Nuxt 4 SSR + Nitro `cloudflare_module` 部署在 Cloudflare Workers，資料存 D1，加人時推播 LINE 群組公告，整個站由 Cloudflare Access 保護（僅限公司 email）。

架構與設計規格見：

- Spec：`docs/superpowers/specs/2026-11-08-group-registration-site-design.md`
- 實作計畫：`docs/superpowers/plans/2026-11-08-group-registration-site.md`

開發流程文件：`.superpowers/sdd/2026-11-08-group-registration-site/`（各 task brief 與實作報告）。

## 前置需求

- [bun](https://bun.sh)
- Cloudflare 帳號，並先登入：`bunx wrangler login`

## Bun Scripts

| 指令 | 說明 |
|---|---|
| `bun run dev` | 本地開發（`nuxt dev`），不需要 Access / LINE 設定 |
| `bun run build` | 建置（`nuxt build`，產物在 `.output/server/index.mjs`） |
| `bun run preview` | 建置後以 `wrangler dev` 本地模擬執行 |
| `bun run deploy` | `bun run build && wrangler deploy` |
| `bun test` | 跑單元測試 |
| `bun run cf-typegen` | 產生 Workers 環境型別（`wrangler types`） |

本地開發若要模擬 secrets：`cp .dev.vars.example .dev.vars` 後填值（`.dev.vars` 已 gitignore）。`CF_ACCESS_AUD` 留空時 API 驗證直接放行（dev 模式），LINE 兩個變數留空時自動 mock（訊息只印 log、不推播），所以**不申請任何服務也能完整開發**。

## 部署流程

### 1. 建立 D1，填回 database_id

```bash
bunx wrangler d1 create rbe-db
```

把輸出裡的 `database_id` 貼到 `wrangler.jsonc` 的 `d1_databases[0].database_id`（目前是 `PLACEHOLDER_TODO_REPLACE`）。

### 2. 遠端建表（含四組預覽資料）

```bash
bunx wrangler d1 execute rbe-db --remote --file=schema.sql
```

本地模擬用同樣的檔：`bunx wrangler d1 execute rbe-db --file=schema.sql`（不帶 `--remote`，打本地模擬 DB）。

### 3. 設定 Secrets

四個都要設（值怎麼取得見 docs 兩份指南）：

```bash
bunx wrangler secret put CF_ACCESS_TEAM_DOMAIN   # 例：https://<team>.cloudflareaccess.com
bunx wrangler secret put CF_ACCESS_AUD           # 見 docs/CLOUDFLARE-ACCESS-SETUP.md
bunx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN  # 見 docs/LINE-SETUP.md
bunx wrangler secret put LINE_GROUP_ID               # 見 docs/LINE-SETUP.md
```

每個指令會提示輸入值，貼上後按 Enter。未設 LINE 兩個 secret 前，系統自動走 mock 模式（訊息印在 Worker log），網站功能不受影響，可先部署再補 LINE。

### 4. 建立 Cloudflare Access 應用

照 `docs/CLOUDFLARE-ACCESS-SETUP.md` 建 Access application（Google login + email allowlist），記下 team domain 與應用的 `AUD` tag，回到第 3 步設進 secrets。

### 5. 建置並部署

```bash
bun run build && bunx wrangler deploy
```

或用 script：`bun run deploy`。部署後到 `bunx wrangler deployments list` 查部署紀錄，`bunx wrangler tail` 看即時 log（mock 模式下 LINE 訊息就印在這裡）。

### 6. 補 LINE（可之後再做）

照 `docs/LINE-SETUP.md` 申請 Messaging API，取得 token 與群組 ID 後：

```bash
bunx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
bunx wrangler secret put LINE_GROUP_ID
```

`wrangler secret put` 會立即套用到线上 Worker，不用重新部署；設完在網站上加人測試即可。

## 文件索引

- `docs/LINE-SETUP.md` — LINE 官方帳號 → Messaging API → channel access token → 群組 ID
- `docs/CLOUDFLARE-ACCESS-SETUP.md` — Zero Trust Access app + Google login + email allowlist + AUD
