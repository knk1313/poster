Cloud Schedulerからの実行
一回消して作り直す

gcloud scheduler jobs delete post-news-from-sheet --location=asia-northeast1

gcloud scheduler jobs create http post-news-from-sheet --location=asia-northeast1 --schedule="0 _/2 _ \* \*" --time-zone="Asia/Tokyo" --uri="https://asia-northeast1-news-480123.cloudfunctions.net/postNewsFromSheet" --http-method=GET --oidc-service-account-email=415108133482-compute@developer.gserviceaccount.com --oidc-token-audience="https://asia-northeast1-news-480123.cloudfunctions.net/postNewsFromSheet"

手動で実行
gcloud functions call fetchYahooNews --region=asia-northeast1
gcloud functions call postNewsFromSheet --region=asia-northeast1

fetch-yahoo-newsのスケジューラ
手動実行: gcloud scheduler jobs run fetch-yahoo-news --location=asia-northeast1
状態確認: gcloud scheduler jobs describe fetch-yahoo-news --location=asia-northeast1
一時停止/再開: gcloud scheduler jobs pause fetch-yahoo-news --location=asia-northeast1 / resume

postNewsFromSheetのスケジューラ
状態確認 gcloud scheduler jobs describe post-news-from-sheet --location=asia-northeast1
一時停止 gcloud scheduler jobs pause post-news-from-sheet --location=asia-northeast1
再開 gcloud scheduler jobs resume post-news-from-sheet --location=asia-northeast1
手動実行 gcloud scheduler jobs run post-news-from-sheet --location=asia-northeast1

ログ
gcloud functions logs read fetchYahooNews --region=asia-northeast1 --limit=100
gcloud functions logs read postNewsFromSheet --region=asia-northeast1 --limit=50
gcloud functions logs read fetchYahooNews --region=asia-northeast1 --limit=20

デプロイ
npm run deploy
npm run deploy:post

やること
シートに tweet_id を書くフロー（投稿成功時だけ I 列更新）
コスト監視（OpenAI/Sheets/API 呼び出しの頻度と上限設定）
