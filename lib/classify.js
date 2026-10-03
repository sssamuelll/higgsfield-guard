'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { guardHome } = require('./paths');

// MCP tools that never spend: account, prices, catalogs, uploads, waiting on existing jobs.
const FREE_MCP = /^(balance|transactions|models_explore|jobs_wait|job_display|apps_search|apps_describe|ads_studio_quote|resolve_explainer_preset|animation_actions|website_status|media_(upload|upload_widget|confirm|import_url)|(get|list|show)_.*|ads_studio_(get|list)_.*|video_analysis_(jobs|status)|scene_builder_3d_(get|list|search|show|query)_.*|tiktok_(accounts|music_trending|publish_status))$/;
// CLI subcommands that never spend.
const FREE_CLI = /^(generate\s+(cost|list|get|wait)|account|model|auth|upload|workflow\s+(list|get)|marketing-studio\s+\S+\s+(list|get)|help|version|--help|-h|--version)\b/;
// The CLI by file name: higgsfield or higgs, bare or as .js/.cmd/.exe/.ps1, in any folder.
const CLI_BIN = /^higgs(?:field)?(?:\.js|\.cmd|\.exe|\.ps1)?$/i;
// Words that run the word after them as a command.
const WRAPPERS = new Set(['sudo', 'exec', 'time', 'nohup', 'env', 'command', 'xargs', 'npx', 'npm', 'bunx', 'pnpm', 'yarn', 'dlx', 'node', 'call', 'start', 'cmd', 'cmd.exe', 'bash', 'sh', 'zsh', 'powershell', 'powershell.exe', 'pwsh']);
// Where one shell command ends and the next can start.
const SEGMENT_BREAK = /&&|\|\||[;|&\n`()]|\$\(/;
const API_WRITE = /(?:-X\s*|--request\s+)(?:POST|PUT|PATCH)\b|--data(?:-\w+)?\b|(?:^|\s)-d|--json\b|(?:^|\s)-F\b|--form\b|(?:^|\s)-T\b|--upload-file\b|Invoke-(?:RestMethod|WebRequest)|\b(?:requests|httpx|axios)\.(?:post|put|patch)\(|fetch\(|urlopen\(/i;
const GUARD_SELF = /higgsfield-guard(?:\.(?:js|cmd|ps1|exe))?["']?\s+(approve|uninstall)\b/i;
const SHELL_WRITES = /(>|\btee\b|\bcp\b|\bmv\b|\brm\b|\bdel\b|\bmkdir\b|\btouch\b|Remove-Item|Set-Content|Add-Content|Out-File|Copy-Item|Move-Item|New-Item|sed\s+-i|\bpython\b|\bnode\b|\bperl\b)/i;
const SCRIPT_EXT = /\.(?:py|mjs|cjs|js|ts|sh|ps1)$/i;
const SCRIPT_RUNS = /\bgen(?:erate)?['"]?\s*[,\s]\s*['"]?(?:create|workflow)\b/i;
const MENTIONS_CLI = /\bhiggs(?:field)?\b/i;
const PROJECT_CONFIGS = ['.mcp.json', path.join('.cursor', 'mcp.json'), path.join('.gemini', 'settings.json')];
const MAX_SCRIPT_BYTES = 512 * 1024;
const SPEND = { type: 'spend', requests: [] };

const expand = (p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);
const norm = (p, cwd) => path.resolve(cwd || process.cwd(), expand(p)).replace(/\\/g, '/').toLowerCase();

function isInsideGuard(p, cwd) {
  if (typeof p !== 'string' || !p) return false;
  const root = norm(guardHome());
  const target = norm(p, cwd);
  return target === root || target.startsWith(`${root}/`);
}

/** True when a project config at or above `cwd` points `server` at Higgsfield (.mcp.json and friends). */
function projectServer(server, cwd) {
  let dir = path.resolve(cwd);
  for (;;) {
    for (const rel of PROJECT_CONFIGS) {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'))?.mcpServers?.[server];
        if (entry && /higgsfield/i.test(JSON.stringify(entry))) return true;
      } catch { /* missing or not JSON */ }
    }
    const up = path.dirname(dir);
    if (up === dir) return false;
    dir = up;
  }
}

function isHiggsfield(call, config) {
  if (/higgsfield/i.test(`${call.server ?? ''} ${call.url ?? ''}`)) return true;
  if (Array.isArray(config.servers) && config.servers.includes(call.server)) return true;
  return Boolean(call.cwd && call.server) && projectServer(call.server, call.cwd);
}

/** The CLI's arguments when this simple command runs the Higgsfield CLI, else null. */
function cliArgs(segment) {
  const words = segment.trim().split(/\s+/).map((w) => w.replace(/^["']+|["']+$/g, '')).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const base = w.split(/[\\/]/).pop().toLowerCase();
    if (CLI_BIN.test(base)) return words.slice(i + 1).join(' ');
    if (/^[A-Za-z_]\w*=/.test(w) || WRAPPERS.has(base)) continue;
    if (i > 0 && /^(?:-|\/c$)/i.test(w)) {
      if (/^(?:-p|--package)$/.test(w)) i++;
      continue;
    }
    return null;
  }
  return null;
}

/** Script files named in the command, quoted paths with spaces included. */
function scriptPaths(command) {
  const found = [];
  for (const m of command.matchAll(/"([^"]+)"|'([^']+)'|([^\s"'`|;&<>()]+)/g)) {
    const p = m[1] ?? m[2] ?? m[3];
    if (SCRIPT_EXT.test(p)) found.push(p);
  }
  return found;
}

