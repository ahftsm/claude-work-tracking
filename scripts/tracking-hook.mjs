#!/usr/bin/env node
// work-tracking plugin hook. Hooks cannot call MCP tools, so they inject
// instructions and Claude does the Linear/ClickUp calls via the plugin skills.
//   SessionStart -> first run in a project: run setup. Otherwise: find/create the issue.
//   PostToolUse  -> after git commit / push / gh pr create|merge: checkpoint comment
//   Stop         -> once per session, after real work: update issue, offer the brief
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* no payload */ }

const event = input.hook_event_name;
const sessionId = input.session_id || 'unknown';
const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const configPath = join(projectDir, '.work-tracking.json');
const stateDir = join(tmpdir(), 'work-tracking');
mkdirSync(stateDir, { recursive: true });
const stateFile = join(stateDir, `${sessionId}.json`);

const readState = () => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return {}; } };
const writeState = (s) => writeFileSync(stateFile, JSON.stringify(s));
const git = (cmd) => {
  try { return execSync(`git ${cmd}`, { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
const emit = (name, additionalContext) =>
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: name, additionalContext } }));

// Opt out per project: create .work-tracking.off
if (existsSync(join(projectDir, '.work-tracking.off'))) process.exit(0);

let config = null;
try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch { /* not set up yet */ }

if (event === 'SessionStart') {
  const startedAt = new Date().toISOString();
  writeState({ startedAt, checkpoints: 0 });
  const branch = git('branch --show-current');
  if (!config) {
    emit('SessionStart',
      `The work-tracking plugin is installed but this project is not set up. Session clock started ${startedAt}. ` +
      'At the start of the first task, run the work-tracking:setup skill: detect the Linear team and project, ask at most two questions, ' +
      'and save .work-tracking.json in the project root. Then continue with work-tracking:linear-sync.');
  } else {
    emit('SessionStart',
      `Work tracking is on for this project (${JSON.stringify(config)}). Session clock started ${startedAt} on branch "${branch}". ` +
      'Once the first task is clear, use the work-tracking:linear-sync skill: match the request to an open Linear issue or create one ' +
      '(title, impact, acceptance criteria, verification steps), set it In Progress, and comment the start time. ' +
      'Put the issue ID in commit messages and the PR description.');
  }
} else if (event === 'PostToolUse') {
  const cmd = input.tool_input?.command || '';
  if (config && /\bgit\s+commit\b|\bgh\s+pr\s+(create|merge)\b|\bgit\s+push\b/.test(cmd)) {
    const state = readState();
    state.checkpoints = (state.checkpoints || 0) + 1;
    state.hadWork = true;
    writeState(state);
    emit('PostToolUse',
      'Linear checkpoint: add a short comment to the matching Linear issue (what changed, commands run, remaining work, blockers). ' +
      'If a PR was just opened, link it and move the issue to In Review. Skip if you already commented for this exact change.');
  }
} else if (event === 'Stop') {
  const state = readState();
  if (config && state.hadWork && !state.briefOffered && !input.stop_hook_active) {
    state.briefOffered = true;
    writeState(state);
    const since = state.startedAt || '';
    const commits = since ? git(`log --since="${since}" --oneline`) : '';
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason:
        'Before ending: bring the Linear issue up to date (status, final comment with changes, commands run, remaining work, blockers). ' +
        `Session started ${since}; commits this session:\n${commits || '(none)'}\n` +
        'Then ask the user in one line whether to draft the end-of-day ClickUp brief with work-tracking:eod-brief. Do not post it without a yes.'
    }));
  }
}
