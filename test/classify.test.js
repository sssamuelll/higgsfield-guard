'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-classify-'));
process.env.HIGGSFIELD_GUARD_HOME = path.join(home, '.higgsfield-guard');
const { classify } = require('../lib/classify');

const mcp = (tool, args = {}, server = 'claude_ai_Higgsfield', url) => ({ kind: 'mcp', server, tool, args, url });
const sh = (command, cwd = home) => ({ kind: 'shell', command, cwd });
const type = (call, config) => classify(call, config).type;

test('MCP calls', () => {
  assert.equal(type(mcp('add_card', {}, 'trello')), 'other');
  assert.equal(type(mcp('balance')), 'free');
  assert.equal(type(mcp('list_projects')), 'free');
  assert.equal(type(mcp('generate_video', { params: { model: 'seedance_2_5', get_cost: true } })), 'free');
  const spend = classify(mcp('generate_video', { params: { model: 'seedance_2_5', duration: 5 } }));
  assert.equal(spend.type, 'spend');
  assert.deepEqual(spend.requests, [{ model: 'seedance_2_5', duration: 5 }]);
  const batch = classify(mcp('generate_video_batch', { requests: [{ index: 1, params: { model: 'a' } }, { index: 2, params: { model: 'b' } }] }));
  assert.deepEqual(batch.requests.map((r) => r.model), ['a', 'b']);
  assert.equal(type(mcp('brand_new_tool')), 'spend');
  assert.equal(type(mcp('generate_image', {}, 'media', 'https://mcp.higgsfield.ai/mcp')), 'spend');
  assert.equal(type(mcp('generate_image', {}, 'media')), 'other');
  assert.equal(type(mcp('generate_image', {}, 'media'), { servers: ['media'] }), 'spend');
});

test('the Higgsfield CLI in a command line', () => {
  assert.equal(type(sh('higgsfield generate create seedance_2_5 --prompt hi --wait')), 'spend');
  assert.equal(type(sh('npx higgsfield --json generate create z_image --prompt x')), 'spend');
  assert.equal(type(sh('node "C:/npm/node_modules/@higgsfield/cli/bin/higgsfield.js" generate workflow reframe')), 'spend');
  assert.equal(type(sh('higgsfield generate cost seedance_2_5 --prompt x')), 'free');
  assert.equal(type(sh('higgsfield account status')), 'free');
  assert.equal(type(sh('higgsfield')), 'free');
  assert.equal(type(sh('ls ~/projects/higgsfield-guard')), 'other');
  assert.equal(type(sh('git status')), 'other');
});

test('mentioning Higgsfield is not running it', () => {
  for (const c of ['git commit -m "feat: higgsfield integration"', 'grep -ri higgsfield .', 'rg higgsfield src/', 'pip install higgsfield requests', 'echo "Peter Higgs won"', 'cat higgsfield-notes.md']) {
    assert.equal(type(sh(c)), 'other', c);
  }
});

test('the CLI anywhere a command can start', () => {
  for (const c of [
    'cd x && higgsfield generate create z_image',
    'bash -c "higgsfield generate create z_image"',
    'npx -p @higgsfield/cli higgs gen create z_image',
    '& "C:\\npm\\higgsfield.cmd" generate create z',
    'python -c "subprocess.run([\'higgsfield\',\'generate\',\'create\',\'z\'])"',
    'node "C:/Program Files/nodejs/node_modules/@higgsfield/cli/bin/higgsfield.js" generate create z',
  ]) {
    assert.equal(type(sh(c)), 'spend', c);
  }
  assert.equal(type(sh('cd x && higgsfield account status')), 'free');
});

test('the guard cannot be approved through a shim or a script', () => {
  assert.equal(type(sh('higgsfield-guard.cmd approve 500')), 'self');
  assert.equal(type(sh('higgsfield-guard.ps1 approve --once')), 'self');
  fs.writeFileSync(path.join(home, 'approve.sh'), 'higgsfield-guard approve 500\n');
  assert.equal(type(sh('bash approve.sh')), 'self');
});

