# Phase 5B: Google Integration Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Calendar, Email, Contacts, and Cloud Files tools via Google APIs (Google Calendar, Gmail, Google People, Google Drive), with a shared Google OAuth flow for users to connect their accounts.

**Architecture:** Users connect their Google account once via OAuth2. Tokens are stored per-user in a `user_oauth_tokens` table. Each Google tool checks for a valid token before executing. Tools are registered in the existing tool registry from Phase 5A and use the same permission enforcement. The frontend gets a "Connect Google" button in settings/agent profile.

**Tech Stack:** Supabase, FastAPI, Google APIs (google-api-python-client, google-auth), OAuth2, Expo Router, React Native

**Supabase Project ID:** `imvbbxblyegwmkfdzxmb`

**Prerequisites:** Phase 5A (tool framework) must be completed first. A Google Cloud project with Calendar, Gmail, People, and Drive APIs enabled, plus OAuth2 credentials (client ID + secret).

## Environment Variables Needed

Add to `backend/.env`:
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8001/auth/google/callback
```

Set up at https://console.cloud.google.com — create OAuth2 credentials, enable Calendar, Gmail, People, and Drive APIs.

## File Structure

| File | Responsibility |
|------|---------------|
| `backend/google_auth.py` | **New** — Google OAuth2 flow (generate auth URL, exchange code, refresh tokens) |
| `backend/db.py` | Add OAuth token storage/retrieval functions |
| `backend/tools/calendar.py` | **New** — Google Calendar tool (list events, create event) |
| `backend/tools/email.py` | **New** — Gmail tool (read inbox, send email) |
| `backend/tools/contacts.py` | **New** — Google People API tool (list contacts, search) |
| `backend/tools/files.py` | **New** — Google Drive tool (list files, read file) |
| `backend/main.py` | Add Google OAuth endpoints, register new tools |
| `backend/agent.py` | Register new tools at module load |
| `src/lib/api.ts` | Add Google OAuth API functions |
| `src/app/(app)/chat/[agentId].tsx` | Add "Connect Google" prompt when Google tools need auth |

---

### Task 1: Install Google dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add Google packages**

Add to `backend/requirements.txt`:

```
google-api-python-client
google-auth
google-auth-oauthlib
google-auth-httplib2
```

- [ ] **Step 2: Install**

Run: `cd /c/Users/ezhou/projects/lasu/backend && pip install google-api-python-client google-auth google-auth-oauthlib google-auth-httplib2`

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat: add Google API dependencies"
```

---

### Task 2: Database — OAuth token storage

**Files:**
- Supabase migration
- Modify: `backend/db.py`

- [ ] **Step 1: Create `user_oauth_tokens` table via Supabase MCP**

```sql
CREATE TABLE public.user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  scopes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_oauth_provider ON public.user_oauth_tokens(user_id, provider);

ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Add token functions to db.py**

Append to end of `backend/db.py`:

```python
# ── OAuth token functions ──

async def save_oauth_token(user_id: str, provider: str, access_token: str,
                           refresh_token: str = None, token_expiry: str = None, scopes: str = "") -> dict:
    res = (
        supabase.table("user_oauth_tokens")
        .upsert(
            {
                "user_id": user_id,
                "provider": provider,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_expiry": token_expiry,
                "scopes": scopes,
                "updated_at": "now()",
            },
            on_conflict="user_id,provider",
        )
        .execute()
    )
    return res.data[0] if res.data else None


async def get_oauth_token(user_id: str, provider: str = "google") -> dict | None:
    res = (
        supabase.table("user_oauth_tokens")
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", provider)
        .execute()
    )
    return res.data[0] if res.data else None


async def delete_oauth_token(user_id: str, provider: str = "google") -> bool:
    res = supabase.table("user_oauth_tokens").delete().eq("user_id", user_id).eq("provider", provider).execute()
    return len(res.data) > 0
```

- [ ] **Step 3: Verify**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from db import save_oauth_token, get_oauth_token, delete_oauth_token; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/db.py
git commit -m "feat: add OAuth token storage functions"
```

---

### Task 3: Google OAuth flow

**Files:**
- Create: `backend/google_auth.py`

- [ ] **Step 1: Create `google_auth.py`**

