# work-tracking

A Claude Code plugin that makes Linear tracking and a daily ClickUp brief automatic in any project. No repo files to copy.

## Install (about 2 minutes)

1. Connect **Linear** and **ClickUp** in Claude (Settings, Connectors).
2. In Claude Code run:

```
/plugin marketplace add ahftsm/claude-work-tracking
/plugin install work-tracking@debate-tools
```

3. Start a session in any project. The first time, Claude sets the project up (detects the Linear team and project, asks at most two questions, saves `.work-tracking.json`). After that it runs on its own.

## What happens automatically

| When | What Claude does |
| --- | --- |
| Session starts | Finds or creates the Linear issue, sets In Progress, logs start time |
| After `git commit`, `git push`, `gh pr create` | Adds a checkpoint comment, links the PR |
| Session ends (only if work was committed) | Updates the issue, offers the daily brief |

Skills: `work-tracking:setup`, `work-tracking:linear-sync`, `work-tracking:eod-brief`, `work-tracking:clickup-linear-bridge`.

## Controls

- Per project config: `.work-tracking.json` (commit it so teammates share it).
- Turn off for one project: create an empty `.work-tracking.off`.
- Remove everywhere: `/plugin uninstall work-tracking`.

The brief is never posted without a yes. Time is an estimate from commit timestamps.
