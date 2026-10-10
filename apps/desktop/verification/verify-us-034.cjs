// Read-only audit: no captures or report files are rewritten.
const { app, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { verifyImage } = require('./capture-us-034.cjs');
const repo = resolve(__dirname, '../../..'), dir = resolve(repo, 'docs/verification/assets/us-034');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// This audit requires the reviewed implementation to remain unstaged and uncommitted.
const expectedTracked = [
  'apps/desktop/src/Application.test.tsx', 'apps/desktop/src/office/AgentInspectionPanel.test.tsx',
  'apps/desktop/src/office/OfficeSceneHost.tsx', 'apps/desktop/src/style.css',
];
const expectedCaptureNames = `
1100-production 760-production 1100-unselected current-error current-approval retained synchronizing selected-no-state
1100-disclosure-keyboard-open 1100-projects-focus 760-disclosure-keyboard-open 760-projects-focus
1100-text-100-closed 1100-text-100-open 1100-text-100-long
1100-text-125-closed 1100-text-125-open 1100-text-125-identifiers 1100-text-125-rows 1100-text-125-long
1100-text-200-closed 1100-text-200-open 1100-text-200-identifiers 1100-text-200-rows 1100-text-200-long
760-text-100-closed 760-text-100-open 760-text-100-long
760-text-125-closed 760-text-125-open 760-text-125-identifiers 760-text-125-rows 760-text-125-long
760-text-200-closed 760-text-200-open 760-text-200-identifiers 760-text-200-rows 760-text-200-long
1100-focus-text-100-closed 1100-focus-text-100-open 1100-focus-text-125-closed 1100-focus-text-125-open 1100-focus-text-200-closed 1100-focus-text-200-open
760-focus-text-100-closed 760-focus-text-100-open 760-focus-text-125-closed 760-focus-text-125-open 760-focus-text-200-closed 760-focus-text-200-open
`.trim().split(/\s+/);
const expectedUntracked = [
  'apps/desktop/src/office/SampleActivity.tsx', 'apps/desktop/src/office/SampleActivity.test.tsx',
  'apps/desktop/verification/capture-us-034.cjs', 'apps/desktop/verification/verify-us-034.cjs',
  'docs/verification/us-034-contextual-right-rail.md', 'docs/verification/assets/us-034/capture-record.json',
  ...expectedCaptureNames.map(name => 'docs/verification/assets/us-034/' + name + '.png'),
];
function exactInventory(actual, expected, label) {
  assert.equal(new Set(actual).size, actual.length, label + ': duplicate entries');
  const unexpected = actual.filter(path => !expected.includes(path)), missing = expected.filter(path => !actual.includes(path));
  assert.deepEqual([...actual].sort(), [...expected].sort(), label + ': unexpected ' + JSON.stringify(unexpected) + '; missing ' + JSON.stringify(missing));
}
function validateManifest(captures) {
  assert.ok(Array.isArray(captures), 'Malformed capture manifest');
  for (const capture of captures) {
    assert.ok(capture && typeof capture.name === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(capture.name), 'Malformed capture name');
    assert.match(capture.pngSha256, /^[a-f0-9]{64}$/, 'Malformed PNG hash');
    assert.ok(Number.isInteger(capture.imageSize?.width) && capture.imageSize.width > 0 &&
      Number.isInteger(capture.imageSize?.height) && capture.imageSize.height > 0, 'Malformed capture dimensions');
  }
  exactInventory(captures.map(c => c.name), expectedCaptureNames, 'Capture manifest');
}
function auditScope({ tracked, untracked, staged }) {
  assert.deepEqual(staged, [], 'Staging index must be empty: ' + JSON.stringify(staged));
  exactInventory(tracked, expectedTracked, 'Tracked inventory');
  exactInventory(untracked, expectedUntracked, 'Untracked inventory');
}
function git(args) {
  try { return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }); }
  catch (error) { throw new Error('US-034 audit git ' + args.join(' ') + ' failed: ' + (error.stderr?.toString().trim() || error.message), { cause: error }); }
}
function readScope(baseline) {
  // Git's repository-relative, NUL-separated paths avoid quoting and newline ambiguity.
  const paths = args => git(args).split('\0').filter(Boolean);
  return {
    tracked: paths(['diff', '--name-only', '--relative', '-z', baseline, '--']),
    untracked: paths(['ls-files', '--others', '--exclude-standard', '-z']),
    staged: paths(['diff', '--cached', '--name-only', '--relative', '-z', '--']),
  };
}
function regressionChecks(captures) {
  const clean = { tracked: expectedTracked, untracked: expectedUntracked, staged: [] };
  auditScope(clean); validateManifest(captures);
  assert.throws(() => auditScope({ ...clean, untracked: [...clean.untracked, 'unexpected.txt'] }), /Untracked inventory/);
  assert.throws(() => auditScope({ ...clean, untracked: [...clean.untracked, 'docs/verification/assets/us-034/unexpected.txt'] }), /Untracked inventory/);
  assert.throws(() => auditScope({ ...clean, untracked: clean.untracked.filter(p => !p.endsWith('/verify-us-034.cjs')) }), /Untracked inventory/);
  assert.throws(() => auditScope({ ...clean, tracked: [...clean.tracked, 'README.md'] }), /Tracked inventory/);
  assert.throws(() => auditScope({ ...clean, tracked: clean.tracked.slice(1) }), /Tracked inventory/);
  assert.throws(() => auditScope({ ...clean, staged: ['apps/desktop/src/style.css'] }), /Staging index/);
  assert.throws(() => validateManifest([captures[0], ...captures.slice(0, -1)]), /duplicate entries/);
  assert.throws(() => validateManifest([{ ...captures[0], name: '../escape' }, ...captures.slice(1)]), /Malformed capture name/);
  assert.throws(() => validateManifest([{ ...captures[0], name: 'unapproved-capture' }, ...captures.slice(1)]), /Capture manifest/);
  assert.throws(() => validateManifest([{ ...captures[0], pngSha256: 'invalid' }, ...captures.slice(1)]), /Malformed PNG hash/);
  assert.throws(() => validateManifest([{ ...captures[0], imageSize: { width: 0, height: 1 } }, ...captures.slice(1)]), /Malformed capture dimensions/);
  return 11;
}
async function run() {
  await app.whenReady();
  const record = JSON.parse(readFileSync(resolve(dir, 'capture-record.json')));
  assert.equal(record.baseline, '866bec779cfb056ec6ddf0843c73654b0f6449c7');
  validateManifest(record.captures);
  const scope = readScope(record.baseline); auditScope(scope);
  const negativeChecks = regressionChecks(record.captures);
  assert.equal(record.observations.f1Focus.length, 12);
  for (const outer of [[1100, 760], [760, 540]]) for (const percent of [100, 125, 200]) for (const state of ['closed', 'open']) {
    const evidence = record.observations.f1Focus.find(c => c.outer[0] === outer[0] && c.percent === percent && c.state === state);
    assert.ok(evidence, 'Missing F1 focus case'); assert.ok(evidence.clearance > 0); assert.ok(evidence.decoded.decodedClearance > 0);
  }
  assert.deepEqual(readdirSync(dir).filter(p => p.endsWith('.png')).sort(), record.captures.map(c => c.name + '.png').sort());
  for (const c of record.captures) {
    const bytes = readFileSync(resolve(dir, c.name + '.png')), image = nativeImage.createFromBuffer(bytes);
    assert.equal(image.isEmpty(), false, c.name); assert.equal(hash(bytes), c.pngSha256, c.name); assert.deepEqual(image.getSize(), c.imageSize);
    assert.ok(c.settlement.consecutiveStableFrames >= 4); assert.equal(c.overflow, false); assert.equal(c.canvases, 1);
    assert.deepEqual(verifyImage(bytes, c), c.correspondence, c.name);
  }
  const production = record.captures.find(c => c.name === '1100-production'), mismatched = structuredClone(production);
  mismatched.borders.office.bounds.y += 20;
  assert.throws(() => verifyImage(readFileSync(resolve(dir, '1100-production.png')), mismatched), /image\/layout mismatch/);
  const focused = record.captures.find(c => c.name === '1100-focus-text-100-closed'), obscured = structuredClone(focused);
  obscured.focusClearance.clearance = -6;
  assert.throws(() => verifyImage(readFileSync(resolve(dir, focused.name + '.png')), obscured), /F1: focus outline overlaps disclaimer/);
  for (const [path, expected] of Object.entries(record.sourceSha256)) assert.equal(hash(readFileSync(resolve(repo, path))), expected, path);
  assert.equal(hash(readFileSync(resolve(__dirname, 'capture-us-034.cjs'))), record.toolingSha256);
  git(['diff', '--check']);
  console.log('PASS: 50 PNGs decoded/hash/dimension/correspondence matched; 12 F1 focus-clearance cases passed; mismatched metadata rejected; ' + Object.keys(record.sourceSha256).length + ' source/historical-evidence hashes and harness matched; exact ' + scope.tracked.length + ' tracked / ' + scope.untracked.length + ' untracked inventory; ' + negativeChecks + ' negative scope/manifest regressions passed; index empty.');
  app.quit();
}
module.exports = { auditScope, validateManifest, readScope, regressionChecks };
if (resolve(process.argv[1] ?? '') === __filename) run().catch(error => { console.error(error); app.exit(1); });
