# ニュース情報 RSS の取得

## 参照する xml

- 主要 : https://news.yahoo.co.jp/rss/topics/top-picks.xml
- 国内 : https://news.yahoo.co.jp/rss/topics/domestic.xml
- 国際 : https://news.yahoo.co.jp/rss/topics/world.xml
- 経済 : https://news.yahoo.co.jp/rss/topics/business.xml
- エンタメ : https://news.yahoo.co.jp/rss/topics/entertainment.xml
- スポーツ : https://news.yahoo.co.jp/rss/topics/sports.xml
- IT・科学 : https://news.yahoo.co.jp/rss/topics/it.xml
- 地域 : https://news.yahoo.co.jp/rss/topics/local.xml

## RSS 取得時のカラム定義

| カラム名  | 型     | 必須 | 説明                                                               |
| --------- | ------ | ---- | ------------------------------------------------------------------ |
| title     | string | Yes  | 記事タイトル。                                                     |
| url       | string | Yes  | ニュース記事の URL。システム上は **実質ユニークキー** として扱う。 |
| source    | string | Yes  | 記事の種類                                                         |
| fetchedAt | string | Yes  | 投稿実行日時。（例: `2025-12-03T22:35:04.653Z`）                   |

## Google スプレッドシート 保存先

- シート名 yahoo-news-x-bot
- news-sheet1

## Google スプレッドシート カラム定義

| カラム位置 | カラム名   | 型               | 必須                     | 説明                                                                                                    |
| ---------- | ---------- | ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| A          | posted_at  | string (ISO8601) | 任意                     | 記事を **X に投稿した日時**。投稿処理でセットする。MVP 初期は空でも可。                                 |
| B          | source     | string           | 必須                     | 記事取得元の識別子。例：`yahoo_ranking` / `yahoo_top` など。                                            |
| C          | url        | string           | **必須（実質ユニーク）** | ニュース記事の URL。**新着判定のキー**として扱う。重複登録は基本 NG。                                   |
| D          | title      | string           | 必須                     | 記事タイトル。スクレイピング / RSS から取得。                                                           |
| E          | tweet_id   | string           | 任意                     | X 投稿に成功した場合のツイートID。未投稿 / 失敗時は空欄。                                               |
| F          | summary    | string           | 任意                     | X 投稿に使用した本文（要約 / キャプション）。AI 生成したテキストを保存。                                |
| G          | condition  | string           | 任意                     | 承認状態。`承認済み` / `保留中` / `不承認` のいずれか。**MVP では投稿成功時に `承認済み` 固定で保存。** |
| H          | fetched_at | string (ISO8601) | 必須                     | 記事を取得した日時（ランキングを取得したタイミング）。                                                  |
| I          | category   | string           | 任意                     | 記事カテゴリ。例：`国内`, `国際`, `経済`, `スポーツ` など。HTML から取れる範囲で。                      |