```python
import os
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from db import get_oauth_token, save_oauth_token

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def _get_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=os.environ["GOOGLE_REDIRECT_URI"],
    )


def get_auth_url(user_id: str) -> str:
    """Generate Google OAuth authorization URL."""
    flow = _get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=user_id,
    )
    return auth_url


async def exchange_code(code: str, user_id: str) -> dict:
    """Exchange authorization code for tokens and save them."""
    flow = _get_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    token_data = await save_oauth_token(
        user_id=user_id,
        provider="google",
        access_token=creds.token,
        refresh_token=creds.refresh_token,
        token_expiry=creds.expiry.isoformat() if creds.expiry else None,
        scopes=" ".join(SCOPES),
    )
    return token_data


async def get_google_credentials(user_id: str) -> Credentials | None:
    """Get valid Google credentials for a user, refreshing if needed."""
    token = await get_oauth_token(user_id, "google")
    if not token:
        return None

    creds = Credentials(
        token=token["access_token"],
        refresh_token=token.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
    )

    if not creds.valid and creds.refresh_token:
        creds.refresh(GoogleRequest())
        await save_oauth_token(
            user_id=user_id,
            provider="google",
            access_token=creds.token,
            refresh_token=creds.refresh_token,
            token_expiry=creds.expiry.isoformat() if creds.expiry else None,
            scopes=token.get("scopes", ""),
        )

    return creds if creds.valid else None
```

- [ ] **Step 2: Verify**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from google_auth import get_auth_url; print('OK')"`

Expected: `OK` (will fail at runtime without env vars, but import should work)

- [ ] **Step 3: Commit**

```bash
git add backend/google_auth.py
git commit -m "feat: add Google OAuth2 flow with token refresh"
```

---

### Task 4: Google Calendar tool

**Files:**
- Create: `backend/tools/calendar.py`

- [ ] **Step 1: Create calendar tool**

```python
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from google_auth import get_google_credentials
from tools import register_tool


async def list_events(user_id: str, days: int = 7) -> str:
    """List upcoming calendar events."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("calendar", "v3", credentials=creds)
    now = datetime.utcnow().isoformat() + "Z"
    end = (datetime.utcnow() + timedelta(days=days)).isoformat() + "Z"

    events_result = service.events().list(
        calendarId="primary", timeMin=now, timeMax=end,
        maxResults=20, singleEvents=True, orderBy="startTime"
    ).execute()

    events = events_result.get("items", [])
    if not events:
        return f"No events in the next {days} days."

    lines = []
    for e in events:
        start = e["start"].get("dateTime", e["start"].get("date"))
        lines.append(f"- {start}: {e.get('summary', 'No title')}")
    return "\n".join(lines)


async def create_event(user_id: str, summary: str, start_time: str, end_time: str, description: str = "") -> str:
    """Create a calendar event."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("calendar", "v3", credentials=creds)
    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_time, "timeZone": "UTC"},
        "end": {"dateTime": end_time, "timeZone": "UTC"},
    }
    created = service.events().insert(calendarId="primary", body=event).execute()
    return f"Event created: {created.get('summary')} at {created['start'].get('dateTime')}"


def register_calendar_tools():
    register_tool(
        name="list_calendar_events",
        description="List upcoming events from the user's Google Calendar. Use when the user asks about their schedule, upcoming meetings, or what's on their calendar.",
        permission="calendar",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "days": {"type": "integer", "description": "Number of days ahead to look (default 7)", "default": 7},
            },
            "required": ["user_id"],
        },
        fn=list_events,
    )

    register_tool(
        name="create_calendar_event",
        description="Create a new event on the user's Google Calendar. Use when the user asks to schedule something.",
        permission="calendar",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "summary": {"type": "string", "description": "Event title"},
                "start_time": {"type": "string", "description": "Start time in ISO 8601 format"},
                "end_time": {"type": "string", "description": "End time in ISO 8601 format"},
                "description": {"type": "string", "description": "Event description", "default": ""},
            },
            "required": ["user_id", "summary", "start_time", "end_time"],
        },
        fn=create_event,
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/tools/calendar.py
git commit -m "feat: add Google Calendar tools (list events, create event)"
```

---

### Task 5: Gmail tool

**Files:**
- Create: `backend/tools/email.py`

- [ ] **Step 1: Create email tool**

```python
import base64
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from google_auth import get_google_credentials
from tools import register_tool


async def read_inbox(user_id: str, max_results: int = 10) -> str:
    """Read recent emails from Gmail inbox."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("gmail", "v1", credentials=creds)
    results = service.users().messages().list(
        userId="me", maxResults=max_results, labelIds=["INBOX"]
    ).execute()

    messages = results.get("messages", [])
    if not messages:
        return "Inbox is empty."

    lines = []
    for msg_ref in messages[:max_results]:
        msg = service.users().messages().get(userId="me", id=msg_ref["id"], format="metadata",
            metadataHeaders=["From", "Subject", "Date"]).execute()
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        lines.append(f"- From: {headers.get('From', '?')} | Subject: {headers.get('Subject', '(no subject)')} | {headers.get('Date', '')}")

    return "\n".join(lines)


async def send_email(user_id: str, to: str, subject: str, body: str) -> str:
    """Send an email via Gmail."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("gmail", "v1", credentials=creds)
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return f"Email sent to {to} (ID: {sent['id']})"


def register_email_tools():
    register_tool(
        name="read_inbox",
        description="Read recent emails from the user's Gmail inbox. Use when the user asks about their emails, unread messages, or wants to check their inbox.",
        permission="email",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "max_results": {"type": "integer", "description": "Number of emails to return (default 10)", "default": 10},
            },
            "required": ["user_id"],
        },
        fn=read_inbox,
    )

    register_tool(
        name="send_email",
        description="Send an email on behalf of the user via Gmail. Use when the user asks to send, draft, or compose an email.",
        permission="email",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "to": {"type": "string", "description": "Recipient email address"},
                "subject": {"type": "string", "description": "Email subject line"},
                "body": {"type": "string", "description": "Email body text"},
            },
            "required": ["user_id", "to", "subject", "body"],
        },
        fn=send_email,
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/tools/email.py
git commit -m "feat: add Gmail tools (read inbox, send email)"
```

