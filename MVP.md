# AI自動投稿システム MVP 仕様

対象: 雑学・教養系アカウント（初期テーマ「世界の偉人と名言」）

## 1. 目的

- 1日3回、定時に「偉人の名言 + 短い解説 + 雑学 + ハッシュタグ + 画像」を自動生成し、Instagramへ自動投稿する。
- 投稿内容は教育的で正確性を重視し、断定を避ける。

## 2. MVPの前提

- 投稿対象は Instagram ビジネス/クリエイターアカウント。
- 画像生成は必須。OpenAIを利用する。
- スケジューラはCloud Schedulerを使用（Cloud Run 経由）。
- 永続化はCloud SQL（PostgreSQL）。
- 画像の公開URLはCloud Storageで用意する。
- メトリクス取得はMVPでは不要。
- サブテーマ: 文学。
- 固定ハッシュタグ: #名言 #今日の偉人。

## 3. 機能要件

### 3.1 投稿テキスト生成

入力:

- テーマ: 世界の偉人と名言
- サブテーマ: 文学
- 言語: 日本語

出力（構造化）:

- figure_name: 偉人名
- quote: 名言
- source: 出典（不明なら「諸説あり」）
- short_explain: 背景・解説（短文）
- trivia: 雑学（短文）
- hashtags: 変動タグ
- post_text: 投稿本文（Instagramの上限内）

ルール:

- 断定が危険な逸話は避ける or 注釈。
- 同一人物・同一名言の短期重複は避ける（30日目安）。

### 3.2 画像生成

- 形式: PNGまたはJPEG
- 推奨サイズ: 1024x1024（正方形）
- スタイル: ポスター調、象徴的表現
- 文字入れは原則なし
- 実在人物の写真風は避ける
- 画像は公開URLで参照できる必要がある（Instagram API要件）
- Cloud Storageに保存し、公開URLを使って投稿する

### 3.3 スケジューラ

- 1日3回、固定時刻で実行（例: 08:00 / 13:00 / 20:00 JST）
- Cloud SchedulerからHTTPで起動

### 3.4 Instagram自動投稿

- Instagram Graph API を使用
- 画像URLを指定してコンテナ作成 → 公開
- 失敗時はログに残す

### 3.5 永続化

- Cloud SQL（PostgreSQL）に投稿内容・画像パス・投稿結果を保存

## 4. 非機能要件

- APIキーは環境変数で管理する
- 投稿が失敗しても次回実行で再試行できる構成

## 5. 運用メモ

実行方法、DB構造、ローカル構成、認証情報は `README.md` にまとめる。

## 6. 実行構成（Cloud Run + Cloud SQL + Cloud Storage）

- Cloud Run で `Dockerfile` ビルド（GitHub連携想定）。
- Cloud SQL は PostgreSQL。`DATABASE_URL` で接続する。
- Cloud Storage に画像を保存し、Instagramへは公開URLまたは署名URLを渡す。
- `CRON_SECRET` を使ってHTTPエンドポイントを保護する。

### 6.1 必須の環境変数（Cloud Run）

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL`（例: `dall-e-3`）
- `IMAGE_OVERLAY_ENABLED`（例: `true`）
- `IMAGE_OVERLAY_TEXT`（例: `一生覚えておきたい\n心に刺さる言葉`）
- `IG_ACCESS_TOKEN`（Page access token）
- `IG_USER_ID`（Instagram business account id）
- `DATABASE_URL`（例: `postgresql://USER:PASSWORD@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE`）
- `GCS_BUCKET`
- `GCS_PUBLIC`（`true` or `false`）
- `GCS_PREFIX`（例: `images`）
- `CRON_SECRET`
- `X_OAUTH2_ACCESS_TOKEN`（X投稿を使う場合・OAuth 2.0）

### 6.2 Cloud Storage について

- `GCS_PUBLIC=true` の場合、アップロード後に `makePublic` を呼ぶ。
  - バケットが **Uniform bucket-level access (UBLA)** の場合は `makePublic` が失敗するため、
    `GCS_PUBLIC=false` にして署名URLを使う。
- `GCS_PUBLIC=false` の場合、署名URLを発行するため **Service Account Token Creator** 権限が必要。

## 7. エンドポイント

- `GET /health` : ヘルスチェック
- `GET|POST /generate` : 下書き生成
- `POST /post` : 最新の下書きを投稿
- `POST /post-x` : 最新の下書きをXに投稿
- `POST /scheduled` : 生成→投稿を一括実行

※ `CRON_SECRET` を設定している場合は `X-CRON-SECRET` を付与する。

## 8. テスト手順（Cloud Run）

### 8.1 ヘルスチェック

```bash
curl.exe -X GET "https://YOUR_RUN_URL/health" -H "X-CRON-SECRET: your-secret"
```

### 8.2 生成のみ

PowerShellのPOSTは空ボディが必要:

```bash
curl.exe -X POST "https://YOUR_RUN_URL/generate" -H "X-CRON-SECRET: your-secret" -H "Content-Type: application/json" --data-binary "{}"
```

### 8.3 生成→投稿（最短）

```bash
curl.exe -X POST "https://YOUR_RUN_URL/scheduled" -H "X-CRON-SECRET: your-secret" --data-binary "{}"
```

### 8.4 Xのみ投稿

```bash
curl.exe -X POST "https://YOUR_RUN_URL/post-x" -H "X-CRON-SECRET: your-secret" --data-binary "{}"
```

### 8.5 署名URL運用時の注意

- `GCS_PUBLIC=false` の場合、署名URLは短時間で失効するため
  `POST /scheduled` で **生成→投稿を連続実行**する。

## 9. Cloud Scheduler（1日3回）

```bash
gcloud scheduler jobs create http poster-x-bot --location=asia-northeast1 --schedule="0 8,13,20 * * *" --time-zone="Asia/Tokyo" --uri="https://YOUR_RUN_URL/scheduled" --http-method=POST --headers="X-CRON-SECRET=your-secret,Content-Type=application/json" --message-body="{}"
```

オン/オフ切替:

```bash
gcloud scheduler jobs pause poster-x-bot --location=asia-northeast1
gcloud scheduler jobs resume poster-x-bot --location=asia-northeast1
```
