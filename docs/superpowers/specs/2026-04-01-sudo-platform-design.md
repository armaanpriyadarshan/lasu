# Sudo Platform — Full Implementation Design Spec

> **Date:** 2026-04-01
> **Status:** Approved — ready for implementation planning
> **Reference:** Vision.md (canonical product vision)

---

## Overview

Sudo is a consumer-facing, hosted multi-agent AI platform. This spec covers the full implementation from current state (~15% of Vision) to feature-complete product, organized as 8 vertical-slice phases.

**Current state:** Auth (phone + Telegram), basic dashboard with mock data, design system, SMS/Telegram webhooks, stateless single-agent LLM chat.

**End state:** Multi-agent platform with per-agent chat, persistent memory, deny-by-default permissions, autonomous heartbeat scheduling, tool integration, inter-agent hub-and-spoke communication, subscription billing, and production infrastructure.

---

## Phase 1: Multi-Agent Core

The foundation everything else builds on. Users can create named agents, chat with them individually in-app, and each agent maintains its own conversation history.

### Database

**New table: `agents`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Default gen_random_uuid() |
| user_id | UUID (FK → users.id) | Owner |
| name | TEXT | User-chosen name |
| description | TEXT | Freeform role description |
| system_prompt | TEXT | Generated from description, editable |
| model | TEXT | Default 'gpt-5.4', configurable later |
| is_active | BOOLEAN | Default true, false = soft deleted |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

**Modify table: `messages`**
- Add `agent_id` UUID (FK → agents.id), nullable for backward compat with existing SMS messages
- Add `channel` TEXT, default 'app' (enum: app, sms, telegram)

**Modify table: `users`**
- Add `subscription_tier` TEXT, default 'free' (enum: free, pro, enterprise)
- Add `usage_tokens` BIGINT, default 0 (cumulative, non-resetting for free tier)

### Backend Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /agents | Create agent (validate tier limit) |
| GET | /agents?user_id={id} | List user's agents |
| GET | /agents/{agent_id} | Get agent details |
| PATCH | /agents/{agent_id} | Update name/description/system_prompt |
| DELETE | /agents/{agent_id} | Soft delete (set is_active=false) |
| POST | /agents/{agent_id}/chat | Send message, get agent response |
| GET | /agents/{agent_id}/messages | Conversation history (paginated) |

**Agent refactor:**
- `agent.py` becomes agent-aware: loads the specific agent's system_prompt, fetches only that agent's message history from DB
- System prompt generated from user's freeform description at creation time (LLM reformats description into an effective system prompt)
- Each agent call scoped to its own conversation context

### Frontend

**Agent list screen** (accessible from dashboard/sidebar):
- Cards for each agent showing name, description, last active
- "Create Agent" button
- Tap agent → opens chat

**Agent creation flow:**
- Simple form: name + freeform description ("What should this agent do?")
- Submit → backend generates system_prompt from description → agent created
- User lands in new agent's chat

**Per-agent chat screen:**
- Conversation view with message bubbles
- Text input + send button
- Loads conversation history on mount
- Streams or displays agent responses

**Dashboard updates:**
- Real agent count replaces mock "Active channels" stat
- Activity feed pulls from real recent messages across agents

---

## Phase 2: Agent Memory & Learning

Agents remember things about the user across conversations and build context over time.

### Database

**New table: `agent_memory`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| agent_id | UUID (FK → agents.id) | |
| key | TEXT | Short label (e.g., "preferred_meeting_time") |
| value | TEXT | The learned fact |
| source | TEXT | 'extracted' (from conversation) or 'user_stated' |
| confidence | FLOAT | 0-1, how confident the extraction is |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Backend

- **Memory extraction:** After each conversation turn, run a lightweight LLM call that identifies facts/preferences worth remembering. Extract structured key-value pairs.
- **Memory injection:** Before each agent response, query relevant memories and inject them into the system prompt context.
- **Deduplication:** If a new extraction matches an existing key, update the value and bump confidence.
- `GET /agents/{agent_id}/memory` — list learned memories
- `DELETE /agents/{agent_id}/memory/{id}` — user can delete incorrect memories

### Frontend

- Memory tab on agent profile showing what the agent has learned
- Each memory item shows key, value, source, with a delete button
- Visual indicator in chat when agent references a memory ("I remember you prefer...")

---

## Phase 3: Permissions System

Deny-by-default. Agents request permissions inline. Users grant one-time or permanently. Revocable from settings.

### Database

**New table: `agent_permissions`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| agent_id | UUID (FK → agents.id) | |
| permission | TEXT | Category: calendar, email, web, sms, voice, contacts, files |
| grant_type | TEXT | 'one_time' or 'permanent' |
| granted_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ | Null if active |
| expires_at | TIMESTAMPTZ | Null for permanent, set for one-time (after use) |

