# sudo

a 24/7 autonomous personal intelligence agent. sign in, talk to it, and it remembers everything.

## stack

| layer | choice |
|---|---|
| backend | FastAPI (Python 3.11+) |
| database | Supabase (Postgres) |
| auth | Supabase Auth (email/password + Google OAuth) |
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

create a project. create two tables:

```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create table memory (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  unique(user_id, key)
);
```

enable authentication providers in Supabase dashboard:
- **Email**: enabled by default
- **Google**: Authentication > Providers > Google — add your OAuth client ID and secret

### 3. environment variables

backend — create `backend/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
```

app — create `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

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

## deployment

- **backend**: Railway. set env vars in the dashboard. uses `Procfile`: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- **app**: Expo Go for dev, EAS for production builds
