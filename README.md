# sudo

a 24/7 autonomous personal intelligence agent. text it over SMS or Telegram, and it responds with context about your life. it remembers everything you tell it.

## stack

| layer | choice |
|---|---|
| backend | FastAPI (Python 3.11+) |
| database | Supabase (Postgres) |
| SMS | Twilio Messaging + Verify |
| telegram | Bot API + Login Widget (OAuth) |
| LLM | OpenAI API |
| app | Expo (React Native) — web, iOS, Android |

## setup

### 1. clone and install

```bash
git clone <repo-url> && cd sudo
```

backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

app:

```bash
npm install
```

### 2. supabase

create a project. create three tables:

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  phone_number text unique,
  verified boolean default false,
  created_at timestamptz default now(),
  telegram_chat_id bigint unique
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create table memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  unique(user_id, key)
);
```

enable Realtime on the `messages` table (Database > Replication).

### 3. twilio

- create a Twilio account and get a phone number
- create a Verify Service (for phone code verification)

### 4. telegram bot

- message @BotFather on Telegram, run `/newbot`
- name it whatever you want (username must end in `bot`)
- save the bot token

### 5. environment variables

backend — create `backend/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
TWILIO_VERIFY_SERVICE_SID=VA...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=your_bot_username
APP_URL=http://localhost:8000
```

`APP_URL` is your public backend URL — ngrok in dev, Railway in prod.

the app uses defaults in `src/lib/api.ts`. update the API URL there for production.

## running

### backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### app

```bash
npx expo start
```

press `w` for web, `i` for iOS simulator, `a` for Android.

### local dev with webhooks

you need a public URL for Twilio and Telegram webhooks. use ngrok:

```bash
ngrok http 8000
```

then:

1. update `APP_URL` in `backend/.env` to the ngrok https URL
2. set the Twilio SMS webhook to `https://<ngrok-url>/sms`
3. set the Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<ngrok-url>/telegram"}'
```

## deployment

- **backend**: Railway. set env vars in the dashboard. uses `Procfile`: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- **twilio webhook**: point to `https://<railway-url>/sms`
- **telegram webhook**: point to `https://<railway-url>/telegram`
- **app**: Expo Go for dev, EAS for production builds
