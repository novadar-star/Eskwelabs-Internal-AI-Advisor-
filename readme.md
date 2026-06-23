# Eskwelabs Internal AI Advisor

An internal AI advisor platform for Eskwelabs EIF students. Provides access to three specialized AI advisors — each powered by configurable LLM models — through a clean, streaming chat interface.

> Built with Next.js 14, Supabase, NextAuth, and OpenRouter.

---

## Core Features

- **3 Specialized Advisors** — Data Dashboard, SSOT Memo, Data Modeling
- **Streaming Chat** — real-time AI responses with markdown rendering
- **Model Switcher** — admins can set the active LLM per advisor (fast / balanced / advanced)
- **Conversation History** — persisted per user, with search and advisor filter in the sidebar
- **Daily Usage Limits** — per-user message cap with a live progress indicator
- **Admin Dashboard** — view all conversations, usage stats, manage users and model configs
- **Google OAuth** — sign-in restricted to allow-listed Eskwelabs accounts
- **Dark / Light Mode** — system-aware theme toggle
- **Consent Modal** — first-run acknowledgment before chatting

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth v5 (Google OAuth) |
| Database | Supabase (PostgreSQL + RLS) |
| AI Providers | OpenRouter (OpenAI, Google, Anthropic) |
| Prompts | Google Docs (via Service Account) |
| Styling | Tailwind CSS + CSS variables |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/novadar-star/Eskwelabs-Internal-AI-Advisor-.git
cd Eskwelabs-Internal-AI-Advisor-
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the root with the following keys:

```env
# NextAuth
AUTH_SECRET=                        # Run: npx auth secret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

# AI (OpenRouter)
OPENROUTER_API_KEY=

# Google Service Account (reads advisor prompt docs)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

# Google Doc IDs (advisor system prompts)
ADVISOR_DATA_DASHBOARD_DOC_ID=
ADVISOR_SSOT_MEMO_DOC_ID=
ADVISOR_DATA_MODELING_DOC_ID=
DNA_DOC_ID=
```

### 3. Set up the database

Run the SQL files in order in the **Supabase SQL Editor**:

```
supabase/schema.sql                  # Base schema
supabase/migrate-advisor.sql         # Rename advisor_3 → data_modeling
supabase/migrate-model-switcher.sql  # Add multi-model support
```

### 4. Run locally

```bash
npm run dev
```

App runs at `http://localhost:3000`.

---

## User Roles

| Role | Access |
|---|---|
| `eif` | Chat with all advisors, view own conversations |
| `admin` | Everything above + Admin dashboard, model config, all user conversations |

Roles are assigned in the `profiles` table in Supabase.

---

## Project Structure

```
app/
  api/          # API routes (chat, conversations, models, admin)
  admin/        # Admin dashboard
  chat/         # Main chat shell
  login/        # Google OAuth sign-in page
components/
  chat/         # AdvisorPicker, ChatView, MessageList, Sidebar, ModelSelector, MarkdownRenderer
  ...           # ConsentModal, DarkModeToggle, ThemeProvider
lib/            # Auth, Supabase client, advisors, cost-guard, prompt-loader
supabase/       # Schema and migration SQL files
```

---

*Created by Darla and Cine — Eskwelabs AI Development Solutions Track.*