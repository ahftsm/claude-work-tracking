---
name: eod-brief
description: Draft the end-of-day team brief for ClickUp - what was worked on, how long, goal progress, problems, and input needed - from Linear and git, with questions for the user before posting. Triggers - "end of day", "wrap up", "daily brief", "send the update".
---

# End-of-day brief

The short message teammates trade at the end of each work session. Draft first; post only after the user confirms. The brief is posted as a **ClickUp Chat post** (not a Linear comment) to the channel in `clickup.briefChannel` in `.work-tracking.json`; if absent, call `clickup_get_chat_channels` and ask which channel.

## Gather (in parallel)

1. Linear: issues the user updated today, their comments, status changes, project, linked PRs.
2. Git: `git log --since=midnight --author=<user> --format='%h %ad %s' --date=format:%H:%M`.
3. ClickUp: tasks and comments touched today, and anything assigned to the user that is due soon.

## Ask first (at most 3 questions, only what is missing)

- Anything worked on that is not in Linear or git (calls, design, research)?
- Rough time per item if the timestamps are unclear.
- Which blockers need a decision from a teammate?

## Format

```
Daily brief - <name> - <date>

Worked on (time is an estimate from commits and session clock)
- <Project> / <ID title> - ~1h30 - <status> - <one-line outcome>
Total: ~Xh

Goal progress
- <Goal>: <what moved>, <milestone>, <next step>

What I'm trying to do next
- <1-3 lines>

Issues I'm facing
- <issue> - impact - what I tried

Input needed
- <name>: <specific question or decision>

Suggested by Claude
- <risks, a task worth splitting, a dependency, a stale issue>
```

## Rules

- Time is an estimate and labelled as one. Never invent hours.
- Every item links its Linear issue; items without one are flagged so the user can create it.
- Under about 25 lines. Facts, not narration.
- Show the draft and ask "Post to ClickUp?" Post only on a clear yes. Sending is outward-facing.
- Post with `clickup_send_chat_message`: `type: "post"`, `post_type: "Update"`, `post_title: "Daily brief - <name> - <date>"`, `channel_id` from the config, and the brief body as markdown `content`.
- Linear is for work tracking only. Do not copy the brief into Linear.
- Offer to answer end-of-session questions (what is left, what is risky, what to do tomorrow) from Linear state.
