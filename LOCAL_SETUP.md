# Local Backend Setup Guide

## 1. Get Supabase Credentials

1. Go to [supabase.co](https://supabase.co)
2. Sign in to your project
3. Navigate to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Create `.env` File

Copy `.env.local` to `.env` and fill in the Supabase keys:

```bash
cp .env.local .env
```

Then edit `.env` and add your keys:

```env
PORT=4000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xoznufjoozmrhyuxngiv.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# App update flags (optional)
APP_UPDATE_AVAILABLE=false
APP_UPDATE_AUTOPROMPT=false

# SMS Services (optional for local testing)
MSG91_AUTH_KEY=
MSG91_TEMPLATE_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# AI Services (optional)
ANTHROPIC_API_KEY=
```

## 3. Test the Bypass Phone

For local testing without sending real SMS, use the bypass phone number:
- **Phone**: `+918547032018`
- **OTP**: Any 6-digit code (e.g., `123456`)

## 4. Start Development Server

```bash
npm run dev
```

Server will run on: **http://localhost:4000**

## 5. Test the API

### Send OTP (Bypass)
```bash
curl -X POST http://localhost:4000/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "918547032018"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:4000/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "918547032018", "otp": "123456"}'
```

## Available Scripts

- `npm run dev` - Start with hot-reload (development)
- `npm run build` - Build for production
- `npm start` - Run production build

## Troubleshooting

**Error: ZodError - Invalid input - SUPABASE keys undefined**
- Make sure `.env` file exists (not `.env.local`)
- Check all required keys are filled in
- Restart the dev server after updating `.env`

**Port already in use**
- Change PORT in `.env` to another port (e.g., 4001)
- Or kill process: `lsof -i :4000 | grep LISTEN | awk '{print $2}' | xargs kill -9`
