# Gitwork

AI workspace for GitHub teams: codebase Q&A, commit summaries, meeting → issues, and PR digests.

## Product Specs

- [PR / Review Digests](./README-pr-review-digests.md)

## GitHub OAuth (required for create / index / commits / digests)

Users authorize GitHub **once** via Clerk. No personal access tokens are pasted or stored in the database.

### 1. Enable GitHub in Clerk

1. Open [Clerk Dashboard → SSO connections](https://dashboard.clerk.com/~/user-authentication/sso-connections).
2. Add **GitHub** for all users.
3. Enable **Use custom credentials** (shared Clerk credentials do **not** include the `repo` scope).
4. Create a [GitHub OAuth App](https://github.com/settings/applications/new):
   - Homepage URL: your app URL
   - Authorization callback URL: copy from the Clerk GitHub connection page
5. Paste the GitHub **Client ID** and **Client Secret** into Clerk.
6. In Clerk’s GitHub scopes field, add: `repo`  
   (needed for private repos, contents, commits, PRs, and webhook registration)

### 2. Connect / link flow for users

| User state | What happens |
|------------|----------------|
| New user | On `/create`, step **Connect GitHub** → **Authorize with GitHub** (`createExternalAccount` with `repo`) |
| Already signed in with email only | Same button links GitHub to the existing Clerk user |
| Connected but missing `repo` | **Re-authorize for more scopes** calls `externalAccount.reauthorize` |
| Already connected | Step shows connected status; user picks a repo and continues |

After OAuth, Gitwork loads the Clerk-managed token server-side with `getUserOauthAccessToken` and uses it for indexing, commits, PR digests, and webhooks. The token is never returned to the client.

### 3. Environment

Copy `.env.example` → `.env`.

- **Required:** Clerk keys, `DATABASE_URL`, `GEMINI_API_KEY`, `ASSEMBLY_API_KEY`, etc.
- **`GITHUB_TOKEN`:** optional fallback for local/dev only. Not required in production if every user connects GitHub.
- AI keys stay server-side (not per-user).
