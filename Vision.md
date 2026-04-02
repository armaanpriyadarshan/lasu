# Sudo — Vision Document

> **Status:** Living document. Some elements (subscription tiers, Twilio, voice integration) are subject to change as we build. This captures the product vision and architectural direction, not a locked spec.

---

## What is Sudo?

Sudo is a **consumer-facing, hosted multi-agent AI platform**. Think "OpenClaw as a Service" — users get persistent, autonomous AI agents that can act on their behalf, without ever touching a command line, managing API keys, or self-hosting anything.

The core insight: OpenClaw proved that personal AI agents with real autonomy are powerful, but its setup is prohibitively technical for everyday consumers. Sudo brings the same capabilities — persistent agents, autonomous action, tool use, inter-agent coordination — behind a polished mobile/web experience where everything just works.

---

## Core Principles

1. **Zero technical barrier** — No CLI, no API keys, no Docker. Users create agents from a dashboard and talk to them in a chat interface.
2. **Deny-by-default autonomy** — Agents start with no permissions and earn them through use. Users grant access inline, naturally, like mobile app permissions.
3. **Consumer-grade trust** — Sandboxed execution, spending safeguards, transparent permission management. Users always feel in control.
4. **Agents as employees** — Each agent is a distinct "employee" with a role, personality, and growing understanding of the user. Not a single chatbot — a team.

---

## Agent Model

### Creation
Users define agents **freeform** from the dashboard. There are no rigid templates — a user describes what they want the agent to do, gives it a name, and it's created. Examples:
- "An assistant that manages my calendar and reminds me about deadlines"
- "A research agent that tracks competitor pricing and sends me weekly summaries"
- "A personal shopper that finds deals on things I'm looking for"

### Persistence & Autonomy
Agents are **persistent**, modeled after OpenClaw's heartbeat system:
- Agents wake on a configurable interval (default ~30 minutes) to check for tasks, updates, or conditions they're monitoring
- If nothing needs attention, the agent stays silent (smart suppression — no unnecessary notifications)
- Active hours are configurable (e.g., 08:00–22:00) so agents don't wake users at 3am
- Heartbeat interval and persistence level are user-customizable to manage token usage — longer intervals = fewer tokens burned
- Agents can also be triggered on-demand by the user at any time via the chat interface

### Autonomy & Learning
Agents **learn user preferences over time** and stop asking about things the user has consistently approved. This is progressive trust:
- Early on, an agent asks before every action
- Over time, it recognizes patterns ("user always approves calendar invites for recurring team meetings") and acts autonomously within its granted permissions
- Users can always dial autonomy back via the permissions/settings screen

### Limits
- Users are generally limited to **~5 agents** (subject to change based on subscription tier)
- Each agent runs in its own **sandboxed container** on Sudo infrastructure — mandatory, since agents execute on our servers, not the user's machine

---

## Permissions System

### Philosophy: Deny-by-Default, Grant-on-Demand

Every permission starts as **denied**. Agents request access when they need it, surfaced as permission cards in the chat interface. This mirrors how mobile OS permissions work — users understand this pattern intuitively.

### Grant Modes
When an agent requests a permission, the user has two options:
- **One-time** — granted for this specific action only
- **Permanent** — granted until explicitly revoked by the user

### Permission Categories (Coarse-Grained)
Permissions are intentionally coarse to minimize friction:
- Calendar access
- Email access
- Web browsing / research
- SMS (send messages via shared Twilio number)
- Voice calls
- Contacts access
- Cloud file access

Agents can also request **custom/freeform permissions** for edge cases defined by the user's specific use case (e.g., "allowed to order food up to $30").

### Spending & Sensitive Actions
Anything involving **money or irreversible actions** has additional safeguards:
- Per-action approval above user-defined thresholds
- Explicit confirmation for financial transactions regardless of permission level
- Clear audit trail of what was done and what it cost

### Revocation
A **permissions summary screen** is accessible from each agent's profile/settings. Users can see everything an agent has access to and revoke any permission at any time.

### In the Chat Window
The chat interface includes a **permission carousel/chips** showing commonly needed permissions (calendar, email, web, etc.) for quick granting. This appears contextually — not as an overwhelming settings page, but as natural suggestions during conversation.

