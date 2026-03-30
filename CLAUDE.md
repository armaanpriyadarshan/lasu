# Lasu

## What This Is

Lasu is a 24/7 autonomous personal intelligence agent. The primary interface is SMS — the user texts a Twilio number and the agent responds with context about their life. The Expo app handles initial onboarding (phone verification) and serves as a dashboard afterward (conversation log, memory facts, integration management). The agent is always running; the app is a control plane.

This is not a chatbot. The agent maintains persistent memory extracted from conversations and eventually takes autonomous actions on the user's behalf. For this MVP the scope is: SMS <> agent loop with persistent memory, phone-number-based auth, and an Expo app shell.

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python 3.11+) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth + Twilio Verify (phone-based only) |
| SMS | Twilio Messaging + Twilio Verify |
| LLM | Anthropic Claude API (claude-sonnet-4-20250514) |
| Mobile/Web app | Expo (React Native) with Supabase Realtime |
| Deployment | Railway (backend), Expo Go / EAS (app) |

## Repository Structure

```
lasu/
  backend/
    main.py              # FastAPI app entry point
    agent.py             # Agent loop — context assembly + Claude call
    memory.py            # Memory extraction after each exchange
    sms.py               # Twilio send/receive helpers
    db.py                # Supabase client + all DB queries
    models.py            # Pydantic models
    requirements.txt
    .env
  app/                   # Expo app (currently in src/)
    App.tsx
    screens/
      Onboarding.tsx     # Phone entry + verify
      Dashboard.tsx      # Conversation log (main screen after setup)
      Memory.tsx         # Facts the agent has learned
    lib/
      supabase.ts        # Supabase client
    package.json
```

## Architecture

### Backend

- **SMS webhook** (`POST /sms`): Receives inbound Twilio messages. Looks up user by phone number, rejects unknown/unverified users, runs the agent loop, saves messages, triggers async memory extraction, and sends the reply via SMS.
- **Agent loop** (`agent.py`): Assembles context (system prompt with memory facts + recent message history) and calls Claude. System prompt instructs Claude to behave as a persistent personal assistant communicating over SMS — concise, plain text, no markdown.
- **Memory extraction** (`memory.py`): After each exchange, a separate Claude call extracts structured key/value facts about the user (name, location, projects, preferences, etc.) and upserts them into the memory table. This runs as a background task so it never delays the SMS reply.
- **Auth endpoints**: `POST /auth/send-code` sends a Twilio Verify code, `POST /auth/verify` checks it and creates/updates the user record.
- **Dashboard endpoints**: `GET /messages/{user_id}` returns conversation history, `GET /memory/{user_id}` returns extracted memory facts.
- **Direct message endpoint** (`POST /message`): Allows the Expo app to send messages through the same agent loop as SMS (accepts `user_id` + `content`, returns the reply).
- **Health check**: `GET /` returns status.

### Database (Supabase)

Three tables:
- **users**: Keyed by phone number (E.164 format), tracks verification status.
- **messages**: All SMS messages in and out, linked to user, with role (`user`/`assistant`) and timestamp.
- **memory**: Key/value facts extracted from conversations, unique per user+key, with upsert semantics.

Row-level security is enabled on all tables. Backend uses the service role key (bypasses RLS). The Expo app uses the anon key for reads only.

### Expo App

- **Onboarding screen**: Phone entry + 6-digit code verification via the backend auth endpoints. On success, stores `user_id` in AsyncStorage and navigates to Dashboard.
- **Dashboard screen**: Shows the full conversation log as a FlatList (user messages right-aligned, assistant left-aligned). Subscribes to Supabase Realtime on the messages table so new SMS messages appear live. Includes a text input bar for sending messages directly from the app via `POST /message`.
- **Memory screen**: Displays extracted memory facts as key/value pairs. Labeled "What Lasu knows about you".
- **Navigation**: Stack navigator. Checks AsyncStorage for `user_id` on load — if present goes to Dashboard, otherwise Onboarding.

## Environment Variables

### Backend `.env`
- `ANTHROPIC_API_KEY` — Claude API key
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (backend only, never expose)
- `TWILIO_ACCOUNT_SID` — Twilio account SID
- `TWILIO_AUTH_TOKEN` — Twilio auth token
- `TWILIO_PHONE_NUMBER` — The Lasu SMS number (E.164 format)
- `TWILIO_VERIFY_SERVICE_SID` — From Twilio Verify service

### App
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Anon key only (safe to expose)

## Deployment

- **Backend**: Railway. Uses a Procfile: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`. Env vars set in Railway dashboard.
- **Twilio webhook**: Point the Twilio phone number's messaging webhook to `POST https://<railway-url>/sms`.
- **App**: Expo Go for development, EAS for production builds.
- **Local dev**: Use `ngrok http 8000` to expose FastAPI and point Twilio webhook at the ngrok URL.

## Important Conventions

- Phone numbers are always E.164 format (`+15551234567`). Twilio sends `From` in E.164 automatically. Validate and normalize in the app before sending.
- Memory extraction is async (`asyncio.create_task`) — never delays the SMS reply.
- Never use the Supabase service role key in the Expo app. Only the anon key goes in the app.
- Twilio Verify requires a Verify Service SID, separate from the messaging SID.
- Supabase Realtime must be enabled on the `messages` table (Database > Replication).

## MVP Scope

**Included:**
- Phone-number-based auth with Twilio Verify
- SMS <> agent loop with full conversation history
- Persistent memory extracted from every exchange
- Expo app: onboarding, conversation dashboard, memory view
- Direct message from app (same agent loop as SMS)

**Explicitly deferred:**
- Integrations (Gmail, Calendar, etc.)
- Proactive outreach (agent texting you unprompted)
- Context graph
- Automation creation
- Multi-user isolation beyond DB filtering
- Auth vault / encrypted credential storage
- Per-user Docker containers