---

### Task 6: Google Contacts tool

**Files:**
- Create: `backend/tools/contacts.py`

- [ ] **Step 1: Create contacts tool**

```python
from googleapiclient.discovery import build
from google_auth import get_google_credentials
from tools import register_tool


async def list_contacts(user_id: str, query: str = "", max_results: int = 20) -> str:
    """List or search user's Google contacts."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("people", "v1", credentials=creds)

    if query:
        results = service.people().searchContacts(
            query=query, readMask="names,emailAddresses,phoneNumbers", pageSize=max_results
        ).execute()
        contacts = results.get("results", [])
        people = [r.get("person", {}) for r in contacts]
    else:
        results = service.people().connections().list(
            resourceName="people/me", pageSize=max_results,
            personFields="names,emailAddresses,phoneNumbers"
        ).execute()
        people = results.get("connections", [])

    if not people:
        return f"No contacts found{' matching ' + query if query else ''}."

    lines = []
    for person in people:
        name = person.get("names", [{}])[0].get("displayName", "Unknown")
        email = person.get("emailAddresses", [{}])[0].get("value", "")
        phone = person.get("phoneNumbers", [{}])[0].get("value", "")
        parts = [name]
        if email:
            parts.append(email)
        if phone:
            parts.append(phone)
        lines.append(f"- {' | '.join(parts)}")

    return "\n".join(lines)


def register_contacts_tools():
    register_tool(
        name="list_contacts",
        description="List or search the user's Google contacts. Use when the user asks about contacts, phone numbers, or email addresses of people they know.",
        permission="contacts",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "query": {"type": "string", "description": "Search query to filter contacts (optional)", "default": ""},
                "max_results": {"type": "integer", "description": "Max contacts to return (default 20)", "default": 20},
            },
            "required": ["user_id"],
        },
        fn=list_contacts,
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/tools/contacts.py
git commit -m "feat: add Google Contacts tool (list and search contacts)"
```

---

### Task 7: Google Drive tool

**Files:**
- Create: `backend/tools/files.py`

- [ ] **Step 1: Create files tool**

```python
from googleapiclient.discovery import build
from google_auth import get_google_credentials
from tools import register_tool


async def list_files(user_id: str, query: str = "", max_results: int = 20) -> str:
    """List or search files in Google Drive."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("drive", "v3", credentials=creds)

    q = f"name contains '{query}'" if query else None
    results = service.files().list(
        q=q, pageSize=max_results,
        fields="files(id, name, mimeType, modifiedTime, size)"
    ).execute()

    files = results.get("files", [])
    if not files:
        return f"No files found{' matching ' + query if query else ''}."

    lines = []
    for f in files:
        size = f.get("size", "?")
        lines.append(f"- {f['name']} ({f.get('mimeType', '?')}, {size} bytes, modified {f.get('modifiedTime', '?')})")

    return "\n".join(lines)


async def read_file(user_id: str, file_id: str) -> str:
    """Read the content of a text file from Google Drive."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("drive", "v3", credentials=creds)

    try:
        # Get file metadata first
        file_meta = service.files().get(fileId=file_id, fields="name,mimeType").execute()

        # Export Google Docs as plain text
        if file_meta["mimeType"] == "application/vnd.google-apps.document":
            content = service.files().export(fileId=file_id, mimeType="text/plain").execute()
            text = content.decode("utf-8") if isinstance(content, bytes) else str(content)
        else:
            content = service.files().get_media(fileId=file_id).execute()
            text = content.decode("utf-8") if isinstance(content, bytes) else str(content)

        # Truncate
        return text[:5000] if len(text) > 5000 else text
    except Exception as e:
        return f"Failed to read file: {e}"


def register_files_tools():
    register_tool(
        name="list_drive_files",
        description="List or search files in the user's Google Drive. Use when the user asks about their files, documents, or wants to find something in their drive.",
        permission="files",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "query": {"type": "string", "description": "Search query to filter files (optional)", "default": ""},
                "max_results": {"type": "integer", "description": "Max files to return (default 20)", "default": 20},
            },
            "required": ["user_id"],
        },
        fn=list_files,
    )

    register_tool(
        name="read_drive_file",
        description="Read the content of a text file from Google Drive. Use when the user wants to see the contents of a specific file.",
        permission="files",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "file_id": {"type": "string", "description": "The Google Drive file ID"},
            },
            "required": ["user_id", "file_id"],
        },
        fn=read_file,
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/tools/files.py
git commit -m "feat: add Google Drive tools (list files, read file)"
```