**New table: `permission_requests`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| agent_id | UUID (FK → agents.id) | |
| permission | TEXT | What's being requested |
| reason | TEXT | Why the agent needs it |
| status | TEXT | pending, approved, denied |
| grant_type | TEXT | Null until approved, then one_time or permanent |
| created_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | |

### Backend

- **Permission check middleware:** Before any tool execution, check `agent_permissions` for an active grant. If missing, create a `permission_request` and return it to the frontend instead of executing.
- `POST /agents/{agent_id}/permissions/requests/{id}/grant` — body: `{grant_type: "one_time" | "permanent"}`
- `POST /agents/{agent_id}/permissions/{id}/revoke`
- `GET /agents/{agent_id}/permissions` — list all active permissions
- One-time permissions are marked expired after single use.

### Frontend

- **Permission request cards** appear inline in chat conversation when an agent needs access. Two buttons: "Allow once" / "Always allow"
- **Permission summary screen** accessible from agent profile — shows all granted permissions with revoke buttons
- **Quick-grant chips** in chat header for common permissions (contextual, not always shown)
- Spending-related permissions (purchases, financial) always require per-action confirmation regardless of grant level

---

## Phase 4: Heartbeat & Scheduling

Agents wake up autonomously on configurable intervals, check for things, act or stay silent.

### Database

**New table: `agent_jobs`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| agent_id | UUID (FK → agents.id) | |
| job_type | TEXT | heartbeat, one_shot, recurring, cron |
| schedule | TEXT | Interval in ms, ISO 8601 datetime, or cron expression |
| active_hours_start | TIME | Null = always active |
| active_hours_end | TIME | |
| last_run | TIMESTAMPTZ | |
| next_run | TIMESTAMPTZ | Calculated |
| enabled | BOOLEAN | Default true |
| config | JSONB | Model overrides, light_context flag, timeout |
| created_at | TIMESTAMPTZ | |

### Backend

- **Scheduler service:** Background process (APScheduler or equivalent) that polls `agent_jobs` for due jobs.
- **Heartbeat handler:** Loads agent context + memories, runs a "check-in" prompt asking the agent to review pending items. If nothing to report → suppress silently (no user notification). If something to report → create a message in the agent's chat and notify user.
- **Cost optimization:**
  - Heartbeat checks can use `light_context: true` (skip full conversation history, load only memories + recent messages)
  - Model overrides per job (cheaper model for routine checks)
  - Timeout cap per job (default 60s for heartbeats)
- `POST /agents/{agent_id}/jobs` — create scheduled task
- `GET /agents/{agent_id}/jobs` — list jobs
- `PATCH /agents/{agent_id}/jobs/{id}` — update interval, active hours, enable/disable
- `DELETE /agents/{agent_id}/jobs/{id}` — remove job

### Frontend

- Heartbeat config section on agent profile: toggle on/off, interval slider, active hours picker
- Notification badge when agent has something to report
- Job management screen (for power users / Pro tier)

---

## Phase 5: Tool Integration

Agents can perform real actions — browse the web, access calendar, send emails.

### Backend

- **Tool registry:** Each tool is a Python callable registered with a name, description, required permission, and execution function.
- **Permission enforcement:** Before executing any tool, check that the agent holds the required permission. If not, create a permission request.
- **OpenAI function calling:** Wire tools into the LLM's function calling interface so agents invoke them naturally.
- **Tools (built incrementally):**
  1. **Web research** — httpx-based web fetching + search API (e.g., Tavily, SerpAPI) for autonomous research
  2. **Calendar** — Google Calendar API integration (read events, create events, modify events)
  3. **Email** — Gmail API or equivalent (read inbox, compose, send)
  4. **Contacts** — Read user's contacts (requires OAuth for Google/Apple contacts)
  5. **Cloud files** — Google Drive / Dropbox integration (read, list, basic management)

### Frontend

- Tool activity visible in chat (e.g., collapsible "Searching the web..." cards with results)
- Spending confirmation dialogs for tools that involve money
- Tool status indicators on agent profile (which tools are available, which need permission)

---

## Phase 6: Inter-Agent Communication

Hub-and-spoke delegation. Agents can ask other agents to perform tasks.

### Database

**New table: `inter_agent_messages`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK → users.id) | Owner of both agents |
| from_agent_id | UUID (FK → agents.id) | Requesting agent |
| to_agent_id | UUID (FK → agents.id) | Receiving agent |
| message | TEXT | The delegation request |
| result | TEXT | Response from receiving agent |
| status | TEXT | pending, in_progress, completed, failed |
| created_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |

