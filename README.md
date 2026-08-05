# Gitwork

AI workspace for GitHub teams. Connect a repository once, then ask the codebase questions, skim AI commit summaries, turn meeting audio into issue drafts, and generate PR review digests — all in one place.

## Features

| Feature | What it does |
|---------|----------------|
| **Codebase Q&A** | Indexes repo files into embeddings and answers with file-grounded context (RAG + Gemini) |
| **Commit timeline** | Pulls recent commits, summarizes diffs in plain language, optional live sync via GitHub webhooks |
| **Meetings → issues** | Upload meeting audio (Cloudinary + AssemblyAI), get chapter-style issue drafts |
| **PR / review digests** | On-demand digest of open PRs, risk areas, and what changed in the last 7 days |
| **Team workspace** | Invite links, owner/member roles, shared project context |
| **GitHub OAuth** | Authorize once via Clerk — no personal access tokens pasted or stored in the DB |

Sign in can use **Google** (or other Clerk providers). Creating and indexing repos still requires a one-time **Connect GitHub** step so Gitwork can read repositories.

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4, GSAP
- **API:** tRPC + TanStack Query
- **Auth:** Clerk (Google sign-in + GitHub OAuth for repo access)
- **Database:** PostgreSQL + Prisma + `pgvector` embeddings
- **AI:** Google Gemini (summaries, Q&A, digests)
- **Meetings:** Cloudinary (upload) + AssemblyAI (transcription)
- **GitHub:** Octokit (repos, commits, PRs, webhooks)

## App routes

| Path | Purpose |
|------|---------|
| `/` | Landing page |
| `/sign-in`, `/sign-up` | Clerk auth |
| `/sync-user` | Sync Clerk user into the database |
| `/create` | Guided project onboarding (Connect GitHub → pick repo → index) |
| `/dashboard` | Project home + commit log |
| `/qa` | Codebase Q&A history |
| `/meetings`, `/meetings/[id]` | Meeting uploads and issue chapters |
| `/pr-digests` | PR review digests |
| `/team` | Members + invite links |
| `/invite/[token]` | Accept a project invite |

## Getting started

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL with the `vector` extension (local Docker via `start-database.sh`, or Neon / similar)
- Clerk application
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
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | Usually `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | Usually `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL` | Recommended | `/sync-user` |
| `GEMINI_API_KEY` | Yes | Code Q&A, commit summaries, PR digests |
| `ASSEMBLY_API_KEY` | Yes | Meeting transcription |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Yes (meetings) | Audio uploads |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Yes (meetings) | Unsigned upload preset |
| `NEXT_PUBLIC_CLOUDINARY_FOLDER` | Optional | e.g. `gitwork` |
| `APP_URL` | Yes for webhooks | Public app URL (`http://localhost:3000` locally; use ngrok in dev for webhooks) |
| `GITHUB_TOKEN` | Optional | Server-side PAT fallback for local/dev only |
| `SKIP_ENV_VALIDATION` | Optional | Set to skip `@t3-oss/env` validation (Docker/CI) |

AI keys stay on the server (not per-user). GitHub access prefers **Clerk OAuth**, not a shared PAT.

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

Users authorize GitHub **once** via Clerk. Tokens are **not** stored in your database.

### Enable GitHub in Clerk

