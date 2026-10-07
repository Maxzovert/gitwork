# Contributing to Gitwork

Thanks for helping improve Gitwork. This guide covers local setup, how we work, and what to ship with every change.

---

## Quick start

```bash
git clone https://github.com/Maxzovert/gitwork.git
cd gitwork
npm install
cp .env.example .env
```

1. Fill in `.env` (see [`.env.example`](./.env.example) and the [README](./README.md#environment)).
2. Start Postgres with `./start-database.sh` (or point `DATABASE_URL` / `DIRECT_URL` at Neon).
3. Apply the schema: `npm run db:push`
4. Run the app: `npm run dev` → [http://localhost:3000](http://localhost:3000)

Before opening a PR, run:

```bash
npm run check          # lint + tsc
npm run format:write   # optional Prettier pass
```

---

## Branch & PR workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/short-description
   ```
2. Prefer focused commits. Message style: imperative, why-first  
   (`add branch-scoped embeddings`, `fix webhook re-index race`).
3. Open a PR against `main` with:
   - **Summary** — what changed and why
   - **Test plan** — checklist of what you verified
4. Keep PRs reviewable: one feature or fix per PR when possible.

Suggested prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`.

---

## Code guidelines

### Match the house style

- Follow existing patterns in `src/` — don't introduce a second way to do the same thing.
- Prefer the App Router, server components where they fit, and tRPC for typed API surfaces.
- UI: reuse components under `src/components/ui/` and existing layout primitives (`page-header`, `empty-state`, etc.).
- Env vars go through `src/env.js` and `.env.example` together — never commit real secrets.

### Do

- Keep changes scoped; avoid drive-by refactors in unrelated files.
- Handle loading / empty / error states on new product surfaces.
- Use project access helpers in `src/server/api/` for anything project-scoped.
- Encrypt user-supplied tokens with the existing crypto helpers — never store plaintext PATs.

### Don't

- Commit `.env`, `.env.local`, `.vercel/`, or build artifacts (`.next`, `*.tsbuildinfo`).
- Add scratch files (`cli.txt`, one-off scripts) at the repo root.
- Leave Sentry / vendor example routes or duplicate large media assets in the tree.
- Bypass Auth0 / project membership checks for “temporary” debugging that ships.

---

## Feature notes (required)

Product features get a note under `notes/` (local developer docs). When you **add or ship** a feature:

1. Create `notes/NN-kebab-name.md` from `notes/_TEMPLATE.md` (next free number).
2. Fill **What / Why / How / Key files / Env / Related links**.
3. Add a row to `notes/README.md`.

**Counts as a feature:** new protected route, new `src/lib/*` domain module, new user-facing tRPC capability, or a new webhook/API pipeline.

**Skip for:** pure UI polish, typos, refactors with no behavior change, shadcn primitives.

Cursor agents follow `.cursor/rules/feature-notes.mdc` for the same rule.

Public product specs and roadmap live in [`docs/`](./docs).

---

## Architecture touchpoints

| Area | Where to look |
|------|----------------|
| Routes & pages | `src/app/` |
| UI components | `src/components/` |
| GitHub / AI / meetings | `src/lib/` |
| tRPC routers | `src/server/api/routers/` |
| Auth middleware | `src/middleware.ts`, `src/lib/auth0.ts` |
| Schema | `prisma/schema.prisma` |

When changing env vars, update **both** `src/env.js` and `.env.example`.

---

## Testing checklist

For most PRs, verify locally:

- [ ] Sign-in / sign-out still works (Auth0 callbacks)
- [ ] Project create / open path you touched still loads
- [ ] No new TypeScript or lint errors (`npm run check`)
- [ ] If you touched GitHub flows: Connect GitHub + a private/public repo smoke test
- [ ] If you touched meetings: upload → transcript path with Cloudinary/Assembly configured
- [ ] If you touched webhooks: payload still validates and updates the expected records

---

## Docs updates

| Change type | Update |
|-------------|--------|
| New / changed product behavior | Matching `notes/*.md` (and `docs/` if it's a public spec) |
| Env vars | `.env.example` + `src/env.js` + README env table if user-facing |
| Roadmap priority | [`docs/roadmap.md`](./docs/roadmap.md) |

---

## Reporting issues

Include:

- What you expected vs what happened
- Steps to reproduce
- Browser / Node version if relevant
- Whether Auth0 GitHub connection or a PAT was in use

Security-sensitive findings: report privately to the maintainers — do not open a public issue with secrets or exploit details.

---

## License

This repository is currently private. By contributing, you agree that your work may be used under the project's eventual license terms.
