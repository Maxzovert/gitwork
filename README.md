<div align="center">

<img src="public/logo.svg" alt="Gitwork" width="72" height="72" />

# Gitwork

**AI workspace for GitHub teams.**

Connect a repo once — then ask branch-aware questions, skim commit summaries, draft releases, review PR risk, and turn meeting audio into GitHub issues.

[Getting started](#getting-started) · [Features](#features) · [Contributing](./CONTRIBUTING.md) · [Docs](./docs)

<br />

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![tRPC](https://img.shields.io/badge/tRPC-2596BE?style=flat-square&logo=trpc&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_+_pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Auth0](https://img.shields.io/badge/Auth0-EB5424?style=flat-square&logo=auth0&logoColor=white)

</div>

---

## Features

| | Capability |
|---|---|
| **Codebase Q&A** | RAG over repo embeddings with file-grounded Gemini answers |
| **Branch-aware indexing** | Per-branch embeddings; auto-index when you switch branches |
| **Project overview** | Beginner-friendly brief, folder map, and setup guidance |
| **Commit timeline** | AI summaries of recent diffs; kept fresh via push webhooks |
| **Meetings → issues** | Upload audio → chapters → optional GitHub Issue export |
| **PR digests** | Open PRs, risk callouts, and what changed in the last 7 days |
| **Release drafting** | Compare refs → changelog → draft GitHub Release |
| **Team workspace** | Invite links, owner/member roles, shared project context |
| **Settings** | Notification prefs + AES-256-GCM encrypted token storage |

Sign in uses **Auth0 Universal Login**. Creating and indexing repos requires a one-time **Connect GitHub** step (Auth0 GitHub connection, or an optional encrypted PAT in Settings).

---

## Stack

```text
Frontend   Next.js 15 · React 19 · Tailwind CSS 4 · GSAP
API        tRPC · TanStack Query
Auth       Auth0 (Universal Login + GitHub connection)
Data       PostgreSQL · Prisma · pgvector
AI         Google Gemini
Meetings   Cloudinary · AssemblyAI
GitHub     Octokit
```

---

## App map

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/sign-in`, `/sign-up` | Auth0 Universal Login |
| `/create` | Connect GitHub → pick repo → index |
| `/dashboard` | Project home + commits |
| `/overview` | Generated repo briefing |
| `/qa` | Codebase Q&A |
| `/meetings` | Meeting uploads & chapters |
| `/pr-digests` | PR review digests |
| `/releases` | Changelog & draft releases |
| `/team` | Members & invites |
| `/settings` | Notifications & tokens |

---

## Getting started

### Prerequisites

- Node.js **20+** and npm
- PostgreSQL with the **`vector`** extension (Docker via `./start-database.sh`, or Neon)
- Auth0 Regular Web App (+ GitHub social connection with `repo` scope)
- Gemini, AssemblyAI, and Cloudinary credentials

### Install

```bash
git clone https://github.com/Maxzovert/gitwork.git
cd gitwork
npm install
cp .env.example .env   # fill in secrets
```

### Database

```bash
./start-database.sh    # optional local Postgres
npm run db:push        # or: npm run db:migrate
```

### Dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Copy `.env.example` → `.env`. Key variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` / `DIRECT_URL` | Yes | Postgres (+ Prisma direct URL) |
| `AUTH0_*` / `APP_BASE_URL` | Yes | Auth0 tenant & callbacks |
| `GEMINI_API_KEY` | Yes | Q&A, summaries, digests, releases |
| `ASSEMBLY_API_KEY` | Meetings | Transcription |
| `NEXT_PUBLIC_CLOUDINARY_*` | Meetings | Audio uploads |
| `APP_URL` | Webhooks | Public origin (ngrok in local dev) |
| `TOKEN_ENCRYPTION_KEY` | Settings tokens | AES-256-GCM key (`openssl rand -hex 32`) |
| `GITHUB_TOKEN` | Optional | Server PAT fallback for local/dev |

Full notes live in [`.env.example`](./.env.example) and [`docs/`](./docs).

---

## How it works

```text
Authorize GitHub (once)
        ↓
Create project → pick repo + branch
        ↓
Index source → embeddings (pgvector)
        ↓
┌────────────┬────────────┬─────────────┬─────────────┐
│ Q&A + map  │ Commits +  │ Meetings →  │ PR + release│
│ (branch)   │ webhooks   │ issues      │ workflows   │
└────────────┴────────────┴─────────────┴─────────────┘
```

---

## Project structure

```text
src/
  app/           # Routes (landing, auth, protected surfaces)
  components/    # UI, onboarding, shell
  lib/           # GitHub, Gemini, Assembly, Cloudinary, crypto
  server/api/    # tRPC routers + access control
prisma/          # Schema + migrations
docs/            # Roadmap & feature specs
public/          # Static assets & landing media
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Production build & serve |
| `npm run check` | Lint + TypeScript |
| `npm run db:push` | Push Prisma schema |
| `npm run db:migrate` | Deploy migrations |
| `npm run db:studio` | Prisma Studio |

---

## Deploy

1. Set the same env vars as local on your host (Auth0, DB, Gemini, Assembly, Cloudinary, `APP_URL`, `TOKEN_ENCRYPTION_KEY`).
2. Update Auth0 + GitHub OAuth callback / homepage URLs for production.
3. Prefer **GitHub Actions → Vercel prebuilt** if the Vercel builder OOMs — see [`.github/workflows/deploy-vercel.yml`](./.github/workflows/deploy-vercel.yml).

Neon tip: pooler URL + `pgbouncer=true` as `DATABASE_URL`; non-pooler host as `DIRECT_URL`.

---

## Docs & roadmap

- [Contributing guide](./CONTRIBUTING.md)
- [Product roadmap](./docs/roadmap.md)
- [PR digest spec](./docs/pr-review-digests.md)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't create / index | Connect GitHub with `repo` scope in Auth0 |
| Google login, no repos | Authorize GitHub on `/create` (separate from sign-in) |
| Webhooks silent | Public `APP_URL` (ngrok locally) |
| Meetings fail | Check Cloudinary + `ASSEMBLY_API_KEY` |
| Q&A / digests empty | Check `GEMINI_API_KEY`, GitHub auth, indexing status |
| Token save fails | Stable `TOKEN_ENCRYPTION_KEY` (rotating it breaks old ciphertext) |
| Vercel OOM | Use Actions prebuilt deploy, Railway, or Docker |

---

## License

Private project (`0.1.0`). Update this section if you open-source the repo.
