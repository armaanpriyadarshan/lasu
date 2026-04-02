# Sudo — Next Steps

> **Date:** 2026-04-02
> **Focus:** Fully fleshing out agent capabilities to do almost anything a human could

---

## What's Built (as of today)

- Multi-agent core (create, chat, manage agents)
- Agent memory (extract, learn, inject preferences)
- Permissions (deny-by-default, in-chat grant/revoke)
- Heartbeat scheduling (autonomous wake-ups with tool access)
- Tool framework (registry, OpenAI function calling, permission enforcement)
- Web search (Brave Search API)
- Google tools (Calendar, Gmail, Contacts, Drive read/write/create docs)
- Google OAuth flow with seamless retry UX
- Structured prompt system (identity, soul, operations, user context, runtime)

---

## Ethan's Focus: Agent Capabilities

### Priority 1: Core Human Capabilities

**Code Execution (sandboxed Python)**
- Let agents run calculations, data analysis, generate charts
- Approach: Docker container per execution or third-party (E2B, Modal)
- Permission: `code`

**Image Generation**
- Generate images via OpenAI DALL-E or similar
- Register as tool with `media` permission
- Simple — one API call, returns URL

**Image/Vision Analysis**
- Let agents analyze images users upload or from URLs
- Use OpenAI vision API (GPT-5.4 supports images)
- Permission: `media`

**PDF Analysis**
- Extract and summarize PDF content
- Use PyPDF2 or similar for extraction, LLM for summarization
- Permission: `files`

### Priority 2: Communication & Automation

**Multi-platform Messaging**
- Slack (send/read messages via Slack API)
- Discord (bot integration)
- WhatsApp (Twilio or Meta Business API)
- Each gets its own OAuth flow + tools
- Permission: `messaging`

**SMS & Voice Calls (Twilio)**
- Send SMS, make calls on behalf of user
- Partially built (Twilio code exists from original codebase)
- Permission: `sms`, `voice`

**Third-party App Automation (Zapier/Webhooks)**
- Let agents trigger Zapier workflows or custom webhooks
- Covers 5000+ app integrations without building each one
- Permission: `integrations`

### Priority 3: Browser & Advanced

**Headless Browser (Playwright)**
- Full Chromium automation — navigate, click, fill forms, screenshot
- Enables: booking reservations, filling forms, web app interaction
- Requires sandboxing (Docker) for security
- Permission: `browser`

**Location/Maps**
- Google Maps API — find places, get directions, nearby search
- Permission: `location`

**Translation**
- Real-time text translation via Google Translate or DeepL API
- Can piggyback on `web` permission (no new OAuth needed)

**X/Twitter Search**
- Search posts, trending topics
- Requires Twitter API key
- Permission: `web`

### Priority 4: Skills & Dynamic Expansion

**Skills Marketplace**
- Skills are just SKILL.md prompt files that teach agents how to combine tools
- Build marketplace where agents can discover and install skills
- Fork best MIT-licensed skills from ClaWHub (13,700+) as starter pack
- Consumer-friendly: "Atlas wants to install Restaurant Booking. Allow?"

**Dynamic Tool Registration**
- Runtime tool loader — add new tools without backend redeploy
- Third-party tool sandboxing
- User approval for new tool installations

---

## Armaan's Focus: Memory Optimization

### Memory Extraction Quality
- Reduce redundant/low-value memories
- Better key normalization (avoid `likes_tacos` vs `food_preference_tacos`)
- Confidence scoring — higher confidence for explicit statements, lower for inferences
- Conflict resolution — when user contradicts a memory, update don't duplicate

### Memory Architecture
- Separate **facts** (name, job, preferences) from **instructions** (recurring tasks, standing orders)
- Standing instructions should be first-class — not just memories the heartbeat hopes to find
- Memory categories: personal, work, preferences, instructions, relationships

### Memory Performance
- Limit memory injection to relevant memories (not all 50+ dumped into prompt)
- Semantic search over memories — only inject memories relevant to the current conversation
- Memory expiry — some facts become stale (e.g., "working on project X" from 3 months ago)

### Cross-Agent Memory
- Shared user profile across all agents (name, timezone, communication style)
- Agent-specific memories stay scoped (Marco knows email preferences, Atlas knows research preferences)
- User profile vs agent memory distinction

---

## Infrastructure (Both)

- Supabase RLS policies (security — users can only see their own data)
- Test suite (pytest + Jest)
- CI/CD pipeline
- Production deployment
- Agent sandboxing (Docker containers per agent)
- Rate limiting per subscription tier