---

## Inter-Agent Communication

### Hub-and-Spoke Model
Agents communicate through a **central hub**, not directly peer-to-peer. This is simpler to build, easier to audit, and gives Sudo control over routing and security.

Flow:
1. Agent A determines it needs help from Agent B (e.g., research agent needs scheduling agent to book a meeting)
2. Agent A sends a request to the hub
3. Hub validates that Agent A holds the required permission for the action
4. Hub routes the request to Agent B
5. Agent B receives **one-time** permission inheritance for that specific task
6. Agent B completes the task and reports back through the hub

### Permission Inheritance Rules
- The **requesting agent must hold the permission** being delegated
- The receiving agent gets **one-time access only** — it does not permanently inherit permissions from other agents
- The hub enforces these rules, so agents cannot escalate their own privileges

---

## Communication Channels

### Primary: In-App Chat
Users interact with agents through a chat interface on the Sudo mobile app and web platform. Each agent has its own conversation thread.

### SMS (Subject to Change)
- Agents can reach out to users via SMS through a **shared company Twilio number**
- **Routing:** When a user replies to an SMS, context + message content determines which agent receives the reply. Users can also name an agent explicitly in their response (e.g., "Hey Atlas, ..."). If routing is ambiguous, the system asks for clarification.
- One number for all agents — like a company phone where different employees share a line

### Voice Calls (TBD)
- Vision includes agents making calls on behalf of users (e.g., restaurant reservations)
- Specific voice integration platform not yet decided (evaluating options like Vapi, Bland.ai, Retell, or Twilio Voice with LLM-powered conversation)
- This is a significant feature that will be scoped separately

---

## Architecture

### Stack
- **Frontend:** Expo / React Native (mobile-first, cross-platform)
- **Backend:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL) — shared DB with row-level security
- **Agent Runtime:** Sandboxed containers per agent (hosted on Sudo infrastructure)
- **LLM:** Sourced by Sudo — users never manage API keys (provider subject to change)
- **SMS:** Twilio (subject to change)
- **Voice:** TBD

### Database Design
**Shared database, agent-scoped records** with Supabase Row-Level Security (RLS):

```
users
  → agents (user_id FK, up to ~5 per user)
    → agent_messages (agent_id FK — conversation history)
    → agent_memory (agent_id FK — learned preferences, context, user patterns)
    → agent_permissions (agent_id FK — granted permissions with grant type)
    → agent_jobs (agent_id FK — heartbeat config, scheduled tasks, cron jobs)
  → inter_agent_messages (from_agent_id, to_agent_id — routed through hub)
```

RLS policies on every table ensure users can only access their own agents' data. No cross-user data leakage.

**Why shared DB over per-agent DB:**
- Operational simplicity (one DB to manage, migrate, monitor)
- Inter-agent queries are trivial (same DB, just different agent_id)
- User-level views, billing, and analytics are simple aggregations
- Scales naturally with RLS
- Per-agent DBs would be unsustainable at scale (1,000 users × 5 agents = 5,000 databases)

### Agent Execution
- Each agent runs in a **sandboxed container** — mandatory since execution happens on Sudo servers
- Containers are isolated per agent with restricted tool access based on granted permissions
- Heartbeat scheduler in the backend triggers agent containers on their configured intervals
- Agents that find nothing to do report back silently (smart suppression)

### Heartbeat & Scheduled Tasks (Modeled After OpenClaw)
- **Heartbeat:** Configurable interval (default ~30 minutes). Agent wakes, checks its task list and conditions, acts or stays silent.
- **Scheduled tasks:** Support for one-shot (at a specific time), recurring (fixed interval), and cron-expression-based scheduling
- **Cost optimization:**
  - Routine heartbeat checks can use smaller/cheaper models
  - Complex tasks use full-capability models
  - Users can scale heartbeat frequency up or down
  - Light-context mode for routine checks (skip loading full conversation history)
  - Timeout caps per job to prevent runaway token usage

