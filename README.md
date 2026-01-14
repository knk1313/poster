# Poster X Bot

AI-generated posts (quote + short explanation + trivia + hashtags + image) are created and posted to a single account. This MVP targets Instagram posting with generated images and captions. X posting is on hold.

## Requirements

- Node.js 20+
- OpenAI API key
- Instagram Graph API access token + IG user id (Business/Creator)
- PostgreSQL (Cloud SQL recommended) with `DATABASE_URL`
- Public image hosting (Cloud Storage recommended)

## Setup

1. Copy `env.example` to `.env` and fill in values.
2. Install dependencies:

```bash
npm install
```

## Local Run

```bash
npm run dev
```

Endpoints (GET/POST):

- `/health` -> simple health check
- `/scheduled` -> generate + post (Instagram)
- `/generate` -> generate draft only
- `/post` -> post the latest draft (Instagram)
- `/images/<file>` -> serve generated images (used for Instagram in local mode)

If `CRON_SECRET` is set, include it:

```bash
curl -X POST "http://localhost:8080/scheduled" -H "X-CRON-SECRET: your-secret"
```

## Image Hosting (Instagram)

Instagram Graph API needs a **public image URL**.

- Local testing: expose your local server with Cloudflare Tunnel or ngrok and set `PUBLIC_BASE_URL`.
  - Example: `PUBLIC_BASE_URL=https://xxxx.trycloudflare.com`
  - Images are served from `/images/<file>`.
- Cloud Run: set `GCS_BUCKET` and `GCS_PUBLIC=true` to upload images to Cloud Storage and use public URLs.
  - If `GCS_PUBLIC=false`, a signed URL is generated (short-lived). Use with caution.

## Image Size Limit

Generated images are kept under 5MB. You can set `OPENAI_IMAGE_SIZE` to `512x512` or `256x256` in `.env` if needed.

## Cloud Run + Cloud SQL + Cloud Storage (example)

Deploy to Cloud Run:

```bash
gcloud run deploy poster-x-bot \
  --source . \
  --region asia-northeast1 \
  --set-env-vars OPENAI_API_KEY=your_openai_api_key
  --set-cloudsql-instances PROJECT:REGION:INSTANCE
```

`DATABASE_URL` example for Cloud SQL:

```text
postgresql://USER:PASSWORD@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE
```

Create a scheduler job (3 times per day):

```bash
gcloud scheduler jobs create http poster-x-bot \
  --location=asia-northeast1 \
  --schedule="0 8,13,20 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://YOUR_CLOUD_RUN_URL/scheduled" \
  --http-method=POST \
  --headers="X-CRON-SECRET: your-secret"
```

## Database Schema (PostgreSQL)

Table: `posts`

- `id` SERIAL PRIMARY KEY
- `created_at` TIMESTAMPTZ
- `scheduled_for` TIMESTAMPTZ
- `subtheme` TEXT
- `figure_name` TEXT
- `quote` TEXT
- `source` TEXT
- `short_explain` TEXT
- `trivia` TEXT
- `hashtags` TEXT
- `post_text` TEXT
- `image_prompt` TEXT
- `image_path` TEXT
- `image_url` TEXT (nullable)
- `status` TEXT (`draft` | `posted` | `failed`)
- `tweet_id` TEXT (legacy)
- `ig_container_id` TEXT
- `ig_post_id` TEXT
- `error` TEXT

## File Structure

- `src/index.ts`: Cloud Functions entry points (optional)
- `src/localServer.ts`: local HTTP server + image hosting
- `src/workflow.ts`: core generate/post flow (Instagram)
- `src/textGenerator.ts`: OpenAI text generation
- `src/imageGenerator.ts`: OpenAI image generation + GCS upload
- `src/instagramPoster.ts`: Instagram publish flow
- `src/db.ts`: PostgreSQL access (Cloud SQL)
- `src/buildTweet.ts`: post formatting + length control

## Auth / Secrets

- Store all API keys in `.env` (ignored by git).
- `CRON_SECRET` protects HTTP endpoints from public access.
- Do not commit `.env` or generated images/DB files.
