// Read-only audit of original captures, approved crops and the unstaged US-035 scope.
const { app, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { verifyImage } = require('./us-035-image.cjs');
const repo = resolve(__dirname, '../../..'), dir = resolve(repo, 'docs/verification/assets/us-035');
const baseline = '2617312e0a307a4d5a8d36e12be27f840d826da2';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedTracked = [
  'apps/desktop/src/Application.tsx', 'apps/desktop/src/Application.test.tsx',
  'apps/desktop/src/office/OfficeSceneHost.tsx', 'apps/desktop/src/style.css',
];
const expectedCaptureNames = ['1100-production', '760-production',
  ...[1100, 760].flatMap(w => ['gallery', 'preview-0', 'preview-1', 'preview-2', 'expanded', 'retained', 'synchronizing', 'escape-return', 'exit-return'].map(s => `${w}-${s}`)),
  ...[1100, 760].flatMap(w => [100, 125, 200].flatMap(p => ['gallery', 'expanded', 'focus'].map(s => `${w}-text-${p}-${s}`))),
  'expanded-unselected', 'expanded-selected-no-state', 'expanded-coffee', 'expanded-generic-waiting', 'expanded-reduced-motion',
  ...[1100,760].flatMap(w=>[100,125,200].flatMap(p=>['normal','expanded'].flatMap(m=>['forward','reverse'].map(d=>`${w}-correction-${m}-${p}-${d}`)))),
  ...[100,125,200].flatMap(p=>['short','long'].map(s=>`1100-correction-flow-${p}-${s}`)),
];
const expectedUntracked = [
  ...['WorldPreviews.tsx', 'WorldPreviews.test.tsx', 'officeExpansion.ts', 'officeExpansion.test.ts'].map(p => 'apps/desktop/src/office/' + p),
  ...['world-retro-70s.png', 'world-arcade-80s.png', 'world-cyber-2000.png', 'world-preview-provenance.json'].map(p => 'apps/desktop/src/office/assets/' + p),
  ...['us-035.html', 'us-035.tsx', 'capture-us-035.cjs', 'us-035-image.cjs', 'verify-us-035.cjs'].map(p => 'apps/desktop/verification/' + p),
  'docs/verification/us-035-world-previews-expansion.md', 'docs/verification/assets/us-035/capture-record.json',
  ...expectedCaptureNames.map(p => 'docs/verification/assets/us-035/' + p + '.png'),
];
function exactInventory(actual, expected, label) {
  assert.equal(new Set(actual).size, actual.length, label + ': duplicate entries');
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
}
function auditScope(scope) {
  assert.deepEqual(scope.staged, [], 'Staging index must be empty');
  exactInventory(scope.tracked, expectedTracked, 'Tracked inventory');
  exactInventory(scope.untracked, expectedUntracked, 'Untracked inventory');
}
function validateManifest(captures) {
  assert.ok(Array.isArray(captures));
  exactInventory(captures.map(c => c.name), expectedCaptureNames, 'Capture manifest');
  for (const c of captures) {
    assert.match(c.pngSha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(c.imageSize.width) && c.imageSize.width > 0 && Number.isInteger(c.imageSize.height) && c.imageSize.height > 0);
    // Only the actual focused element's outline may mask a border; never arbitrary image regions.
    const b = c.focus.bounds;
    const expectedMasks = c.focus.outline.includes('none') ? [] : [{ x: b.x - 6, y: b.y - 6, width: b.width + 12, height: b.height + 12 }];
    assert.deepEqual(c.masks, expectedMasks, 'Focus-mask metadata');
    assert.ok(c.settlement.consecutiveStableFrames >= 4 && c.settlement.attempt <= 6);
    assert.equal(c.overflow, false); assert.equal(c.canvases, 1); assert.equal(c.statusRegions, 1);
    assert.deepEqual([c.canvas.width, c.canvas.height], [640, 360]);
    assert.ok(c.outer[0] === 1100 && c.outer[1] === 760 || c.outer[0] === 760 && c.outer[1] === 540);
  }
}
const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
const paths = args => git(args).split('\0').filter(Boolean);
function readScope() {
  return { tracked: paths(['diff', '--name-only', '--relative', '-z', baseline, '--']),
    untracked: paths(['ls-files', '--others', '--exclude-standard', '-z']), staged: paths(['diff', '--cached', '--name-only', '-z']) };
}
function negativeChecks(captures) {
  const clean = { tracked: expectedTracked, untracked: expectedUntracked, staged: [] };
  auditScope(clean); validateManifest(captures);
  assert.throws(() => auditScope({ ...clean, untracked: [...clean.untracked, 'unexpected.txt'] }), /Untracked inventory/);
  assert.throws(() => auditScope({ ...clean, untracked: clean.untracked.slice(1) }), /Untracked inventory/);
  assert.throws(() => auditScope({ ...clean, tracked: [...clean.tracked, 'README.md'] }), /Tracked inventory/);
  assert.throws(() => auditScope({ ...clean, tracked: clean.tracked.slice(1) }), /Tracked inventory/);
  assert.throws(() => auditScope({ ...clean, staged: [expectedTracked[0]] }), /Staging index/);
  assert.throws(() => validateManifest([captures[0], ...captures.slice(0, -1)]), /duplicate entries/);
  assert.throws(() => validateManifest([{ ...captures[0], name: '../escape' }, ...captures.slice(1)]), /Capture manifest/);
  assert.throws(() => validateManifest([{ ...captures[0], masks: [{ x: 0, y: 0, width: 99999, height: 99999 }] }, ...captures.slice(1)]), /Focus-mask metadata/);
  assert.throws(() => validateManifest([{ ...captures[0], pngSha256: 'invalid' }, ...captures.slice(1)]));
  assert.throws(() => validateManifest([{ ...captures[0], imageSize: { width: 0, height: 1 } }, ...captures.slice(1)]));
  return 10;
}
function verifyCrops() {
  const sourcePath = 'docs/design/references/north-star/coffee-break-north-star-03.png';
  const sourceBytes = readFileSync(resolve(repo, sourcePath)), source = nativeImage.createFromBuffer(sourceBytes);
  assert.equal(hash(sourceBytes), '746acf3b8089eeaed5b28e268467cf3954f3c8fbb7f0867b18a06643b55f5867');
  assert.deepEqual(source.getSize(), { width: 1536, height: 1024 });
  const original = source.toBitmap();
  const manifest = JSON.parse(readFileSync(resolve(repo, 'apps/desktop/src/office/assets/world-preview-provenance.json')));
  const names = ['retro-70s', 'arcade-80s', 'cyber-2000'], xs = [288, 356, 492], hashes = [
    'd53b2a2f9bd52ee35f4766e6244e175dc731a4fcb562528d814113f05be972c9',
    '8e9448b272fbbd307732e96be05a4bf6820ddcc3c6e1b007bee1ec26fe006dc8',
    '0affb5753bbb9612f2ebf19895ee22c91d4bcbb79bcc96826f9f5c463bf19949',
  ];
  exactInventory(manifest.map(m => m.world), names, 'Crop manifest');
  for (let i = 0; i < 3; i++) {
    const m = manifest[i]; assert.equal(m.world, names[i]); assert.equal(m.source, sourcePath); assert.equal(m.sourceSha256, hash(sourceBytes));
    assert.deepEqual(m.sourceDimensions, [1536, 1024]); assert.deepEqual(m.crop, { x: xs[i], y: 847, width: 66, height: 53 });
    assert.equal(m.output, `apps/desktop/src/office/assets/world-${names[i]}.png`); assert.deepEqual(m.outputDimensions, [66, 53]);
    const bytes = readFileSync(resolve(repo, m.output)), image = nativeImage.createFromBuffer(bytes);
    assert.equal(image.isEmpty(), false); assert.equal(hash(bytes), hashes[i]); assert.equal(m.outputSha256, hashes[i]);
    assert.deepEqual(image.getSize(), { width: 66, height: 53 }); const cropped = image.toBitmap();
    for (let y = 0; y < 53; y++) {
      const start = ((847 + y) * 1536 + xs[i]) * 4;
      assert.deepEqual(cropped.subarray(y * 66 * 4, (y + 1) * 66 * 4), original.subarray(start, start + 66 * 4), m.world + ' decoded crop row ' + y);
    }
  }
  const studio = readFileSync(resolve(repo, 'apps/desktop/src/office/assets/office-room-background.png'));
  assert.equal(hash(studio), '82bb56af1eb45452ae9f2a2c180b2dd32a61284e5d05a10af4aa4808edca597c');
  assert.deepEqual(nativeImage.createFromBuffer(studio).getSize(), { width: 320, height: 180 });
}
async function run() {
  await app.whenReady(); assert.equal(git(['rev-parse', 'HEAD']).trim(), baseline);
  assert.equal(git(['branch', '--show-current']).trim(), 'feature/us-035-world-previews-expansion');
  const record = JSON.parse(readFileSync(resolve(dir, 'capture-record.json')));
  assert.equal(record.baseline, baseline); validateManifest(record.captures);
  const scope = readScope(); auditScope(scope); const negatives = negativeChecks(record.captures); verifyCrops();
  exactInventory(readdirSync(dir), [...expectedCaptureNames.map(n => n + '.png'), 'capture-record.json'], 'Evidence directory');
  for (const c of record.captures) {
    const bytes = readFileSync(resolve(dir, c.name + '.png')), image = nativeImage.createFromBuffer(bytes);
    assert.equal(image.isEmpty(), false); assert.equal(hash(bytes), c.pngSha256); assert.deepEqual(image.getSize(), c.imageSize);
    assert.deepEqual(verifyImage(bytes, c), c.correspondence, c.name);
  }
  const c = record.captures.find(c => c.name === '1100-production'), mismatched = structuredClone(c);
  mismatched.borders.office.bounds.y += 30;
  assert.throws(() => verifyImage(readFileSync(resolve(dir, c.name + '.png')), mismatched), /image\/layout mismatch/);
  assert.equal(record.observations.continuity.length, 2);
  for (const o of record.observations.continuity) {
    assert.equal(o.cycles, 10); assert.equal(o.identical, true); assert.equal(o.escapeListenersAfter, 0);
    assert.deepEqual(o.subscriptions, { store: 1, runtime: 2, acknowledgements: 1, watch: 1 });
    assert.equal(o.previewStatePreserved, true); assert.equal(o.harborPreserved, true); assert.equal(o.noAnimationOrAcknowledgementReplay, true);
  }
  assert.deepEqual(record.observations.acknowledgement, { accepted: 1, modeReplay: 0 });
  assert.equal(record.observations.clamping.restored, Math.min(record.observations.clamping.saved, record.observations.clamping.maximum));
  assert.equal(record.observations.text.length, 6);
  for (const w of [1100, 760]) for (const percent of [100, 125, 200]) {
    const t = record.observations.text.find(t => t.outer[0] === w && t.percent === percent);
    assert.ok(t); assert.equal(t.overflow, false); assert.ok(t.focusClearance >= 6);
  }
  assert.equal(record.observations.keyboardSelectionAndClear, true); assert.equal(record.observations.reload, true); assert.deepEqual(record.observations.rendererErrors, []);
  assert.deepEqual(record.observations.expandedDisposal, { canvases: 0, escapeListeners: 0, subscriptions: { store: 0, runtime: 0, acknowledgements: 0, watch: 0 } });
  assert.equal(record.observations.corrections.keyboard.length, 12);
  for (const w of [1100,760]) for (const percent of [100,125,200]) for (const expanded of [false,true]) {
    const c = record.observations.corrections.keyboard.find(c => c.outer[0] === w && c.percent === percent && c.expanded === expanded);
    assert.ok(c); assert.equal(c.noViewportPrepositioning, true);
    const expected = expanded ? ['Exit','Ari','Mina','Sol','Clear'] : ['Office','Agents','Projects','Studio','Expand','Ari','Mina','Sol','Clear','Retro 70s','Arcade 80s','Cyber 2000','Harbor'];
    assert.deepEqual(c.forward.map(f => f.control), expected); assert.deepEqual(c.reverse.map(f => f.control), [...expected].reverse());
    for (const f of [...c.forward,...c.reverse]) if (f.clearanceRequired) {
      assert.ok(f.top >= f.toolbarBottom + 6 - 0.01); assert.ok(f.bottom <= f.viewport[1] - 6 + 0.01); assert.ok(f.outline.includes('3px'));
    }
    assert.deepEqual(c.accessibility.dom, expanded ? ['agents-section','agent-inspection'] : ['agents-section','agent-inspection','worlds-section','sample-activity']);
    assert.deepEqual(c.accessibility.headings, expanded ? ['Office — Studio','Agents','Select an inhabitant'] : ['Coffee Break','Office — Studio','Agents','Select an inhabitant','Worlds','Recent Activity','Projects — Harbor']);
    assert.equal(c.accessibility.studio, expanded ? 'Studio, current authored world' : 'Studio, current authored world. View Worlds');
    const axControls = c.accessibility.controls.map(n => {
      if (n.name.startsWith('Studio,')) return 'Studio';
      if (n.name.startsWith('Expand office')) return 'Expand';
      if (n.name.startsWith('Exit expanded')) return 'Exit';
      if (n.name.startsWith('Select ')) return n.name.split(',')[0].slice(7);
      if (n.name === 'Clear selection') return 'Clear';
      if (n.name.endsWith(' — Preview')) return n.name.slice(0,-10);
      if (n.name.startsWith('Project context for Harbor')) return 'Harbor';
      return n.name;
    });
    assert.deepEqual(axControls, expanded ? ['Studio',...expected] : expected);

  }
  assert.equal(record.observations.corrections.pointer.focusVisible, false);
  assert.equal(record.observations.corrections.pointer.scrollBefore, record.observations.corrections.pointer.scrollAfter);
  assert.equal(record.observations.corrections.columns.length, 3);
  for (const percent of [100,125,200]) {
    const {short,long} = record.observations.corrections.columns.find(c => c.percent === percent);
    for (const name of ['canvasTop','toolbarRoom','roomContext','contextWorlds','contextAgents','canvasWorlds','worldsTop']) assert.ok(Math.abs(short[name]-long[name]) <= 0.01);
    for (const v of [short,long]) assert.deepEqual([v.toolbarRoom,v.roomContext,v.contextWorlds,v.contextAgents,v.inspectorSample], [8,8,12,12,12*percent/100]);
    assert.ok(long.inspectorHeight > short.inspectorHeight); assert.ok(Math.abs((long.sampleTop-short.sampleTop)-(long.inspectorHeight-short.inspectorHeight)) <= 0.01);
  }
  for (const [path, expected] of Object.entries(record.sourceSha256)) assert.equal(hash(readFileSync(resolve(repo, path))), expected, path);
  assert.equal(hash(readFileSync(resolve(__dirname, 'capture-us-035.cjs'))), record.toolingSha256);
  const report = readFileSync(resolve(repo, 'docs/verification/us-035-world-previews-expansion.md'), 'utf8');
  for (const [, link] of report.matchAll(/\]\(([^)]+)\)/g)) if (!/^https?:/.test(link)) readFileSync(resolve(repo, 'docs/verification', link.split('#')[0]));
  git(['diff', '--check']);
  console.log(`PASS: 73 PNGs decoded/hash/dimension/image-layout correspondence; three exact decoded crops; 20 continuity cycles; six text/focus cases; ${Object.keys(record.sourceSha256).length} source/historical hashes; ${negatives + 1} negative integrity checks; exact ${scope.tracked.length} tracked / ${scope.untracked.length} untracked files; report links; empty index.`);
  app.quit();
}
module.exports = { auditScope, validateManifest, negativeChecks };
if (resolve(process.argv[1] ?? '') === __filename) run().catch(error => { console.error(error); app.exit(1); });
