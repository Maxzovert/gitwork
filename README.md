# Gitwork

AI workspace for GitHub teams. Connect a repository once, then ask branch-aware codebase questions, generate a beginner-friendly project overview, skim AI commit summaries, turn meeting audio into GitHub issues, review PR risk, and draft releases — all in one place.

## Features

| Feature | What it does |
|---------|----------------|
| **Codebase Q&A** | Indexes repo files into embeddings and answers with file-grounded context (RAG + Gemini) |
| **Branch-aware indexing** | Switches repository branches, keeps embeddings isolated by branch, and automatically indexes missing branch context |
| **Project overview** | Generates a plain-language repository brief, folder map, setup guidance, and recommended starting files |
| **Commit timeline** | Pulls recent commits, summarizes diffs in plain language, and stays current through GitHub push webhooks |
| **Meetings → issues** | Uploads meeting audio (Cloudinary + AssemblyAI), creates chapter-style issue drafts, and can publish them to GitHub |
| **PR / review digests** | On-demand digest of open PRs, risk areas, and what changed in the last 7 days |
| **Release drafting** | Compares Git tags or an active branch, generates editable changelog notes, and creates draft GitHub Releases |
| **Team workspace** | Invite links, owner/member roles, shared project context |
| **Account settings** | Notification preferences plus AES-256-GCM encrypted API-token storage with a GitHub PAT fallback |
| **GitHub access** | Authorize once via Auth0 GitHub connection, or optionally store a personal access token encrypted as a fallback |

Sign in uses **Auth0 Universal Login** (Google and other connections you enable in Auth0). Creating and indexing repos still requires a one-time **Connect GitHub** step so Gitwork can read repositories. If Auth0 GitHub OAuth is unavailable, users can optionally store an encrypted GitHub PAT in Settings.

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4, GSAP
- **API:** tRPC + TanStack Query
- **Auth:** Auth0 (Universal Login + GitHub connection for repo access)
- **Database:** PostgreSQL + Prisma + `pgvector` embeddings
- **AI:** Google Gemini (summaries, Q&A, digests)
- **Meetings:** Cloudinary (upload) + AssemblyAI (transcription)
- **GitHub:** Octokit (repos, commits, PRs, webhooks)

## App routes

| Path | Purpose |
|------|---------|
| `/` | Landing page |
| `/sign-in`, `/sign-up` | Redirect into Auth0 Universal Login |
| `/auth/*` | Auth0 SDK routes (login, callback, logout, profile) |
| `/sync-user` | Sync Auth0 user into the database |
| `/create` | Guided project onboarding (Connect GitHub → pick repo → index) |
| `/dashboard` | Project home + commit log |
| `/overview` | Generated beginner briefing and repository map |
| `/qa` | Codebase Q&A history |
| `/meetings`, `/meetings/[id]` | Meeting uploads and issue chapters |
| `/pr-digests` | PR review digests |
| `/releases` | Changelog generation and draft GitHub Releases |
| `/team` | Members + invite links |
| `/settings` | Notifications and encrypted API tokens |
| `/invite/[token]` | Accept a project invite |

## Getting started

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL with the `vector` extension (local Docker via `start-database.sh`, or Neon / similar)
- Auth0 Regular Web Application (+ GitHub social connection with `repo` scope)
- Gemini API key
- AssemblyAI API key
- Cloudinary account (for meeting audio uploads)

### 1. Clone and install

```bash
git clone https://github.com/Maxzovert/gitwork.git
cd gitwork
npm install
```

### 2. Environment variables

Copy `.env.example` → `.env` and fill in values:

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (with `vector` support) |
| `DIRECT_URL` | Yes (Prisma) | Direct DB URL for migrate/push (same as `DATABASE_URL` locally) |
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Yes | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | Yes | Auth0 application client secret |
| `AUTH0_SECRET` | Yes | Random secret for session encryption (`openssl rand -hex 32`) |
| `APP_BASE_URL` | Yes (local/prod) | App origin for Auth0 callbacks (e.g. `http://localhost:3000`) |
| `GEMINI_API_KEY` | Yes | Code Q&A, commit summaries, PR digests |
| `ASSEMBLY_API_KEY` | Yes | Meeting transcription |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Yes (meetings) | Audio uploads |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Yes (meetings) | Unsigned upload preset |
| `NEXT_PUBLIC_CLOUDINARY_FOLDER` | Optional | e.g. `gitwork` |
| `APP_URL` | Yes for webhooks | Public app URL (`http://localhost:3000` locally; use ngrok in dev for webhooks) |
| `GITHUB_TOKEN` | Optional | Server-side PAT fallback for local/dev only |
| `TOKEN_ENCRYPTION_KEY` | Required for stored tokens | 32-byte key or 64-character hex key used for AES-256-GCM encryption |
| `SKIP_ENV_VALIDATION` | Optional | Set to skip `@t3-oss/env` validation (Docker/CI) |