---

### Task 8: Register all Google tools + add OAuth endpoints

**Files:**
- Modify: `backend/agent.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Register Google tools in agent.py**

After the existing `register_web_tools()` call in `agent.py`, add:

```python
from tools.calendar import register_calendar_tools
from tools.email import register_email_tools
from tools.contacts import register_contacts_tools
from tools.files import register_files_tools

register_calendar_tools()
register_email_tools()
register_contacts_tools()
register_files_tools()
```

- [ ] **Step 2: Add OAuth endpoints to main.py**

Add these imports at the top of main.py (after existing imports):

```python
from google_auth import get_auth_url, exchange_code
from db import get_oauth_token
```

Add these endpoints at the end of main.py:

```python
# --- Google OAuth endpoints ---

@app.get("/auth/google/url")
async def google_auth_url(user_id: str):
    url = get_auth_url(user_id)
    return {"url": url}


@app.get("/auth/google/callback")
async def google_callback(code: str, state: str):
    user_id = state
    await exchange_code(code, user_id)
    # Redirect back to app
    return {"ok": True, "message": "Google account connected successfully"}


@app.get("/auth/google/status")
async def google_status(user_id: str):
    token = await get_oauth_token(user_id, "google")
    return {"connected": token is not None}
```

- [ ] **Step 3: Update db import in main.py to include get_oauth_token**

Update the db import to add `get_oauth_token`:

```python
from db import (
    save_message, get_recent_messages, get_or_create_user,
    create_agent, get_agents, get_agent, update_agent, delete_agent,
    get_agent_messages, save_agent_message,
    get_agent_memories, upsert_memory, delete_memory,
    get_agent_permissions, grant_permission, revoke_permission,
    get_pending_requests, resolve_permission_request,
    create_job, get_jobs, get_job, update_job, delete_job,
    get_oauth_token,
)
```

- [ ] **Step 4: Verify**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from main import app; print('OK')"`

- [ ] **Step 5: Commit**

```bash
git add backend/agent.py backend/main.py
git commit -m "feat: register Google tools and add OAuth endpoints"
```

---

### Task 9: Frontend — Google connection UI

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add Google OAuth API functions to api.ts**

Append to end of `src/lib/api.ts`:

```typescript
// ── Google OAuth API ──

export async function getGoogleAuthUrl(userId: string) {
  const res = await fetch(`${API_URL}/auth/google/url?user_id=${userId}`)
  if (!res.ok) throw new Error('Failed to get auth URL')
  return res.json() as Promise<{ url: string }>
}

export async function getGoogleStatus(userId: string) {
  const res = await fetch(`${API_URL}/auth/google/status?user_id=${userId}`)
  if (!res.ok) throw new Error('Failed to check status')
  return res.json() as Promise<{ connected: boolean }>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add Google OAuth API client functions"
```

---

### Task 10: End-to-end verification

- [ ] **Step 1: Set up Google Cloud credentials**

1. Go to https://console.cloud.google.com
2. Create a project or select existing
3. Enable Calendar, Gmail, People, and Drive APIs
4. Create OAuth2 credentials (web application)
5. Add `http://localhost:8001/auth/google/callback` as authorized redirect URI
6. Copy client ID and secret to `backend/.env`

- [ ] **Step 2: Start the backend**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -m uvicorn main:app --port 8001`

- [ ] **Step 3: Test Google OAuth flow**

```bash
curl -s "http://localhost:8001/auth/google/url?user_id=<USER_ID>"
```

Expected: `{"url": "https://accounts.google.com/o/oauth2/auth?..."}`. Open this URL in a browser, sign in, and it should redirect back to the callback.

- [ ] **Step 4: Test calendar tool**

After connecting Google, ask an agent "What's on my calendar this week?" (with calendar permission granted). The agent should use the `list_calendar_events` tool.

- [ ] **Step 5: Test email tool**

Ask "Read my recent emails" or "Send an email to test@example.com saying hello". The agent should use Gmail tools.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Phase 5B complete — Google Calendar, Gmail, Contacts, Drive tools"
```
