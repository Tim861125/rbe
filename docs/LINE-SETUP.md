# LINE Messaging API 設定指南

目標：拿到 `LINE_CHANNEL_ACCESS_TOKEN` 與 `LINE_GROUP_ID` 兩個 secret。沒設之前網站也能正常運作——系統自動 mock，推播訊息只印在 Worker log（`bunx wrangler tail` 可見），方便先測訊息格式。

## 額度提醒

**push 訊息免費額度為 200 則/月**。本網站只在「加人」時發送（減人不發），正常使用下不會超；若報名量增大，留意每月 push 額度。

## 1. 建立 LINE 官方帳號

1. 到 <https://manager.line.biz/> 註冊 / 登入 LINE 官方帳號管理平台
2. 點「新增 LINE Official Account」，建立一個帳號（名稱建議含用途，例如 `RBE 報名通知`；機器人以這個帳號的身分加入群組，頭像與名稱會直接顯示給組員看）

## 2. 開通 Messaging API

1. 在該帳號的設定頁 → 「Messaging API」→ 點「取得 token」/ 開始使用
2. 會要求建立一個 LINE Developers provider 與 channel（類型：Messaging API），確認建立

## 3. 取得 Channel Access Token

1. 到 <https://developers.line.biz/console/> → 選剛建立的 provider → Messaging API channel
2. 切到「Messaging API」分頁，最下面「Channel access token (long-lived)」→ 按「Issue」
3. 複製這串 token（只顯示一次），稍後會用到：

   ```
   LINE_CHANNEL_ACCESS_TOKEN=<這串>
   ```

4. 同一頁往下有一個「Webhook URL」欄位——**本站不需要 webhook，留空即可**。若日後啟用了 webhook 驗證，因本站沒有對應 endpoint 會驗證失敗，直接跳過或關掉驗證開關。

## 4. 把機器人加入群組

1. 到 <https://manager.line.biz/> → 選這個帳號 →「訊息區塊（Message blocks）」→「加為好友（Add friend）」，開啟區塊功能後取得 QR code / 加好友連結
2. 用社群帳號掃 code 加機器人為好友
3. 在 LINE 裡把機器人拉進要接收公告的群組
4. 群組設定 →「允許此官方帳號接收訊息與資料」→ 允許（否則機器人讀不到群組訊息，不影響 push，但影響下一步查 ID 的方式之一）

## 5. 取得群組 ID

機器人被拉進群組後，群組裡任何一則**成員發送的訊息**都會觸發 webhook event，用一個臨時 webhook URL 就能收到群組 ID。兩種方式：

### 方式 A：臨時用 webhook 接收（推薦，無需程式）

1. 到 <https://webhook.site/> 開一個臨時 URL
2. 把它填進 channel 的「Webhook URL」並按驗證（驗證會送一個 test 事件）
3. 請一位群組成員在群組裡發一句話
4. webhook.site 頁面上會收到一筆 JSON，裡面 `events[0].source.groupId` 就是群組 ID，形如 `Cxxxxxxxxxxxxxxxxxxxxxxxxx...`

### 方式 B：用訊息記錄

若之前有測試發過訊息，官方帳號管理平台（manager.line.biz）的訊息發送記錄也會顯示目標 ID。通常用方式 A 最快。

拿到後可以把 webhook URL 清空並關掉 webhook，不影響 push。記下 ID：

```
LINE_GROUP_ID=<C 開頭的群組 ID>
```

注意：群組 ID 是 `C` 開頭、user ID 是 `U` 開頭，不要抓錯。

## 6. 設定 Secrets 並重新部署

```bash
bunx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
bunx wrangler secret put LINE_GROUP_ID
bun run build && bunx wrangler deploy
```

`wrangler secret put` 本身會立即套用到已部署的 Worker；若還沒部署過，這一步同時完成首次部署。

## 7. 驗證

1. 在網站上對任一小組「加人」
2. 群組應收到一則公告，格式例如：

   ```
   中壢新增2人參加，目前各組人數如下
   台北 10 人
   中壢 15 人
   新竹 7 人
   台中 8 人
   ```

3. 沒收到時先 `bunx wrangler tail` 看 log：出現 `[line] push failed: HTTP 4xx` 多半是 token 或 group ID 填錯（401/404）

## 驗證 Secret 是否生效（Mock 模式排查）

若在 log 只看到訊息被原樣印出來、群組沒收到推播，代表 Worker 讀不到 secret（mock 模式），檢查第 6 步兩個 secret 是否都填過且沒填錯位置。