AI keys stay on the server (not per-user). GitHub access prefers **Auth0 GitHub connection**, not a shared PAT.

### 3. Database

```bash
# Optional: start local Postgres (Docker)
./start-database.sh

# Push schema (includes pgvector embeddings)
npm run db:push

# Or use migrations in shared environments
npm run db:migrate
```

Open Prisma Studio with `npm run db:studio`.

### 4. Run locally

```bash
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

### Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build (raised Node heap for large builds) |
| `npm run start` | Start production server |
| `npm run check` | Lint + TypeScript |
| `npm run db:push` | Push Prisma schema |
| `npm run db:migrate` | Deploy migrations |
| `npm run db:studio` | Prisma Studio |

## GitHub OAuth setup (required for create / index / commits / digests)

Users authorize GitHub **once** via Auth0’s GitHub connection. Tokens are **not** stored in your database (except optional encrypted PATs in Settings).

### Enable GitHub in Auth0

1. Open [Auth0 Dashboard → Authentication → Social](https://manage.auth0.com/#/connections/social).
2. Enable **GitHub** and turn it on for your Application.
3. Create a [GitHub OAuth App](https://github.com/settings/applications/new):
   - **Homepage URL:** your app URL (e.g. `http://localhost:3000`)
   - **Authorization callback URL (critical):** `https://YOUR_AUTH0_DOMAIN/login/callback`  
     Example: `https://dev-xxxxx.us.auth0.com/login/callback`  
     Do **not** use `http://localhost:3000/auth/callback` here — that causes a 404 / broken redirect after GitHub.
4. Paste **Client ID** and **Client Secret** into Auth0’s GitHub connection.
5. In Auth0 GitHub permissions/scopes, include: `repo` (for private repos / webhooks).
6. In your Auth0 **Application** settings, Allowed Callback URLs must include:  
   `http://localhost:3000/auth/callback` (and your production URL’s `/auth/callback`).

Also enable **Google** (or other connections) if you want non-GitHub login. Users who sign in with Google still click **Connect GitHub** on `/create` to authorize repo access (`/auth/login?connection=github`).

### User connect / link flow

| User state | What happens |
|------------|----------------|
| New user on `/create` | **Connect GitHub** → Auth0 login with `connection=github` |
| Signed in with Google / email only | Same button starts Auth0 GitHub connection |
| Already connected | Status shows connected; user picks a repo and continues |

Server-side, Gitwork loads the token with Auth0 `getAccessTokenForConnection({ connection: "github" })` for the current session user and uses it for indexing, commits, PR digests, releases, issues, and webhooks. The token is never returned to the client. An encrypted per-user GitHub PAT from `/settings` is used as a preferred fallback (and for owner tokens on shared projects).

## How the product works

```text
Authorize GitHub (once)
        ↓
Create project → pick repo + branch
        ↓
Index source files → embeddings (pgvector)
        ↓
┌──────────────┬──────────────┬───────────────┬─────────────┐
│ Q&A + map    │ Commit sync  │ Meeting audio │ PR + release│
│ (branch RAG) │ + webhooks   │ → issues      │ workflows   │
└──────────────┴──────────────┴───────────────┴─────────────┘
```

- **Indexing:** loads a capped set of source files from the selected branch, summarizes + embeds them.
- **Q&A:** retrieves relevant chunks from the selected branch, streams a Gemini answer with file references, and saves answers per project.
- **Overview:** combines repository docs, an embedding-derived folder sketch, and recent context into a saved onboarding brief.
- **Commits:** backfill on create; webhook keeps the timeline updated when configured (`APP_URL` must be publicly reachable).
- **Meetings:** upload audio → AssemblyAI → structured chapters that can be published as GitHub Issues.
- **PR digests:** live GitHub data + AI summary / risk callouts. Spec: [README-pr-review-digests.md](./README-pr-review-digests.md).
- **Releases:** compare Git refs → Gemini changelog → editable draft → draft GitHub Release.
- **Settings:** stores notification preferences and encrypts user-supplied API tokens before persistence.