### Agent Tools (Out of the Box)
Agents should ship with a rich set of tools comparable to OpenClaw's capabilities:
- **Web browsing & research** — autonomous internet research
- **Email** — read, compose, send (with permission)
- **Calendar** — read, create, modify events (with permission)
- **SMS** — send messages via shared Twilio number (with permission)
- **Voice calls** — make calls on user's behalf (TBD, with permission)
- **Cloud file access** — read/write cloud-stored files (with permission)
- **Contacts** — access user's contact list (with permission)
- **General autonomy** — agents can conduct their own research, chain actions, and make decisions within their permission boundaries

---

## Subscription Model (Subject to Change)

| | Free | Pro | Enterprise |
|---|---|---|---|
| Agents | 1 | ~5 | Custom |
| Usage | Lifetime cap (does not reset) | Monthly rate limit | Volume pricing |
| Heartbeat | Longer intervals / limited | Configurable | Fully custom |
| Tools | Basic (research, reminders) | Full suite (email, calls, etc.) | Full + custom integrations |
| Voice | None | Included | Priority |

The **non-resetting free tier** lets users genuinely try the product but naturally converts them when they hit the cap, without subsidizing perpetual free usage.

---

## Competitive Positioning

| | OpenClaw | Sudo |
|---|---|---|
| Setup | CLI wizard, Node.js, Docker | Download app, create account |
| Hosting | Self-hosted | Fully hosted by Sudo |
| API Keys | Bring your own | Provided by Sudo |
| Bot Setup | User creates via BotFather | Managed by Sudo |
| Agents | Single agent per workspace | Multiple agents per user |
| Target | Power users / developers | General consumers |
| Permissions | Config files + standing orders | In-chat permission cards |
| Cost to user | API key costs + compute | Subscription |

---

## Planned: Dynamic Tool Discovery & Expansion

Agents should not be limited to the tools Sudo ships with. A **dynamic capability system** allows agents to discover, install, and use new tools at runtime — expanding their abilities without platform redeployment.

**Vision:**
- **Tool marketplace/directory** — a registry of published tools (first-party and community) that agents can browse
- **Runtime tool loader** — agents can install and execute tools from the directory on demand, without a backend redeploy
- **Autonomous tool discovery** — when an agent encounters a task it can't handle with its current tools, it can search the marketplace for a relevant capability ("I need to book a restaurant... let me find a tool for that")
- **Sandboxed execution** — critical since agents would be running third-party code; each tool runs in an isolated environment
- **User approval** — installing a new tool requires user permission (fits the deny-by-default model)

This is analogous to OpenClaw's ClaWHub skills system, but consumer-friendly — users never see a CLI or config file, they just see "Atlas wants to install Restaurant Booking. Allow?"

---

## Planned: Headless Browser for Agents

Agents should be able to **control a full web browser** — navigating pages, clicking buttons, filling forms, taking screenshots, and interacting with JavaScript-heavy sites. This goes beyond simple HTTP fetching and enables agents to:

- Book reservations, submit forms, complete sign-ups on behalf of the user
- Interact with SPAs and dynamic web apps that require JavaScript
- Take screenshots of pages for visual context
- Log into websites (with user-provided credentials, permissioned)

**Implementation approach:**
- **Playwright** (Python) as the browser automation engine
- **Sandboxed container per browser session** — critical since agents are executing on Sudo infrastructure and browsing arbitrary URLs
- **Session management** — timeout caps, memory limits, screenshot storage
- **Permission gated** — requires explicit "web browsing" permission, distinct from simple "web search"

**Dependency:** Requires agent sandboxing infrastructure (Phase 8) before production deployment. Can be prototyped without sandboxing during development.

---

## Open Questions

- **Voice integration:** Which platform/approach for agent-initiated voice calls?
- **Subscription specifics:** Exact tier pricing, rate limits, and agent caps
- **SMS provider:** Twilio confirmed for now but subject to evaluation
- **LLM provider:** Which model(s) to source — cost vs capability tradeoffs at scale
- **Agent-to-agent trust:** How deep should inter-agent collaboration go? Can agents form persistent working relationships or is it always one-off task delegation?
- **Onboarding flow:** How do we guide users through creating their first agent in a way that feels magical, not overwhelming?
