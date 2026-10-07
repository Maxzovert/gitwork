# Gitwork — Feature Roadmap

Ideas that build on the shipped workspace: **branch-aware codebase Q&A**, **project overviews**, **commit summaries**, **meeting → GitHub issues**, **PR digests**, **release drafting**, and **team collaboration**.

## Shipped

- GitHub Issue export from meeting chapters
- Owner/member team invites and shared project history
- Push webhooks for commit sync and automatic active-branch re-indexing
- PR review digests with risk callouts
- Branch picker, indexing progress, and branch-scoped embeddings
- Beginner project overview generated from repository docs and indexed code
- AI changelogs between Git refs and draft GitHub Release creation
- Notification preferences and encrypted per-user API-token storage

Repository indexing currently caps selection at **150 files** per run.

## Highest leverage (next)

1. **Credits / usage metering**
   `User.credits` exists but isn’t used. Meter Q&A, indexing, overview generation, meeting processing, digests, and changelogs; add a free tier and billing later.

2. **Multi-turn Q&A chat**
   Support follow-ups such as “show me the auth middleware” → “where is that called?” while preserving branch and file context.

3. **Incremental indexing**
   Re-embed only changed, added, or deleted files after a push instead of rebuilding the selected branch.

## Deepen existing features

4. **Meeting transcript + audio sync**
   Add a full transcript, clickable timestamps, and playback tied to chapter cards.

5. **Saved answers → docs/wiki**
   Export Q&As to a project wiki, Notion, or a `docs/` pull request so answers do not remain isolated in history.

6. **Release history inside Gitwork**
   Persist generated changelogs and draft-release links so teams can revisit earlier release work.

7. **Actionable notifications**
   Deliver the existing commit, meeting, and indexing preferences through email or an in-app notification center.

## Differentiating product ideas

8. **“What broke?” / incident mode**
   Point at a deploy commit or error message; retrieve related files, recent commits, and related meetings.

9. **Architecture map**
   Visual graph of modules from embeddings (entry points, dependencies, hotspots) with click-through to Q&A.

10. **Slack / Discord digest**
    Send a daily summary of shipped work and unresolved meeting questions to the team channel.

## Suggested build order

1. Incremental indexing
2. Multi-turn Q&A
3. Usage metering