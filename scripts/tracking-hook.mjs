#!/usr/bin/env node
// work-tracking plugin hook. Hooks cannot call MCP tools, so they inject
// instructions (and block edits until Linear is touched); Claude does the
// Linear/ClickUp calls via the plugin skills.
//   SessionStart -> mandatory first step: find/create the Linear issue (or run setup)
//   PreToolUse   -> deny file edits and git commit/push until Linear has been touched
//                   (lets through after 2 denials so a Linear outage cannot deadlock work)
//   PostToolUse  -> Linear/skill use satisfies the gate; edits mark real work;
//                   after git commit / push / gh pr create|merge: checkpoint comment
//   Stop         -> once per session after real work: update issue, offer the brief
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* no payload */ }

const event = input.hook_event_name;
const tool = input.tool_name || '';
const cmd = input.tool_input?.command || '';
const sessionId = input.session_id || 'unknown';
const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const stateDir = join(tmpdir(), 'work-tracking');
mkdirSync(stateDir, { recursive: true });
const stateFile = join(stateDir, `${sessionId}.json`);

const readState = () => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return {}; } };
const writeState = (s) => writeFileSync(stateFile, JSON.stringify(s));
const git = (c) => {
  try { return execSync(`git ${c}`, { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
const emit = (name, additionalContext) =>
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: name, additionalContext } }));

// Opt out per project: create an empty .work-tracking.off
if (existsSync(join(projectDir, '.work-tracking.off'))) process.exit(0);

let config = null;
try { config = JSON.parse(readFileSync(join(projectDir, '.work-tracking.json'), 'utf8')); } catch { /* not set up */ }

const isEdit = /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool);
const isShip = /\bgit\s+(commit|push)\b|\bgh\s+pr\s+(create|merge)\b/.test(cmd);
const isLinear = /^mcp__.*__(list_issues|get_issue|save_issue|save_comment|list_projects|list_teams)$/.test(tool);
const isTrackingSkill = tool === 'Skill' && String(input.tool_input?.skill || '').startsWith('work-tracking:');

if (event === 'SessionStart') {
  const startedAt = new Date().toISOString();
  writeState({ startedAt, linearTouched: false, denials: 0 });
  const branch = git('branch --show-current');
  const first = config
    ? `Work tracking is MANDATORY in this project (${JSON.stringify(config)}). BEFORE any file edit, commit or other change, use the work-tracking:linear-sync skill: ` +
      "match the user's request to an open Linear issue or create one (title, impact, acceptance criteria, verification steps), set it In Progress, and comment the start time. "
    : 'Work tracking is MANDATORY but this project has no .work-tracking.json. BEFORE any file edit, commit or other change, run the work-tracking:setup skill. ' +
      'If setup cannot finish quickly, track against the first Linear team anyway and ask which project afterwards. Then use work-tracking:linear-sync. ';
  emit('SessionStart',
    first +
    'Research and reading are fine first, but the first edit or commit will be blocked until Linear has been updated. ' +
    `Session clock started ${startedAt} on branch "${branch}". Put the issue ID in commit messages and the PR description.`);
} else if (event === 'PreToolUse') {
  if ((isEdit || isShip) && !readState().linearTouched) {
    const state = readState();
    state.denials = (state.denials || 0) + 1;
    writeState(state);
    if (state.denials <= 2) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'Work tracking: Linear has not been updated this session. Use the work-tracking:linear-sync skill now (find or create the issue, set In Progress), then retry this action. ' +
            (config ? '' : 'This project has no .work-tracking.json, so run work-tracking:setup first. ') +
            'If Linear is unreachable, say so to the user and retry; the block lifts after a second attempt.'
        }
      }));
    }
  }
} else if (event === 'PostToolUse') {
  const state = readState();
  let changed = false;
  if ((isLinear || isTrackingSkill) && !state.linearTouched) { state.linearTouched = true; changed = true; }
  if ((isEdit || isLinear && /save_(issue|comment)/.test(tool)) && !state.hadWork) { state.hadWork = true; changed = true; }
  if (isShip) { state.hadWork = true; state.checkpoints = (state.checkpoints || 0) + 1; changed = true; }
  if (changed) writeState(state);
  if (isShip) {
    emit('PostToolUse',
      'Linear checkpoint: add a short comment to the matching Linear issue (what changed, commands run, remaining work, blockers). ' +
      'If a PR was just opened, link it and move the issue to In Review. Skip if you already commented for this exact change.');
  }
} else if (event === 'Stop') {
  const state = readState();
  if (state.hadWork && !state.briefOffered && !input.stop_hook_active) {
    state.briefOffered = true;
    writeState(state);
    const since = state.startedAt || '';
    const commits = since ? git(`log --since="${since}" --oneline`) : '';
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason:
        (state.linearTouched ? '' : 'Linear was never updated this session. ') +
        'Before ending: bring the Linear issue up to date (status, final comment with changes, commands run, remaining work, blockers). ' +
        `Session started ${since}; commits this session:\n${commits || '(none)'}\n` +
        'Then ask the user in one line whether to draft the end-of-day ClickUp brief with work-tracking:eod-brief. Do not post it without a yes.'
    }));
  }
}
