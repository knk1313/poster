# トークン管理メモ（長期運用で失効しやすいもの）

## 1. Facebook User Access Token（短期）

- 期限: 数時間〜1日程度
- 用途: 長期User tokenへの交換、Page token取得
- 再取得: Graph API Explorerで発行（対象アプリを選択し権限付与）
  - 必須権限: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`

## 2. Facebook User Access Token（長期）

- 期限: 約60日
- 用途: Page token取得の元になる
- 再取得（短期→長期交換）:

$clientId = "APP_ID"
$clientSecret = "APP_SECRET"
$short = "SHORT_USER_TOKEN"
$url = "https://graph.facebook.com/v20.0/oauth/access_token"

curl.exe -G $url `
  --data-urlencode "grant_type=fb_exchange_token" `
  --data-urlencode "client_id=$clientId" `  --data-urlencode "client_secret=$clientSecret"`
--data-urlencode "fb_exchange_token=$short"

- 返ってきた `access_token` が長期User token

## 3. Page Access Token（IG投稿に使用）

- 期限: 元になる長期User tokenの期限に準拠
- 用途: Instagram Graph APIの投稿
- 再取得:

```bash
curl.exe "https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=LONG_USER_TOKEN"
```

- 返ってきた `access_token` を `IG_ACCESS_TOKEN` に設定
- `instagram_business_account.id` を `IG_USER_ID` に設定

## 4. 注意点

- アプリが Development モードの場合、**Rolesに自分が入っていて承認済み**でないとトークンが使えない。
- `pages_read_engagement` などの権限が `granted` になっていないと `/me/accounts` が空になる。
- トークンや `APP_SECRET` は漏洩前提で扱う。貼り付け・共有後は必ず再発行する。