## Project structure (high level)

```text
src/
  app/                 # Next.js routes (landing, auth, protected pages)
  components/          # UI + onboarding
  lib/                 # GitHub, Gemini, Assembly, Cloudinary, auth helpers
  server/api/          # tRPC routers + project access
prisma/
  schema.prisma        # Users, projects, embeddings, commits, meetings, invites
```

## Deploy

### Environment on the host

Set the same variables as local (Auth0, `DATABASE_URL`, `DIRECT_URL`, Gemini, Assembly, Cloudinary, `APP_URL`, and `TOKEN_ENCRYPTION_KEY` when stored tokens are enabled).
`GITHUB_TOKEN` is optional if every user connects GitHub OAuth.

Update Auth0 + GitHub OAuth **callback / homepage URLs** for production. Point `APP_URL` / `APP_BASE_URL` at your public URL so Auth0 and webhooks work.

### Option A — Vercel (direct)

1. Import the GitHub repo in Vercel  
2. Add all env vars (Production + Preview)  
3. Deploy  

If the Vercel builder runs out of memory, prefer Option B, Railway, or Docker.

### Option B — GitHub Actions → Vercel prebuilt (recommended if OOM)

Builds run on **GitHub Actions** (~7 GB RAM), then upload a prebuilt artifact to Vercel. Use this when Vercel’s own builder OOM-retries.

[`vercel.json`](./vercel.json) sets `"git.deploymentEnabled": false` so Vercel does **not** rebuild from Git. The workflow is [`.github/workflows/deploy-vercel.yml`](./.github/workflows/deploy-vercel.yml).

#### One-time setup

1. **Link the project locally** (creates `.vercel/project.json`; do not commit it):

   ```bash
   npx vercel link
   ```

   Open `.vercel/project.json` and copy `orgId` → `VERCEL_ORG_ID`, `projectId` → `VERCEL_PROJECT_ID`.

2. **Create a Vercel token** at [vercel.com/account/tokens](https://vercel.com/account/tokens).

3. **Add GitHub Actions secrets** (`Settings → Secrets and variables → Actions`):

   | Secret | Value |
   |--------|--------|
   | `VERCEL_TOKEN` | Token from step 2 |
   | `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
   | `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |

4. **Set app env vars on the Vercel project** (Production): same as local — `DATABASE_URL`, `DIRECT_URL`, Auth0 keys (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `APP_BASE_URL`), `GEMINI_API_KEY`, `ASSEMBLY_API_KEY`, Cloudinary `NEXT_PUBLIC_*`, `APP_URL` (your production URL). For Neon, use the pooler URL with `pgbouncer=true` as `DATABASE_URL` and the non-pooler host as `DIRECT_URL`. Ensure Postgres has `pgvector`; run `npm run db:push` against prod once.

5. **Push to `main`** (or run **Deploy to Vercel** via Actions → Run workflow). The job logs print the production URL.

### Option C — Railway / Render / Docker

Any Node host that can run `npm run build` + `npm run start` works. Docker helps when you want a fixed image and more build RAM than Vercel hobby builders:

1. Build the image on a machine with enough memory  
2. Run the container with env vars  
3. Set `APP_URL` to the public hostname  

## Roadmap

Shipped capabilities and upcoming priorities live in [feature.md](./feature.md) (incremental indexing, metering, multi-turn Q&A, architecture maps, Slack digests, etc.).

PR digest product spec: [README-pr-review-digests.md](./README-pr-review-digests.md).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can’t create / index a project | Connect GitHub with `repo` scope in Auth0 (custom OAuth app) |
| Google login but no repos | Authorize GitHub on `/create` (linking is separate from sign-in) |
| Branches / private repo 404 | Re-authorize GitHub; confirm `repo` scope |
| Webhooks not firing | Set public `APP_URL` (ngrok in local dev); check webhook registration on the repo |
| Meeting upload fails | Configure Cloudinary `NEXT_PUBLIC_*` vars |
| Transcription fails | Check `ASSEMBLY_API_KEY` |
| Q&A / digests / release notes empty or erroring | Check `GEMINI_API_KEY`, GitHub authorization, and indexing status |
| Saving an API token fails | Configure a stable `TOKEN_ENCRYPTION_KEY`; changing it makes existing encrypted tokens unreadable |
| Vercel build retries / OOM | Raise `NODE_OPTIONS`, use Actions prebuilt deploy, Railway, or Docker |

## License

Private project (`0.1.0`). Update this section if you open-source the repo.
