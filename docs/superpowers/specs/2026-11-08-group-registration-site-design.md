# 小組報名人數統計網站 — 設計規格

日期：2026-11-08
狀態：已由使用者口頭確認（chat 中逐節審核通過）

## 1. 專案摘要

統計四個小組（台北、中壢、新竹、台中）報名人數的網站，部署於 Cloudflare Workers。
加人時自動透過 LINE Messaging API 推播各組最新人數到指定群組；減人不公告，僅更新資料。

授權：以使用者將於 Cloudflare Dashboard 設定的 **Cloudflare Access**（Google 帳號 email allowlist）管控，
應用程式本身不自訂帳號系統。

## 2. 功能需求

### 網站功能

| ID | 需求 | 說明 |
|---|---|---|
| F1 | 人數總覽 | 四組目前人數 + 總人數卡片，rough.js 手繪長條圖（帶手繪動畫） |
| F2 | 更新人數（純按鈕操作） | 每組卡片上有 `−`/`+` 按鈕，每按一次 ±1 人；先本地暫存，按「送出」才寫入並觸發 LINE。下拉選單（Select）提供快速加減 5 / 10 人。輸入數字以 number input 僅作為進階選項，預設摺疊 |
| F3 | LINE 公告規則 | 一輪送出後：淨增幅 > 0 → 推播「`中壢新增3人參加，目前各組人數如下…`」；淨減少或 0 → 不推播，畫面顯示「已更新（不對外公告）」 |
| F4 | 深色/淺色切換 | 右上 toggle，記住偏好（localStorage），rough.js 依主題重繪線條/文字顏色 |
| F5 | 手繪風格 | rough.js 不規則邊框、塗鴉感字體、紙張質感、深/淺兩套配色 |

### 手機優先（RWD）

| ID | 需求 | 說明 |
|---|---|---|
| F6 | 行動優先版面 | 單欄卡片直式排列：每組一張卡片（組名、目前人數、`−/+`、快速加減、送出）；平板 2 欄、桌面 4 欄 |
| F7 | 觸控友善 | 按鈕最小 44×44px 觸控熱區、間距充足、`active` 按壓回饋、不依賴 hover |
| F8 | 手機效能 | 首屏輕量：rough.js 圖表延後渲染、字體子集化/系統 fallback |

### 權限

| ID | 需求 | 說明 |
|---|---|---|
| F9 | Cloudflare Access 保護 | 全站包在 Cloudflare Access 後面，只允許指定的 Google 帳號（使用者自行設定 allowlist）。應用程式不做自訂帳號密碼 |
| F10 | API 驗證（防偽） | Worker 驗證 `Cf-Access-Jwt-Assertion` JWT（以 team domain / AUD 驗簽），防止繞過 Access 直接打 API。DEBUG/本機模式不驗 |

## 3. 系統架構

```
瀏覽器 (Nuxt 前端, shadcn-vue + rough.js, 行動優先)
   │  https（Cloudflare Access 用戶端）
   ▼
Cloudflare Worker（單一 Worker）
   ├─ Nitro server routes
   │    GET  /api/groups                     → 各組人數 + 總計
   │    POST /api/groups/:key/registrations  → { amount }（正=加、負=減）；加人時觸發 LINE 推播
   ├─ D1 (SQLite)
   │    groups(key, name, count)
   │    updates(id, group_key, amount, created_at)   ← 不做歷史頁，但紀錄保留
   └─ LINEsender
        有 token → 呼叫 https://api.line.me/v2/bot/message/push
        沒 token → mock 模式：把訊息寫入 Worker log（未申請前測試用）
```

## 4. LINE 串接

- 交付附申請步驟文件：建立 LINE 官方帳號 → 開通 Messaging API → 取得 channel access token → 取得群組 ID（機器人加入群組後以 API 查詢）
- 機密走 wrangler secrets：`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_GROUP_ID`、`CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD`
- 未設 token 時自動 mock：訊息僅印在 Worker log，方便先測格式
- 額度：push 免費 200 則/月，僅在加人時發送

## 5. 訊息格式

加人（推播）：

```
中壢新增2人參加，目前各組人數如下
台北 10 人
中壢 15 人
新竹 7 人
台中 8 人
```

減人：不發送（僅更新資料）。

## 6. 技術棧

| 項目 | 選擇 |
|---|---|
| 執行/套件 | bun |
| 框架 | Nuxt 3 + Nitro cloudflare-preset，wrangler 部署 |
| UI | shadcn-vue（Card, Input, Select, Button, Switch, Toast, Dark mode toggle） |
| 圖表 | rough.js（包 Vue component，主題切換用兩組顏色參數重繪） |
| DB | Cloudflare D1 |
| 部署 | wrangler deploy + `d1 execute` 建表 |
| 風格參考 | github.com/svrnm/context-propagation-slides（Slidev + roughjs 手繪風） |

## 7. 不做（YAGNI）

- 自訂帳號系統（靠 Cloudflare Access）
- 歷史紀錄頁面（資料仍存 D1，日後可加）
- LINE 群組內對話/指令互動（機器人只單向廣播）
- 多活動/多期報名
- 刪除異動/回滾

## 8. 風險與待辦（使用者側）

- LINE Messaging API channel 尚未申請 → 申請前啟用 mock 模式測試訊息格式
- Cloudflare Access 需由使用者在 Zero Trust Dashboard 設定（Google SAML/OIDC + email allowlist）
