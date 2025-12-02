# X APIキー取得手順

## 手順

1. https://developer.twitter.com/ にアクセス
2. FreeプランにてGet started
3. 「Sign up for Free Account」を押す
4. Developer agreement & policyにて申請文を作成

5. Developer PortalのProject&AppsのOverviewに移動
6. PROJECT APPの歯車アイコンからUser authentication settingsのSet upへ
7. App permissionsとしてRead and writeを選択
8. 以下のように設定

- App permissions : Read and write
- Type of App : Web App, Automated App or Bot

- Callback URL / Redirect URL : https://localhost/
- Website URL : https://example.com
- Organization name / Organization URL : 任意

9. Yesを選択
10. Client IDとClient Secretをメモ（OAuth 1.0a）
11. Project&Appsにもどり、「Keys and tokens」 をクリック
12. Consumer KeysからAPI Key and SecretのRegenerateをクリックして、API KeyとAPI Secretをメモ
13. Access token and secretからGenerateをクリックして、Access TokenとAccess Token Secretをメモ

## 申請文

I am developing a small automation tool that posts news headlines and summaries to X.

The tool will:

- fetch public news articles from major Japanese news sites (e.g., Yahoo! News),
- generate short summaries and captions using an AI API (such as OpenAI),
- and automatically post them to a dedicated X account.

The purpose is to experiment with news summarization and posting automation for personal development and a client project. It will not be used for spam or aggressive growth. The account will clearly state that it is an automated bot.

## テスト用アカウント

- Client ID eFFUN3k5VG1jVGlzNjdCZkVwbzM6MTpjaQ
- Client Secret LQOlD8qdpW3qGqvjIVWl8cHTbXezzUcQ8gmRM6SRMJjdWaxn7r
- API Key LBttVQTXxnPGp7QmXj9crcOSd
- API Key Secret rmcTs0gHheS17WhtBY3y9Ca0CtvSpVAGdAbuIgF6Ttezx9U8PC
- Access Token 1995751066701627394-KadRGDXOHOSw6v4D2OyGGcrnAT4eY7
- Access Token Secret 9VMSx34xQwegMPhEBXAPBpQr5cNPDCYUdvC57FedpWBzU
