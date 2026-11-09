# Cloudflare Access 設定指南

目標：把整個網站包在 Cloudflare Access 後面，只允許指定 email（Google 登入）瀏覽；並取得兩個 secret：`CF_ACCESS_TEAM_DOMAIN` 與 `CF_ACCESS_AUD`。

程式端行為（`server/middleware/0.auth.ts` + `server/utils/auth.ts`）：

- `CF_ACCESS_AUD` **未設 → dev 模式直接放行**，本地開發完全不需要 Access 設定。
- 有設時，只有 `/api/*` 會驗證 `cf-access-jwt-assertion` header（擋繞過 Access 直打 API 的呼叫）；SSR 頁面本身由 Access edge 保護。

前提：Workers 免費方案內含 50 個免費 Access seat，自用足夠。

## 1. 進入 Zero Trust Dashboard

到 <https://one.dash.cloudflare.com/>，用部署這個 Worker 的 Cloudflare 帳號登入，選擇該帳號對應的 team。

記下 **team domain**：形如 `<team>.cloudflareaccess.com`（左下角 account 名稱旁可看，或 Settings → 網站/一般設定）。之後 secret 填完整網址：

```
CF_ACCESS_TEAM_DOMAIN=https://<team>.cloudflareaccess.com
```

## 2. 設定 Google 作為 Identity Provider

1. Dashboard 左側 **Settings → Widgets & Custom Pages**（舊版在 Login → Authentication）
2. 找到 **Google**，按 **Configure**
3. 照畫面提示到 [Google Cloud Console](https://console.cloud.google.com/) 建一個 OAuth 2.0 Client ID（Web application），Authorized redirect URI 填 Dashboard 給你的網址
4. 把 Google 的 Client ID / Client secret 貼回 Dashboard 並儲存
5. 在 **Login → Authentication** 確認 method 順序裡有 Google（可把默认的 One-Time Pin 留著當備援，或移除）

## 3. 建立 Access Application

1. 左側 **Access → Applications → Add → Applications**
2. Name：`rbe-groups`
3. Session Duration：預設 24 小時即可
4. **Application domain**：填你的 Worker 網址，例如 `rbe-groups.<your-account>.workers.dev`（之後換自訂網域就改這裡）
5. **Identity Providers**：選 Google
6. **Manage Policy → Add a policy**：
   - Rules name：`team-emails`
   - Action：`Allow`
   - Operator：`In`
   - Value：`Emails is in` → 逐一輸入允許的 email addresses（例如公司 Google Workspace 域名下的帳號；也可用 `Email ends with @example.com` 放行整個域名）
7. 建立後回到 Application 設定頁，確認 **Login policy** 掛上這個 policy，Save。

## 4. 取得 AUD Token

1. Access → Applications → 點 `rbe-groups`
2. 設定頁上的 **Token ID**（一長串 hex 字元），旁邊可複製——這就是 **AUD**

```
CF_ACCESS_AUD=<Token ID 那串>
```

## 5. 填入 Secrets

```bash
bunx wrangler secret put CF_ACCESS_TEAM_DOMAIN
bunx wrangler secret put CF_ACCESS_AUD
```

TEAM_DOMAIN 填 `https://<team>.cloudflareaccess.com`（程式會自動去掉協定前綴再做 JWT issuer 驗證）。`secret put` 會立即生效；若還沒部署過，補一次：

```bash
bun run build && bunx wrangler deploy
```

## 6. 驗證

1. 開無痕視窗連到 Worker 網址 → 應先跳 `<team>.cloudflareaccess.com` 的 Access 登入頁 → Google 登入 → 通過後才看到網站
2. 用不在 allowlist 的 email 登入 → 顯示 Access Denied
3. **跳過 Access 直打 API**（驗證中間件有在擋）：

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://rbe-groups.<your-account>.workers.dev/api/groups
   ```

   預期 `401`（沒帶 `cf-access-jwt-assertion`）。通過 Access 的正常瀏覽則一切照常。

## 注意事項

- Workers.dev 預設網址可以被 Access 保護；Access 對 `*.workers.dev` 的 session cookie 行為正常，但若之後換自訂網域，記得同時更新 Access Application 的 domain。
- `CF_ACCESS_AUD` 設錯（例如貼到別應用的 Token ID）會造成所有人都過不了 API——症狀是頁面看得到但存不進去，`bunx wrangler tail` 會看到大量 401。
- 本地 `bun run dev` / `bun run preview` 不會帶 Access header：把 `.dev.vars` 裡的 `CF_ACCESS_AUD` 留空即可保持 dev 模式。