1. Open [Clerk Dashboard → SSO connections](https://dashboard.clerk.com/~/user-authentication/sso-connections).
2. Add **GitHub** for all users.
3. Enable **Use custom credentials** (shared Clerk credentials do **not** include the `repo` scope).
4. Create a [GitHub OAuth App](https://github.com/settings/applications/new):
   - **Homepage URL:** your app URL
   - **Authorization callback URL:** copy from the Clerk GitHub connection page
5. Paste **Client ID** and **Client Secret** into Clerk.
6. In Clerk’s GitHub scopes field, add: `repo`  
   (private repos, contents, commits, PRs, webhook registration)

Also enable **Google** (or other providers) if you want non-GitHub login. Users who sign in with Google still click **Authorize with GitHub** on `/create` to link repo access.

### User connect / link flow

| User state | What happens |
|------------|----------------|
| New user on `/create` | **Connect GitHub** → **Authorize with GitHub** (`createExternalAccount` + `repo`) |
| Signed in with Google / email only | Same button links GitHub to the existing Clerk user |
| Connected but missing `repo` | **Re-authorize for more scopes** (`externalAccount.reauthorize`) |
| Already connected | Shows connected status; user picks a repo and continues |

Server-side, Gitwork loads the token with Clerk `getUserOauthAccessToken` and uses it for indexing, commits, PR digests, and webhooks. The token is never returned to the client.

## How the product works

```text
Authorize GitHub (once)
        ↓
Create project → pick repo + branch
        ↓
Index source files → embeddings (pgvector)
        ↓
┌─────────────┬──────────────┬───────────────┬─────────────┐
│  Ask Q&A    │ Commit sync  │ Meeting audio │ PR digests  │
│  (RAG)      │ + webhooks   │ → chapters    │ (7-day)     │
└─────────────┴──────────────┴───────────────┴─────────────┘
```

- **Indexing:** loads a capped set of source files from the selected branch, summarizes + embeds them.
- **Q&A:** retrieves relevant chunks, answers with Gemini, can save answers per project.
- **Commits:** backfill on create; webhook keeps the timeline updated when configured (`APP_URL` must be publicly reachable).
- **Meetings:** upload audio → AssemblyAI → structured chapters shown as issue-like cards.
- **PR digests:** live GitHub data + AI summary / risk callouts. Spec: [README-pr-review-digests.md](./README-pr-review-digests.md).

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

Set the same variables as local (Clerk, `DATABASE_URL`, Gemini, Assembly, Cloudinary, `APP_URL`).  
`GITHUB_TOKEN` is optional if every user connects GitHub OAuth.

Update Clerk + GitHub OAuth **callback / homepage URLs** for production. Point `APP_URL` at your public URL so webhooks work.

### Option A — Vercel (direct)

1. Import the GitHub repo in Vercel  
2. Add all env vars (Production + Preview)  
3. Deploy  

If the Vercel builder runs out of memory, prefer Option B, Railway, or Docker.

### Option B — GitHub Actions → Vercel prebuilt

Builds can run on **GitHub Actions** (more RAM), then upload output to Vercel. Use this if Vercel’s own builder OOM-retries.

If present in the repo:

- `vercel.json` may set `"git.deploymentEnabled": false` so Vercel does not build from Git itself.
- Workflow secrets typically needed:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`

Ensure app env vars exist on the **Vercel project**. Push to `main` (or run the workflow manually) to deploy.

### Option C — Railway / Render / Docker

Any Node host that can run `npm run build` + `npm run start` works. Docker helps when you want a fixed image and more build RAM than Vercel hobby builders:

1. Build the image on a machine with enough memory  
2. Run the container with env vars  
3. Set `APP_URL` to the public hostname  

## Roadmap

Ideas and priorities live in [feature.md](./feature.md) (GitHub Issue export from meetings, metering, multi-turn Q&A, architecture map, Slack digests, etc.).

PR digest product spec: [README-pr-review-digests.md](./README-pr-review-digests.md).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can’t create / index a project | Connect GitHub with `repo` scope in Clerk (custom OAuth app) |
| Google login but no repos | Authorize GitHub on `/create` (linking is separate from sign-in) |
| Branches / private repo 404 | Re-authorize GitHub; confirm `repo` scope |
| Webhooks not firing | Set public `APP_URL` (ngrok in local dev); check webhook registration on the repo |
| Meeting upload fails | Configure Cloudinary `NEXT_PUBLIC_*` vars |
| Transcription fails | Check `ASSEMBLY_API_KEY` |
| Q&A / digests empty or erroring | Check `GEMINI_API_KEY` and indexing job status |
| Vercel build retries / OOM | Raise `NODE_OPTIONS`, use Actions prebuilt deploy, Railway, or Docker |

## License

Private project (`0.1.0`). Update this section if you open-source the repo.