### Backend

- **Hub service:** Central router that:
  1. Receives delegation request from Agent A
  2. Validates Agent A holds the permission needed for the delegated action
  3. Grants Agent B one-time permission for that specific action
  4. Routes the request to Agent B
  5. Returns Agent B's result to Agent A
- `POST /agents/{agent_id}/delegate` — body: `{to_agent_id, message}`
- Hub ensures both agents belong to the same user
- One-time permission auto-expires after the delegated task completes

### Frontend

- Delegation activity visible in both agents' chat threads
- Visual indicator showing "Working on task from [Agent A]..." in Agent B's chat
- Delegation history viewable from agent profile

---

## Phase 7: Platform Polish

Complete the remaining app surfaces and business logic.

### Frontend Screens

- **Channels screen** — manage connected communication channels (app chat, future SMS/Telegram/email)
- **Settings screen** — user profile, subscription tier display, global preferences
- **Skills screen** — browse available tools, see which agents use which tools

### Dashboard

- Real data: actual agent count, real message stats, live activity feed from agent messages
- Quick actions: create agent, view recent agent activity

### Subscription & Billing

- Tier enforcement: agent count limits, rate limiting per tier, token budget tracking
- Free tier: 1 agent, lifetime-capped usage (non-resetting)
- Pro tier: ~5 agents, monthly rate limit, full tool access
- Enterprise: custom limits
- Integration with payment provider (Stripe or equivalent)

### Onboarding

- First-time user flow: guided agent creation after signup
- Contextual tips explaining permissions system

---

## Phase 8: Infrastructure & Hardening

Production readiness.

### Security

- **Supabase RLS policies** on all tables — users can only access their own agents and data
- **Input validation** on all endpoints
- **Rate limiting** per user per tier

### Agent Sandboxing

- Each agent executes tools in a sandboxed container
- Containers are isolated per agent with restricted capabilities
- Tool allowlists enforced at container level

### Testing

- **Backend:** pytest with test fixtures for each endpoint, agent logic, permission checks
- **Frontend:** Jest for component tests, integration tests for flows
- Test database with seed data

### CI/CD

- GitHub Actions pipeline: lint → test → build → deploy
- Staging environment for pre-production verification

### Monitoring

- Request logging and error tracking
- Agent job execution monitoring (heartbeat success/failure rates)
- Token usage tracking and alerting

---

## Testing & Monitoring Guide

### How to Test Each Phase

**Phase 1 (Multi-Agent Core):**
- Create multiple agents via API and UI
- Send messages to different agents, verify conversation isolation
- Verify agent count limits per tier
- Test soft delete and verify agent no longer appears
- Load test: multiple concurrent chat requests

**Phase 2 (Memory):**
- Have a conversation mentioning preferences, verify extraction
- Check memories appear in memory tab
- Delete a memory, verify agent no longer references it
- Test deduplication (mention same preference twice)

**Phase 3 (Permissions):**
- Trigger an action requiring permission, verify request card appears
- Grant one-time, verify it expires after use
- Grant permanent, verify persistence across sessions
- Revoke from settings, verify agent can no longer use the tool
- Test spending safeguards on financial actions

**Phase 4 (Heartbeat):**
- Enable heartbeat, verify agent wakes at configured interval
- Verify smart suppression (no notification when nothing to report)
- Test active hours constraints
- Verify cost tracking on heartbeat runs

**Phase 5 (Tools):**
- Test each tool individually with proper permissions
- Test tool execution without permission (should create request)
- Verify function calling integration with LLM
- Test error handling for failed tool executions

**Phase 6 (Inter-Agent):**
- Create two agents, delegate task from one to other
- Verify permission inheritance (one-time only)
- Verify both agents' chat threads show delegation activity
- Test delegation between agents with insufficient permissions (should fail)

**Phase 7 (Polish):**
- End-to-end user journey: signup → create agent → chat → grant permissions → see dashboard stats
- Subscription tier enforcement testing
- Verify all screens render correctly on mobile and desktop

**Phase 8 (Infrastructure):**
- RLS policy testing: attempt cross-user data access (must fail)
- Rate limit testing: exceed tier limits
- Load testing: concurrent users and agents
- Container isolation verification

### Monitoring Setup

- **Backend health:** `/health` endpoint monitored externally
- **Agent jobs:** Log every heartbeat run with duration, token count, outcome (suppressed vs reported)
- **Error tracking:** Structured logging on all endpoints, alert on elevated error rates
- **Token usage:** Per-user, per-agent token consumption tracked in DB, alerting on unusual spikes
- **Latency:** Track P50/P95/P99 response times for chat and tool endpoints
