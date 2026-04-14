# trueKin Backend

Dedicated backend repo for the trueKin mobile app.

## Why this repo exists

- Keeps frontend and backend in separate deployable codebases
- Centralises backend-driven app content and orchestration
- Moves external provider logic out of the mobile app
- Creates a cleaner path to scale API ownership over time

## Stack

- Language: TypeScript
- Runtime: Node.js
- Framework: Fastify
- Data/Auth: Supabase

TypeScript is the best fit here because the frontend is already TypeScript, which lets us share payload shapes, move faster safely, and keep a backend-driven mobile app consistent as it scales.

## Current services

- `GET /health`
- `POST /v1/auth/otp/send`
- `POST /v1/auth/otp/verify`
- `POST /v1/homepage`
- `POST /v1/support/tickets`
- `POST /v1/prescriptions/analyze`

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The API starts on `http://localhost:4000` by default.

If you are testing on a physical phone, set the frontend app's
`EXPO_PUBLIC_API_BASE_URL` to your machine's local network IP instead of
`localhost`.

## Environment

Required values live in `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MSG91_*` for India OTP delivery
- `TWILIO_*` for international OTP delivery
- `ANTHROPIC_API_KEY` for prescription parsing
- `APP_UPDATE_*` flags for backend-driven update prompts

## Frontend integration

The mobile app repo at `/Users/naveen/Desktop/Careloop/truekin` now calls this
backend for:

- OTP send and verify
- Backend-driven homepage content
- Support ticket submission
- Prescription analysis

Supabase still owns auth session persistence, storage uploads, and the current
app data tables.

## Production hosting

### Option A — Vercel (free Hobby tier, no credit card required) ⭐ Recommended

The repo already ships `vercel.json` and `api/index.ts` — Fastify runs as a
single Vercel serverless function and all routes are rewritten to it.

```bash
npm i -g vercel
vercel login            # opens browser; GitHub or email auth, no card asked
vercel link             # create a new project named "truekin-backend"

# Push env vars from your local .env file to Vercel (production + preview)
for key in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
           MSG91_AUTH_KEY MSG91_TEMPLATE_ID MSG91_SENDER_ID \
           TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER \
           ANTHROPIC_API_KEY APP_UPDATE_AVAILABLE APP_UPDATE_AUTOPROMPT \
           APP_UPDATE_URL; do
  value=$(grep "^$key=" .env | cut -d= -f2-)
  [ -n "$value" ] && echo "$value" | vercel env add $key production
done

vercel --prod
```

Public URL will be `https://truekin-backend.vercel.app` (or your chosen name).

### Option B — Render (requires card on newer accounts)

1. Push this repo to GitHub.
2. In Render, "New +" → "Blueprint" → select this repo. Render reads `render.yaml`.
3. Fill the `sync: false` secrets in the Render dashboard (Supabase, MSG91, Twilio, Anthropic).
4. Render builds via `npm ci && npm run build` and runs `node dist/index.js`.
5. Public URL will be `https://truekin-backend.onrender.com` (or your chosen name).

### Option B — Fly.io (better latency, global)

```bash
brew install flyctl
fly auth login
fly launch --no-deploy --copy-config      # accept existing fly.toml
fly secrets set \
  SUPABASE_URL=... \
  SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  MSG91_AUTH_KEY=... \
  MSG91_TEMPLATE_ID=... \
  TWILIO_ACCOUNT_SID=... \
  TWILIO_AUTH_TOKEN=... \
  TWILIO_PHONE_NUMBER=... \
  ANTHROPIC_API_KEY=...
fly deploy
```

Public URL will be `https://truekin-backend.fly.dev`.

### After deploying

Update the mobile app's production env:

```
# truekin/.env.production  (or EAS secret)
EXPO_PUBLIC_API_BASE_URL=https://truekin-backend.onrender.com
```

## Database migrations

Supabase migrations live in [`supabase/migrations`](/Users/naveen/Desktop/Careloop/truekin-backend/supabase/migrations).

Apply the existing migration set, including `004_support_tickets.sql`, to keep
the backend-owned flows working correctly.
