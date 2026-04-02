# Sudo — Handoff & Next Steps

> **Date:** 2026-04-02
> **Last session:** Phase 1-5A implementation + Phase 5B planned
> **For:** Any agent or team member picking this up

---

## Where We Are

Sudo is a consumer-facing hosted multi-agent AI platform ("OpenClaw as a Service"). We've built Phases 1-5A of the platform design spec. Here's what's working:

### What's Built & Functional

| Phase | Feature | Status |
|---|---|---|
| **Phase 1** | Multi-agent core — create agents, per-agent chat, conversation history | Working |
| **Phase 2** | Agent memory — LLM extracts facts from conversations, injects into prompt context, viewable/deletable from UI | Working |
| **Phase 3** | Permissions — deny-by-default, in-chat permission request cards (Allow once / Always allow / Deny), permissions panel with revoke | Working |
| **Phase 4** | Heartbeat & scheduling — background scheduler, agents wake on interval, smart suppression, Live/Idle toggle in UI | Working |
| **Phase 5A** | Tool framework — tool registry, OpenAI function calling loop, permission enforcement before tool execution, web search (Tavily) + web fetch | Working |

### What's Planned (not built)

| Phase | Feature | Plan exists? |
|---|---|---|
| **Phase 5B** | Google tools — Calendar, Gmail, Contacts, Drive (requires Google OAuth) | Yes: `docs/superpowers/plans/2026-04-02-phase5b-google-tools.md` |
| **Phase 6** | Inter-agent communication — hub-and-spoke delegation | Spec only |
| **Phase 7** | Platform polish — remaining screens, billing, onboarding | Spec only |
| **Phase 8** | Infrastructure — RLS, sandboxing, testing, CI/CD | Spec only |
| **Future** | Dynamic tool/skills marketplace, headless browser, code execution | Vision only |

### Key Files

| File | Purpose |
|---|---|
| `Vision.md` | Canonical product vision — read this first |
| `docs/superpowers/specs/2026-04-01-sudo-platform-design.md` | Full 8-phase design spec |
| `docs/superpowers/plans/` | Implementation plans for each phase |
| `backend/` | FastAPI backend (Python) |
| `src/` | Expo/React Native frontend (TypeScript) |
| `backend/.env` | API keys (OpenAI, Supabase, Tavily) |
| `.env` | Frontend Supabase credentials |

### Architecture

- **Frontend:** Expo 55 / React Native / Expo Router (file-based routing)
- **Backend:** FastAPI (Python), runs on port 8001 (not 8000 — zombie process issue)
- **Database:** Supabase (project ID: `imvbbxblyegwmkfdzxmb`)
- **LLM:** OpenAI GPT-5.4 for chat, GPT-4o-mini for memory extraction and heartbeats
- **Auth:** Supabase Auth (email + Google) — partner (Armaan) rewrote from Twilio/Telegram
- **Search:** Tavily API for web research

### DB Tables

| Table | Purpose |
|---|---|
| `users` | User accounts (subscription_tier, usage_tokens) |
| `agents` | User-created agents (name, description, system_prompt, model) |
| `messages` | Chat history (scoped per agent via agent_id) |
| `agent_memory` | Learned facts per agent (key-value, upsert on conflict) |
| `agent_permissions` | Granted permissions (permanent or one-time, revocable) |
| `permission_requests` | Pending permission requests (approve/deny) |
| `agent_jobs` | Heartbeat/scheduled jobs per agent |

### Known Issues

- **Port 8000 zombies:** Old python processes sometimes hold port 8000. Backend runs on 8001 (`src/lib/api.ts` points to 8001).
- **Memory redundancy:** Fixed — extractor now receives existing memories to avoid duplicates. But some older duplicates may exist in DB.
- **No tests:** No test suite exists. All verification has been manual.
- **No RLS policies:** Supabase RLS is enabled on tables but no policies are written. Currently using service role key (bypasses RLS).

---

## Actionable Next Steps (Priority Order)

### 1. Phase 5B: Google Tools (highest priority)

**Plan:** `docs/superpowers/plans/2026-04-02-phase5b-google-tools.md`

**Prerequisites before starting:**
- Set up Google Cloud project with OAuth2 credentials
- Enable Calendar, Gmail, People, and Drive APIs
- Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` to `backend/.env`

**What it delivers:** Calendar (list/create events), Email (read/send), Contacts (list/search), Drive (list/read files). Shared Google OAuth flow — user connects once, all tools work.

**Estimated tasks:** 10 tasks, subagent-driven execution recommended.

### 2. Code Execution Tool

**Not yet planned — needs a plan written.**

Add a sandboxed Python execution tool so agents can run code (calculations, data analysis, chart generation). Similar to ChatGPT's Code Interpreter.

**Approach options:**
- **Simple:** Use `exec` with a Python subprocess + timeout (no real sandboxing, dev only)
- **Proper:** Docker container per execution with resource limits
- **Third-party:** Use a code execution API (e.g., E2B, Modal)

### 3. Image Generation Tool

**Not yet planned — needs a plan written.**

Add image generation via OpenAI DALL-E or similar. Register as a tool in the existing registry with `media` permission.

### 4. Phase 6: Inter-Agent Communication

**Spec exists:** `docs/superpowers/specs/2026-04-01-sudo-platform-design.md` (Phase 6 section)
**Plan needed.**

Hub-and-spoke delegation — agents can ask other agents to perform tasks. Requesting agent must hold the required permission, receiving agent gets one-time access.

### 5. Skills/Marketplace System

**Vision exists in `Vision.md` under "Planned: Dynamic Tool Discovery & Expansion".**
**Needs full spec + plan.**

This is the big differentiator. Skills are just `SKILL.md` prompt files that teach agents how to combine base tools. The marketplace lets agents discover and install new skills autonomously (with user approval). OpenClaw's ClaWHub has 13,700+ MIT-licensed skills that could be adapted.

### 6. Headless Browser

**Vision exists in `Vision.md` under "Planned: Headless Browser for Agents".**
**Depends on:** Agent sandboxing (Phase 8).

Playwright-based full browser automation. Enables form filling, reservations, web app interaction.

### 7. Phase 7-8: Polish & Infrastructure

- Remaining UI screens (channels, settings, skills)
- Real dashboard data
- Subscription billing (Stripe)
- Supabase RLS policies
- Agent sandboxing (Docker containers)
- Test suite (pytest + Jest)
- CI/CD pipeline

---

## How to Run

**Backend:**
```bash
cd backend
python -m uvicorn main:app --port 8001
```

**Frontend:**
```bash
npx expo start --web
```

**Required env vars (backend/.env):**
```
SUPABASE_URL=https://imvbbxblyegwmkfdzxmb.supabase.co/
SUPABASE_SERVICE_ROLE_KEY=<key>
OPENAI_API_KEY=<key>
TAVILY_API_KEY=<key>
```

**Required env vars (.env in project root):**
```
EXPO_PUBLIC_SUPABASE_URL=https://imvbbxblyegwmkfdzxmb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<key>
```

---

## Execution Pattern

All phases have used **subagent-driven development**:
1. Write implementation plan to `docs/superpowers/plans/`
2. Create tasks
3. DB migrations via Supabase MCP
4. Dispatch backend subagent for code tasks (db.py, new modules, main.py)
5. Dispatch frontend subagent in parallel (api.ts, UI screens)
6. Verify and commit

Plans exist for Phases 1-5B. Phase 6+ needs plans written from the design spec.
