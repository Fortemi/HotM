const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const script = path.join(__dirname, 'write-mocked-playwright-ci-receipt.cjs');
const fixtureFiles = [
  'test-data.ts',
  'compatibility-admission.spec.ts',
  'enterprise-preview.spec.ts',
  'error-handling.spec.ts',
  'navigation.spec.ts',
  'note-crud.spec.ts',
  'search.spec.ts',
  'tags.spec.ts',
];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hotm-receipt-test-'));
  for (const name of fixtureFiles) {
    const relative = name === 'test-data.ts' ? `ui/e2e/fixtures/${name}` : `ui/e2e/tests/${name}`;
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), `${name}\n`);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid', 'commit', '-q', '-m', 'fixture'], { cwd: root });
  return root;
}

function prepare(root, environment = {}) {
  const output = path.join(root, 'receipt.json');
  const result = spawnSync(process.execPath, [script, '--prepare', output], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REPOSITORY: 'Fortemi/HotM', ...environment },
  });
  return { output, result };
}

test('accepts a push when GITHUB_SHA is the checked-out source', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const { output, result } = prepare(root, { GITHUB_SHA: head, GITHUB_EVENT_PATH: '' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(receipt.git.source_sha, head);
  assert.equal(receipt.git.source_sha_matches_hotm_sha, true);
});

test('binds a pull request receipt to its head while retaining the synthetic event SHA', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const event = path.join(root, 'event.json');
  const synthetic = '1'.repeat(40);
  fs.writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: head } } }));
  const { output, result } = prepare(root, { GITHUB_SHA: synthetic, GITHUB_EVENT_PATH: event });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(receipt.git.github_sha, synthetic);
  assert.equal(receipt.git.pull_request_head_sha, head);
  assert.equal(receipt.git.source_sha_matches_hotm_sha, true);
});

test('rejects a pull request head that differs from the checkout', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const event = path.join(root, 'event.json');
  fs.writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: '2'.repeat(40) } } }));
  const { result } = prepare(root, { GITHUB_SHA: '1'.repeat(40), GITHUB_EVENT_PATH: event });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /event source SHA does not match checked-out HotM HEAD/);
});