/** The working folder, plus every folder the command `cd`s into before running something. */
function cdDirs(command, cwd) {
  let base = cwd || process.cwd();
  const dirs = [base];
  for (const m of command.matchAll(/(?:^|[;&|(]\s*)(?:cd|pushd|Set-Location)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|)]+))/gi)) {
    base = path.resolve(base, expand(m[1] ?? m[2] ?? m[3]));
    dirs.push(base);
  }
  return dirs;
}

function scriptVerdict(file) {
  try {
    if (/higgsfield-guard/i.test(file) || fs.statSync(file).size > MAX_SCRIPT_BYTES) return null;
    const text = fs.readFileSync(file, 'utf8');
    if (GUARD_SELF.test(text)) return 'self';
    if (!/higgsfield/i.test(text)) return null;
    return SCRIPT_RUNS.test(text) || (/higgsfield\.ai/i.test(text) && API_WRITE.test(text)) ? 'spend' : null;
  } catch {
    return null;
  }
}

function classifyShell(command, cwd) {
  if (GUARD_SELF.test(command)) return { type: 'self' };
  if (/\.higgsfield-guard/i.test(command) && SHELL_WRITES.test(command)) return { type: 'self' };
  let sawCli = false;
  for (const segment of command.split(SEGMENT_BREAK)) {
    const args = cliArgs(segment);
    if (args === null) continue;
    sawCli = true;
    const sub = args.replace(/^(?:--?[\w-]+\s+)*/, '');
    if (sub && !FREE_CLI.test(sub)) return SPEND;
  }
  if (MENTIONS_CLI.test(command) && SCRIPT_RUNS.test(command)) return SPEND;
  if (/higgsfield\.ai/i.test(command) && API_WRITE.test(command)) return SPEND;
  const dirs = cdDirs(command, cwd);
  for (const f of scriptPaths(command)) {
    for (const d of dirs) {
      const verdict = scriptVerdict(path.resolve(d, expand(f)));
      if (verdict === 'self') return { type: 'self' };
      if (verdict === 'spend') return SPEND;
    }
  }
  return { type: sawCli ? 'free' : 'other' };
}

function classify(call, config = {}) {
  if (!call) return { type: 'other' };
  if (call.kind === 'write') return { type: isInsideGuard(call.path, call.cwd) ? 'self' : 'other' };
  if (call.kind === 'shell') return classifyShell(String(call.command ?? ''), call.cwd);
  if (call.kind !== 'mcp' || !isHiggsfield(call, config)) return { type: 'other' };
  if (FREE_MCP.test(call.tool)) return { type: 'free' };
  const args = call.args && typeof call.args === 'object' ? call.args : {};
  const requests = Array.isArray(args.requests) ? args.requests.map((r) => r?.params ?? r) : [args.params ?? args];
  if (requests.length === 1 && requests[0]?.get_cost === true) return { type: 'free' };
  return { type: 'spend', requests };
}

module.exports = { classify, isInsideGuard };
