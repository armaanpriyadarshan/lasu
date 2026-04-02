# Telegram Channel Integration

## Overview

Add Telegram as a messaging channel for sudo. Users can choose "Continue with Telegram" on the start page as an alternative to phone verification. The Telegram bot runs through the same agent loop as SMS — identical behavior, shared message history.

## User Flow

### Telegram path (new)
1. User opens app, taps "Continue with Telegram"
2. App calls `POST /auth/telegram` → receives `user_id`, signs in
3. App navigates to `(app)`, setup screen detects no phone number
4. Setup screen shows a deep link: `https://t.me/sudo?start={user_id}`
5. User taps "Open in Telegram", sends first message
6. Bot receives `/start {user_id}`, links `telegram_chat_id` to user row
7. Subsequent messages go through agent loop, saved to messages table
8. Setup screen polls `GET /messages/{user_id}`, detects message, shows dashboard

### SMS path (existing, unchanged)
1. User enters phone, verifies code
2. Setup screen shows SMS number
3. User texts, setup screen detects message, shows dashboard

## Backend Changes

### New endpoint: `POST /auth/telegram`
- Creates a user row with `phone_number = null`, `verified = true`, `telegram_chat_id = null`
- Returns `{ ok: true, user_id: string }`

### New endpoint: `POST /telegram`
- Webhook for Telegram Bot API updates
- Receives JSON with `message.chat.id`, `message.text`
- If text starts with `/start {user_id}`: link `telegram_chat_id` to that user, send welcome reply
- Otherwise: look up user by `telegram_chat_id`, reject if not found
- Run `save_message` → `run_agent` → `save_message` → send reply via Telegram

### New file: `backend/telegram.py`
- `send_message(chat_id: int, text: str)` — calls Telegram Bot API `sendMessage`
- Uses `TELEGRAM_BOT_TOKEN` env var
- Simple `requests.post` call, no SDK needed

### DB changes (`db.py`)
- Add `telegram_chat_id` column to `users` table (nullable bigint)
- `get_user_by_telegram(chat_id: int)` — look up user by telegram_chat_id
- `link_telegram(user_id: str, chat_id: int)` — set telegram_chat_id on user row
- `create_telegram_user()` — insert user with no phone, verified=true, return row

### New env var
- `TELEGRAM_BOT_TOKEN` — from BotFather

## Frontend Changes

### Start page (`src/app/index.tsx`)
- Add "Continue with Telegram" button below the phone input card
- On press: call `POST /auth/telegram`, sign in with returned user_id, navigate to `(app)`
- Styled as a secondary/ghost button to not compete with the phone input

### API client (`src/lib/api.ts`)
- Add `authTelegram()` function calling `POST /auth/telegram`

### Setup screen (in `(app)/_layout.tsx`)
- Check if user has a phone number (need new endpoint or extend `/config`)
- If no phone: show Telegram deep link with "Open in Telegram" button using `Linking.openURL`
- If phone: show SMS number as current
- Polling for first message works the same for both paths

### Backend: extend user info
- `GET /users/{user_id}` or extend `POST /auth/telegram` response to include whether user has phone
- Setup screen uses this to decide which UI to show

## Database Migration

Add column to users table:
```sql
ALTER TABLE users ADD COLUMN telegram_chat_id BIGINT UNIQUE;
```

## Telegram Bot Setup

1. Message @BotFather on Telegram, create bot named "sudo"
2. Get token, set as `TELEGRAM_BOT_TOKEN`
3. Set webhook: `POST https://api.telegram.org/bot{token}/setWebhook` with `url = https://{railway-url}/telegram`

## What does NOT change

- `agent.py` — already channel-agnostic
- `sms.py` — untouched
- SMS webhook — untouched
- Dashboard screen — messages from both channels appear the same
- Memory extraction (when built) — works on all messages regardless of channel
