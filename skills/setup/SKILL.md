---
name: setup
description: One-time setup of work tracking for the current project. Runs automatically the first time the plugin starts in a project that has no .work-tracking.json. Detects the Linear team and project, asks at most two questions, and saves the config.
---

# Work tracking setup

Goal: leave the project with a `.work-tracking.json` so every later session starts tracking with no questions.

## Steps

1. **Check connectors.** Call Linear `whoami`. If Linear tools are missing, tell the user: open Claude Settings, then Connectors, connect Linear, and start a new session. Do the same check for ClickUp; ClickUp is optional, so continue without it if it is missing and set `clickup` to null.
2. **Find the team.** `list_teams`. One team: use it. Several: ask which one.
3. **Find the project.** `list_projects` for that team. Match by the repo folder name or git remote name. If one clearly matches, use it. If none or several, ask once: pick one, create a new one, or none.
4. **ClickUp (if connected).** Ask once where the daily brief goes (a list, task or chat channel). Use `clickup_get_workspace_hierarchy` to offer real options.
5. **Save** `.work-tracking.json` in the project root:

```json
{
  "linear": { "team": "ENG", "project": "Project name" },
  "clickup": { "briefTarget": "list or channel id", "name": "readable name" }
}
```

6. Tell the user it is saved, that it can be committed so teammates share it, and that creating a file named `.work-tracking.off` turns tracking off for this project.
7. Continue with `work-tracking:linear-sync` for the task in front of you.

## If setup stalls

Do not leave the session untracked. Use the first Linear team, find or create the issue with `work-tracking:linear-sync`, and ask which project afterwards.

## Rules

- Never create Linear projects or issues during setup without showing the user first.
- Ask at most two questions in total. Prefer detecting over asking.