test('scripts behind cd, quoted paths with spaces and ~', () => {
  const runs = "subprocess.run(['higgsfield', 'generate', 'create', 'z'])\n";
  fs.mkdirSync(path.join(home, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(home, 'scripts', 'render.py'), runs);
  assert.equal(type(sh('cd scripts && python render.py')), 'spend');
  const spaced = path.join(home, 'my project');
  fs.mkdirSync(spaced, { recursive: true });
  fs.writeFileSync(path.join(spaced, 'make.py'), runs);
  assert.equal(type(sh(`python "${path.join(spaced, 'make.py')}"`)), 'spend');
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    assert.equal(type(sh('python ~/scripts/render.py', os.tmpdir())), 'spend');
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test('a Higgsfield server named in a project .mcp.json', () => {
  const proj = path.join(home, 'proj');
  fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
  fs.writeFileSync(path.join(proj, '.mcp.json'), JSON.stringify({ mcpServers: { hf: { type: 'http', url: 'https://mcp.higgsfield.ai/mcp' } } }));
  assert.equal(type({ ...mcp('generate_video', {}, 'hf'), cwd: proj }), 'spend');
  assert.equal(type({ ...mcp('generate_video', {}, 'hf'), cwd: path.join(proj, 'src') }), 'spend');
  assert.equal(type({ ...mcp('add_card', {}, 'trello'), cwd: proj }), 'other');
});

test('the HTTP API in its long and glued forms', () => {
  assert.equal(type(sh('curl https://platform.higgsfield.ai/v1/image --request POST -d@body.json')), 'spend');
  assert.equal(type(sh(`curl https://platform.higgsfield.ai/v1/image -d'{"a":1}'`)), 'spend');
});

test('the HTTP API', () => {
  assert.equal(type(sh('curl -X POST https://platform.higgsfield.ai/v1/generate -d "{}"')), 'spend');
  assert.equal(type(sh('curl https://higgsfield.ai/pricing')), 'other');
});

test('scripts that drive the CLI', () => {
  fs.writeFileSync(path.join(home, 'make.py'), "subprocess.run(['higgsfield', 'generate', 'create', 'z_image'])\n");
  fs.writeFileSync(path.join(home, 'build.js'), "console.log('hello')\n");
  assert.equal(type(sh('python make.py')), 'spend');
  assert.equal(type(sh(`python "${path.join(home, 'make.py')}"`)), 'spend');
  assert.equal(type(sh('node build.js')), 'other');
  assert.equal(type(sh('python missing.py')), 'other');
});

test('agents approving for themselves', () => {
  assert.equal(type(sh('higgsfield-guard approve 60')), 'self');
  assert.equal(type(sh('node "C:/u/.higgsfield-guard/runtime/bin/higgsfield-guard.js" approve --once')), 'self');
  assert.equal(type(sh('higgsfield-guard uninstall')), 'self');
  assert.equal(type(sh('higgsfield-guard status')), 'other');
  assert.equal(type(sh('echo {} > ~/.higgsfield-guard/allowance.json')), 'self');
  assert.equal(type(sh('cat ~/.higgsfield-guard/log.jsonl')), 'other');
  assert.equal(type({ kind: 'write', path: path.join(process.env.HIGGSFIELD_GUARD_HOME, 'allowance.json') }), 'self');
  const saved = process.env.HIGGSFIELD_GUARD_HOME;
  process.env.HIGGSFIELD_GUARD_HOME = path.join(os.homedir(), '.hg-tilde-test');
  assert.equal(type({ kind: 'write', path: '~/.hg-tilde-test/allowance.json' }), 'self');
  process.env.HIGGSFIELD_GUARD_HOME = saved;
  assert.equal(type({ kind: 'write', path: path.join(home, 'notes.md') }), 'other');
});
