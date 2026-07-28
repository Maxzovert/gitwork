# Gitwork — Feature Roadmap

Ideas that build on the existing three pillars: **commit summaries**, **codebase Q&A**, and **meeting → issues**.

## Highest leverage (close existing gaps)

1. **Push meeting “issues” to GitHub**  
   Chapters already look like tickets. One-click create GitHub Issues (with links back) so meetings drive shipping.

2. **Credits / usage metering**  
   `User.credits` exists but isn’t used. Meter Q&A, indexing, and meeting processing; add a free tier + Stripe later.

3. **Team invites & roles**  
   `userToProject` is already there. Add invite links, owner/member roles, and shared Q&A + meeting history.

4. **Live commit sync (webhooks)**  
   Replace “last 15 on load” with GitHub webhooks so the timeline stays fresh without refreshing.

## Deepen the 3 features

5. **PR / review digests**  
   AI summary of open PRs, risk areas, and “what changed since last week.”

6. **Multi-turn Q&A chat**  
   Follow-ups like “show me the auth middleware” → “where is that called?” instead of one-shot asks.

7. **Better indexing**  
   Branch picker, progress UI, incremental re-index, raise the ~50-file cap for bigger repos.

8. **Meeting transcript + audio sync**  
   Full transcript, clickable timestamps, playback tied to chapter cards.

9. **Saved answers → docs/wiki**  
   Export Q&As to a project wiki, Notion, or a `docs/` PR so answers don’t die in history.

## Differentiating product ideas

10. **Onboarding brief for new contributors**  
    Auto-generate “how this repo works” from embeddings + recent commits.

11. **“What broke?” / incident mode**  
    Point at a deploy commit or error message; retrieve related files, recent commits, and related meetings.

12. **Architecture map**  
    Visual graph of modules from embeddings (entrypoints, deps, hotspots) with click-through to Q&A.

13. **Changelog / release notes generator**  
    From commits + PR titles between tags.

14. **Slack / Discord digest**  
    Daily “what shipped + open questions from meetings” into the team channel.

## Suggested build order (next 2–3)

1. GitHub Issue export from meetings — makes meetings actionable  
2. Webhooks for commits — makes the timeline reliable  
3. Multi-turn Q&A **or** team invites — depending on solo vs team focus