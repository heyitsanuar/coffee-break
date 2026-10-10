// Original Electron renderer captures; fixture input and Chromium keyboard are explicitly synthetic.
const { app, BrowserWindow, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const repo = resolve(__dirname, '../../..'), output = resolve(repo, 'docs/verification/assets/us-034');
const base = process.argv[2] ?? 'http://localhost:5173';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(done => setTimeout(done, ms));
const synthetic = 'Production Application/store/runtime/scene; synthetic accepted US-031 fixture inputs. Chromium input is not manual native verification.';
const record = { baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['branch', '--show-current'], { cwd: repo, encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--short'], { cwd: repo, encoding: 'utf8' }), capturedAt: new Date().toISOString(),
  electron: process.versions.electron, platform: process.platform, captures: [], observations: {} };

// Check decoded border pixels against recorded CSS bounds, allowing native color conversion.
function verifyImage(png, geometry) {
  const image = nativeImage.createFromBuffer(png), size = image.getSize(), bytes = image.toBitmap();
  assert.equal(image.isEmpty(), false); assert.deepEqual([size.width, size.height], geometry.viewport.map(v => v * geometry.dpr));
  const matches = (x, y, rgb, tolerance = 10) => {
    const k = (y * size.width + x) * 4;
    return bytes[k + 3] === 255 && ([rgb, [...rgb].reverse()].some(channels => channels.every((v, i) => Math.abs(v - bytes[k + i]) <= tolerance)));
  };
  const checks = [];
  for (const [name, item] of Object.entries(geometry.borders)) {
    if (!item.visible) continue;
    const { x, y, width, height } = item.bounds, rgb = item.rgb, scale = geometry.dpr;
    const left = Math.ceil((x + 10) * scale), right = Math.floor((x + width - 10) * scale);
    if (left < 0 || right >= size.width || right <= left) continue;
    for (const [edge, expected] of [['top', y * scale], ['bottom', (y + height - 1) * scale]]) {
      if (expected < 2 || expected >= size.height - 2) continue;
      let best = { fraction: 0, row: null };
      for (let row = Math.max(0, Math.floor(expected) - 2); row <= Math.min(size.height - 1, Math.ceil(expected) + 2); row++) {
        let count = 0; for (let col = left; col < right; col++) if (matches(col, row, rgb)) count++;
        const fraction = count / (right - left); if (fraction > best.fraction) best = { fraction, row };
      }
      assert.ok(best.fraction >= 0.9, name + ' ' + edge + ': image/layout mismatch ' + JSON.stringify({ expected, best }));
      checks.push({ name, edge, expected, observed: best.row, fraction: best.fraction, tolerancePhysicalPx: 2, channelTolerance: 10 });
    }
    // A tall open panel can fill the viewport with both horizontal edges offscreen.
    const top = Math.max(0, Math.ceil((y + 10) * scale)), bottom = Math.min(size.height, Math.floor((y + height - 10) * scale));
    if (bottom <= top) continue;
    for (const [edge, expected] of [['left', x * scale], ['right', (x + width - 1) * scale]]) {
      if (expected < 2 || expected >= size.width - 2) continue;
      let best = { fraction: 0, column: null };
      for (let col = Math.floor(expected) - 2; col <= Math.ceil(expected) + 2; col++) {
        let count = 0; for (let row = top; row < bottom; row++) if (matches(col, row, rgb)) count++;
        const fraction = count / (bottom - top); if (fraction > best.fraction) best = { fraction, column: col };
      }
      assert.ok(best.fraction >= 0.9, name + ' ' + edge + ': image/layout mismatch ' + JSON.stringify({ expected, best }));
      checks.push({ name, edge, expected, observed: best.column, fraction: best.fraction, tolerancePhysicalPx: 2, channelTolerance: 10 });
    }
  }
  if (geometry.focusClearance) {
    const { disclaimer, outline, textRgb, outlineRgb, clearance } = geometry.focusClearance, scale = geometry.dpr;
    assert.ok(clearance > 0, 'F1: focus outline overlaps disclaimer rendered bounds');
    assert.ok(outline.x >= 0 && outline.y >= 0 && outline.x + outline.width <= geometry.viewport[0] && outline.y + outline.height <= geometry.viewport[1], 'F1: focus outline clipped');
    let inkBottom = -1, inkPixels = 0;
    for (let row = Math.max(0, Math.floor(disclaimer.y * scale)); row < Math.min(size.height, Math.ceil((disclaimer.y + disclaimer.height) * scale)); row++) {
      for (let col = Math.max(0, Math.floor(disclaimer.x * scale)); col < Math.min(size.width, Math.ceil((disclaimer.x + disclaimer.width) * scale)); col++) {
        if (matches(col, row, textRgb, 20)) { inkBottom = row; inkPixels++; }
      }
    }
    assert.ok(inkPixels > 0, 'F1: disclaimer glyph pixels not found');
    const left = Math.ceil((outline.x + 12) * scale), right = Math.floor((outline.x + outline.width - 12) * scale);
    const bandRows = [];
    for (let row = Math.floor(outline.y * scale); row < Math.ceil((outline.y + 3) * scale); row++) {
      // Native PNG conversion shifts cyan red by 15 here; border tolerance remains 10.
      let count = 0; for (let col = left; col < right; col++) if (matches(col, row, outlineRgb, 20)) count++;
      if (count / (right - left) >= 0.9) bandRows.push(row);
    }
    assert.ok(bandRows.length > 0, 'F1: decoded cyan focus band not found at recorded outer bounds');
    const decodedClearance = (bandRows[0] - inkBottom - 1) / scale;
    assert.ok(decodedClearance > 0, 'F1: decoded focus band obscures disclaimer glyphs');
    checks.push({ name: 'disclosure-focus', edge: 'top', renderedClearance: clearance, decodedGlyphBottom: inkBottom,
      decodedOutlineTop: bandRows[0], decodedClearance, inkPixels, channelTolerance: 20 });
  }
  assert.ok(checks.length > 0, 'No visible borders to verify image/layout correspondence');
  return checks;
}

async function run() {
  process.env.ELECTRON_RENDERER_URL = base; process.env.COFFEE_BREAK_LOCAL_SIMULATION = '1';
  await import(pathToFileURL(resolve(__dirname, '../out/main/main.js')).href); await app.whenReady();
  const win = BrowserWindow.getAllWindows()[0]; assert.ok(win);
  win.setTitle('US-034 Automated Evidence'); win.show(); win.focus(); win.webContents.setBackgroundThrottling(false);
  mkdirSync(output, { recursive: true }); const errors = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  const invoke = code => js("import([...document.scripts].find(s=>s.src&&new URL(s.src).pathname==='/verification/us-031.tsx').src).then(async({fixture})=>{" + code + '})');
  const layout = () => js('(' + (() => {
    const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const query = s => document.querySelector(s), panel = query('.agent-inspection'), sample = query('.sample-activity');
    const border = (element, rgb, visible = true) => ({ bounds: box(element), rgb, visible });
    const rows = [...query('.sample-activity-list').children];
    const staticSample = sample.cloneNode(true); staticSample.querySelector('details').removeAttribute('open');
    const summary = query('summary'), disclaimer = query('.sample-project > p'), summaryStyle = getComputedStyle(summary);
    let focusClearance = null;
    if (document.activeElement === summary && summary.matches(':focus-visible')) {
      const summaryBox = box(summary), disclaimerBox = box(disclaimer), range = document.createRange(); range.selectNodeContents(disclaimer);
      const rendered = range.getBoundingClientRect(), inset = parseFloat(summaryStyle.outlineWidth) + parseFloat(summaryStyle.outlineOffset);
      const rgb = value => value.match(/\d+/g).slice(0, 3).map(Number);
      focusClearance = { disclaimer: disclaimerBox, renderedText: { x: rendered.x, y: rendered.y, width: rendered.width, height: rendered.height },
        outline: { x: summaryBox.x - inset, y: summaryBox.y - inset, width: summaryBox.width + inset * 2, height: summaryBox.height + inset * 2 },
        clearance: summaryBox.y - inset - Math.max(disclaimerBox.y + disclaimerBox.height, rendered.bottom),
        marginTop: getComputedStyle(query('details')).marginTop, textRgb: rgb(getComputedStyle(disclaimer).color), outlineRgb: rgb(summaryStyle.outlineColor) };
    }
    return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, rootFont: getComputedStyle(document.documentElement).fontSize,
      scroll: [scrollX, scrollY], document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      overflow: document.documentElement.scrollWidth > innerWidth, canvases: document.querySelectorAll('canvas').length,
      canvas: box(query('canvas')), rail: box(query('.contextual-rail')), inspector: box(panel), sample: box(sample),
      inspectorStyle: { padding: getComputedStyle(panel).padding, minHeight: getComputedStyle(panel).minHeight },
      summary: box(query('summary')), clear: box(query('.clear-selection-button')), clearGuarded: query('.clear-selection-button').getAttribute('aria-disabled'),
      selected: query('.agent-inspection h2').textContent, detailsText: query('.agent-inspection-details').textContent,
      lifecycle: query('.agent-inspection-lifecycle')?.textContent ?? null, freshness: query('.agent-inspection-freshness')?.textContent ?? null,
      focused: document.activeElement.id || document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim(),
      focusStyle: { outline: getComputedStyle(document.activeElement).outline, offset: getComputedStyle(document.activeElement).outlineOffset },
      focusClearance,
      open: query('details').open, sampleText: sample.textContent, sampleHtml: staticSample.innerHTML,
      rowBounds: rows.map(box), textBounds: [...sample.querySelectorAll('h2,h3,p,dt,dd,.sample-activity-name,.sample-activity-time')].map(e => ({ text: e.textContent, bounds: box(e), scrollWidth: e.scrollWidth, clientWidth: e.clientWidth })),
      borders: { office: border(query('.office-scene-host'), [99, 125, 153]), inspector: border(panel, [36, 59, 82], panel.dataset.selected === 'true'), sample: border(sample, [36, 59, 82]) } };
  }).toString() + ')()');
  const ready = async fixture => {
    for (let i = 0; i < 80; i++) {
      if (await js("document.querySelectorAll('canvas').length===1&&!!document.querySelector('.sample-activity')") &&
        (!fixture || await invoke('return !!fixture.scene()?.children.list.length;'))) { await wait(120); return; }
      await wait(100);
    } throw new Error('Renderer initialization timed out');
  };
  const resize = async (w, h) => { win.setSize(w, h); await wait(100); assert.deepEqual(win.getSize(), [w, h]); };
  const settle = () => js('new Promise((resolve,reject)=>{let last="",stable=0,frames=0;const timer=setTimeout(()=>reject(new Error("Layout settlement timeout")),2500);const sample=()=>{const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};const state={scroll:[scrollX,scrollY],viewport:[innerWidth,innerHeight],font:getComputedStyle(document.documentElement).fontSize,boxes:[...document.querySelectorAll(".agent-inspection,.sample-activity,summary,.clear-selection-button,.sample-activity-list li,canvas")].map(rect)};const next=JSON.stringify(state);stable=next===last?stable+1:0;last=next;frames++;if(stable>=3){clearTimeout(timer);resolve({frames,consecutiveStableFrames:stable+1})}else requestAnimationFrame(sample)};requestAnimationFrame(sample)})');
  const invariant = g => {
    assert.equal(g.canvases, 1); assert.equal(g.overflow, false); assert.equal(g.canvas.width, 640); assert.equal(g.canvas.height, 360);
    assert.ok(g.clear.width >= 44 && g.clear.height >= 44 && g.summary.height >= 44);
    assert.ok(Math.abs(g.sample.y - g.inspector.y - g.inspector.height - parseFloat(g.rootFont) * 0.75) < 0.01);
    assert.equal(g.rowBounds.length, 3); assert.ok(g.rowBounds.every(row => row.height >= 76));
    assert.ok(g.sampleText.includes('Fixed example sequence · Not runtime history'));
    for (const text of g.textBounds) assert.ok(text.scrollWidth <= text.clientWidth + 1, 'Text overflow: ' + text.text);
  };
  const capture = async (name, provenance = synthetic) => {
    let result, failure;
    for (let attempt = 1; attempt <= 6; attempt++) {
      const settlement = { attempt, ...await settle() }, before = await layout(); invariant(before);
      const png = (await win.webContents.capturePage()).toPNG(), after = await layout();
      try {
        assert.deepEqual(after, before, 'Layout changed during capture');
        const correspondence = verifyImage(png, before);
        result = { name, provenance, outer: win.getSize(), contentBounds: win.getContentBounds(), ...before,
          imageSize: nativeImage.createFromBuffer(png).getSize(), pngSha256: hash(png), settlement, correspondence,
          trustedState: provenance === synthetic ? await invoke('return fixture.snapshot();') : null,
          presentation: provenance === synthetic ? await invoke('return fixture.presentation();') : null };
        writeFileSync(resolve(output, name + '.png'), png); failure = undefined; break;
      } catch (error) { failure = error; }
    }
    if (failure) throw failure; record.captures.push(result); return result;
  };
  const select = async index => { await js('document.querySelectorAll(".agent-selector-button")[' + index + '].click()'); await wait(40); };
  const scrollRail = () => js("document.querySelector('.agent-inspection').scrollIntoView({block:'start',behavior:'instant'})");
  await ready(false); await wait(4500);
  for (const [w, h] of [[1100, 760], [760, 540]]) { await resize(w, h); await js('scrollTo(0,0)'); await capture(w + '-production', 'Production root; authenticated local simulation; no fixture inputs'); }
  win.webContents.debugger.attach('1.3'); await win.webContents.loadURL(base + '/verification/us-031.html'); await ready(true);
  const key = async (key, code, virtual, modifiers = 0) => {
    const payload = { key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual, modifiers };
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', ...payload, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', ...payload }); await wait(60);
  };
  await resize(1100, 760); await scrollRail(); await capture('1100-unselected'); await select(1); await scrollRail();
  const unchanged = await js("document.querySelector('.sample-activity').innerHTML");
  for (const lifecycle of ['idle', 'working', 'waiting', 'completed', 'error']) {
    await invoke("fixture.update('mock-agent-mina'," + JSON.stringify(lifecycle) + ',' + JSON.stringify('Exact ' + lifecycle) + ')');
    assert.equal((await layout()).lifecycle, lifecycle[0].toUpperCase() + lifecycle.slice(1)); assert.equal((await layout()).freshness, 'Current information');
    assert.equal((await layout()).sampleHtml, unchanged);
  }
  await capture('current-error');
  await invoke("fixture.update('mock-agent-mina','waiting','Waiting for approval','approval_required')"); await capture('current-approval');
  await invoke("fixture.connection('disconnected')"); await capture('retained');
  assert.equal((await layout()).freshness, 'Last known · Not live'); const retained = (await layout()).detailsText;
  await invoke("fixture.connection('synchronizing')"); await capture('synchronizing');
  assert.equal((await layout()).detailsText, retained); assert.equal((await layout()).sampleHtml, unchanged);
  await invoke("fixture.connection('ready')"); assert.equal((await layout()).freshness, 'Current information');
  await invoke("await fixture.reset('unavailable')"); await ready(true); await capture('selected-no-state');
  assert.equal((await layout()).selected, 'Mina'); assert.equal((await layout()).lifecycle, null); assert.equal((await layout()).freshness, null);
  await invoke("await fixture.reset('live')"); await ready(true);
  for (const activity of ['Taking a coffee break in the simulated office', 'Generic waiting']) {
    await invoke("fixture.update('mock-agent-sol','waiting'," + JSON.stringify(activity) + ')'); await select(2);
    assert.equal((await layout()).lifecycle, 'Waiting'); assert.equal((await layout()).detailsText.includes(activity), true);
    assert.equal((await layout()).sampleHtml, unchanged);
  }
  record.observations.trustedSemanticsAndSampleIsolation = true;
  record.observations.keyboard = [];
  for (const [w, h] of [[1100, 760], [760, 540]]) {
    await resize(w, h); await js('document.getElementById("agents-section-title").focus()');
    for (let i = 0; i < 3; i++) { await key('Tab', 'Tab', 9); assert.ok((await layout()).focused.startsWith('Select ' + ['Ari', 'Mina', 'Sol'][i])); await key('Enter', 'Enter', 13); }
    await key('Tab', 'Tab', 9); assert.equal((await layout()).focused, 'Clear selection'); await key(' ', 'Space', 32);
    assert.equal((await layout()).selected, 'Select an inhabitant'); assert.equal((await layout()).focused, 'Clear selection'); assert.equal((await layout()).clearGuarded, 'true');
    await key('Tab', 'Tab', 9); assert.equal((await layout()).focused, 'Project context for Harbor — fictional example');
    assert.ok((await layout()).focusStyle.outline.includes('3px')); await key(' ', 'Space', 32); assert.equal((await layout()).open, true);
    await capture(w + '-disclosure-keyboard-open');
    const before = await layout(); await js('window.us034Details=document.querySelector("details");window.us034Summary=document.querySelector("summary");window.us034Clear=document.querySelector(".clear-selection-button")');
    await invoke("fixture.update('mock-agent-ari','working','Updated while disclosure focused');fixture.connection('disconnected');fixture.connection('synchronizing');fixture.connection('ready')");
    assert.equal(await js('window.us034Details===document.querySelector("details")&&window.us034Summary===document.querySelector("summary")&&window.us034Clear===document.querySelector(".clear-selection-button")'), true);
    assert.equal((await layout()).focused, before.focused); assert.equal((await layout()).open, true); assert.deepEqual((await layout()).scroll, before.scroll); assert.equal((await layout()).sampleHtml, unchanged);
    await key('Enter', 'Enter', 13); assert.equal((await layout()).open, false); await key('Tab', 'Tab', 9, 8); assert.equal((await layout()).focused, 'Clear selection');
    await js('document.querySelectorAll(".homepage-navigation button")[2].click()');
    assert.equal(await js('document.activeElement.id'), 'projects-section-title'); assert.equal((await layout()).open, false); assert.equal((await layout()).selected, 'Select an inhabitant');
    await capture(w + '-projects-focus');
    await select(0); await js('document.querySelector("summary").click()'); assert.equal((await layout()).open, true);
    await js('document.querySelectorAll(".homepage-navigation button")[2].click()'); assert.equal((await layout()).selected, 'Ari'); assert.equal((await layout()).open, true);
    record.observations.keyboard.push({ outer: [w, h], clearFocusRetained: true, nativeDisclosureChromiumActivation: true, stableFocusNodesScrollAndOpenState: true, projectsKeepsSelectionAndDisclosure: true });
    await js('document.querySelector("summary").click()');
  }
  record.observations.text = [];
  for (const [w, h] of [[1100, 760], [760, 540]]) for (const percent of [100, 125, 200]) {
    await resize(w, h); await js('document.documentElement.style.fontSize=' + JSON.stringify(percent + '%'));
    await invoke("fixture.update('mock-agent-mina','working','Short activity')"); await select(1); await scrollRail();
    const short = await layout(); await capture(w + '-text-' + percent + '-closed');
    await js('document.querySelector("summary").click()');
    const open = await layout(); assert.ok(open.rowBounds[0].y > short.rowBounds[0].y); await js('document.querySelector(".sample-activity").scrollIntoView({block:"start",behavior:"instant"})');
    await capture(w + '-text-' + percent + '-open');
    if (percent > 100) {
      await js('document.querySelector(".sample-project-details dl").scrollIntoView({block:"start",behavior:"instant"})');
      await capture(w + '-text-' + percent + '-identifiers');
      await js('document.querySelector(".sample-activity-list").scrollIntoView({block:"end",behavior:"instant"})');
      await capture(w + '-text-' + percent + '-rows');
    }
    await invoke("fixture.update('mock-agent-mina','waiting'," + JSON.stringify('Literal first line\n' + 'unbroken'.repeat(60)) + ",'capacity_exhausted')");
    await scrollRail(); const long = await layout(); assert.ok(long.inspector.height > short.inspector.height); assert.ok(long.sample.y > short.sample.y);
    await capture(w + '-text-' + percent + '-long');
    record.observations.text.push({ outer: [w, h], percent, shortInspectorHeight: short.inspector.height, longInspectorHeight: long.inspector.height,
      disclosureRowDisplacement: open.rowBounds[0].y - short.rowBounds[0].y, railWidth: long.rail.width, overflow: long.overflow });
    await js('document.querySelector("summary").click()');
  }
  record.observations.f1Focus = [];
  for (const [w, h] of [[1100, 760], [760, 540]]) for (const percent of [100, 125, 200]) {
    await resize(w, h); await js('document.documentElement.style.fontSize=' + JSON.stringify(percent + '%'));
    await invoke("fixture.update('mock-agent-mina','working','Short activity')"); await select(1);
    assert.equal((await layout()).open, false);
    await js('document.querySelector(".clear-selection-button").focus()'); await key('Tab', 'Tab', 9);
    assert.equal((await layout()).focused, 'Project context for Harbor — fictional example');
    for (const state of ['closed', 'open']) {
      if (state === 'open') await key(' ', 'Space', 32);
      await js('document.querySelector("summary").scrollIntoView({block:"center",behavior:"instant"})');
      const evidence = await capture(w + '-focus-text-' + percent + '-' + state);
      assert.equal(evidence.open, state === 'open'); assert.ok(evidence.focusClearance.clearance > 0);
      assert.equal(await js('getComputedStyle(document.querySelector("summary")).display'), 'list-item');
      record.observations.f1Focus.push({ name: evidence.name, outer: [w, h], percent, state,
        ...evidence.focusClearance, decoded: evidence.correspondence.find(c => c.name === 'disclosure-focus') });
    }
    await key('Enter', 'Enter', 13); assert.equal((await layout()).open, false);
  }
  await js('document.documentElement.style.fontSize=""'); await resize(1100, 760);
  const selectedBeforeNavigation = (await layout()).selected; const url = win.webContents.getURL();
  await js('document.querySelectorAll(".homepage-navigation button")[2].click()'); assert.equal(win.webContents.getURL(), url); assert.equal((await layout()).selected, selectedBeforeNavigation);
  win.webContents.reload(); await wait(250); await ready(true); assert.equal((await layout()).open, false); assert.equal((await layout()).selected, 'Select an inhabitant');
  record.observations.reloadOneCanvasUnselectedClosedDisclosure = true;
  await win.webContents.debugger.sendCommand('Accessibility.enable'); const ax = await win.webContents.debugger.sendCommand('Accessibility.getFullAXTree');
  record.observations.accessibility = ax.nodes.filter(n => ['region', 'list', 'DisclosureTriangle', 'heading'].includes(n.role?.value)).map(n => ({ role: n.role.value, name: n.name?.value }));
  assert.ok(record.observations.accessibility.some(n => n.role === 'region' && n.name === 'Recent Activity — Sample'));
  assert.ok(record.observations.accessibility.some(n => n.role === 'list' && n.name === 'Fixed sample activity sequence'));
  assert.ok(record.observations.accessibility.some(n => n.name === 'Project context for Harbor — fictional example'));
  assert.equal(errors.length, 0, JSON.stringify(errors)); record.observations.rendererErrors = errors;
  const paths = execFileSync('git', ['ls-files', 'apps/desktop/src', 'apps/desktop/electron', 'apps/desktop/shared', 'packages/contracts', 'docs/design/references', 'docs/verification/assets/us-031', 'docs/verification/assets/us-032', 'docs/verification/assets/us-033', 'apps/desktop/verification/us-031.tsx', 'apps/desktop/verification/us-031.html', 'package.json', 'package-lock.json'], { cwd: repo, encoding: 'utf8' }).trim().split('\n');
  paths.push('apps/desktop/src/office/SampleActivity.tsx');
  record.sourceSha256 = Object.fromEntries(paths.map(p => [p, hash(readFileSync(resolve(repo, p)))]));
  record.toolingSha256 = hash(readFileSync(__filename));
  writeFileSync(resolve(output, 'capture-record.json'), JSON.stringify(record, null, 2) + '\n');
  console.log('PASS US-034: ' + record.captures.length + ' original captures; trusted cases, static Sample, keyboard/navigation, text growth, image/layout correspondence, reload and AX semantics.');
}
module.exports = { verifyImage };
if (resolve(process.argv[1] ?? '') === __filename) run().then(() => app.quit()).catch(error => { console.error(error); app.exit(1); });
