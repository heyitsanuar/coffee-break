// Runs the built production main/window, then a production-component fixture.
// Chromium automation is not native keyboard or assistive-technology evidence.
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback development URL');
const output = resolve(__dirname, '../../../docs/verification/assets/us-029');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(done => setTimeout(done, ms));

async function run() {
  // Same main entry, preload, security flags, native frame and simulator ownership as dev:simulated.
  process.env.ELECTRON_RENDERER_URL = base;
  process.env.COFFEE_BREAK_LOCAL_SIMULATION = '1';
  await import(pathToFileURL(resolve(__dirname, '../out/main/main.js')).href);
  await app.whenReady();
  const win = BrowserWindow.getAllWindows()[0];
  assert.ok(win, 'Production main must create its window');
  const errors = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const record = { baseline: '6f54c86c1d9a1b0677c21ac77d37dfb73b5b407e', capturedAt: new Date().toISOString(),
    electron: process.versions.electron, platform: process.platform,
    provenance: 'Unedited capturePage of the native framed window created by production main. Initial production-root captures use the real development simulator/preload/store path. Later captures use production Application/store/runtime/host/Phaser with synthetic accepted renderer inputs. Chromium input/media automation is not native manual accessibility evidence. No frame-height constant or useContentSize override.',
    sourceSha256: {}, captures: [], observations: {} };
  mkdirSync(output, { recursive: true });
  for (const path of ['src/style.css', 'src/Application.tsx', 'src/office/OfficeSceneHost.tsx', 'src/office/AgentSelector.tsx',
    'src/office/AgentInspectionPanel.tsx', 'src/office/SelectedAgentSummary.tsx', 'src/office/OfficeScene.ts',
    'src/office/officeLayout.ts', 'src/office/createOfficeGame.ts', 'src/office/officePresentationRuntime.ts',
    'electron/main.ts', 'verification/us-029.tsx', 'verification/us-029.html', 'verification/capture-us-029.cjs']) {
    record.sourceSha256[path] = hash(readFileSync(resolve(__dirname, '..', path)));
  }
  const js = async code => {
    try { return await win.webContents.executeJavaScript(code); }
    catch (error) { console.error('Renderer query failed:', code, 'Renderer errors:', errors); throw error; }
  };
  const settle = () => wait(150);
  async function ready() {
    for (let i = 0; i < 100; i++) {
      if (await js("document.querySelectorAll('canvas').length===1&&document.body.innerText.includes('Connected')")) {
        // A fixture reset can replace the game between queries; wait for its current canvas.
        const rect = await js("(()=>{const canvas=document.querySelector('canvas');if(!canvas)return null;const r=canvas.getBoundingClientRect();return{x:r.x,y:r.y}})()");
        if (!rect) { await wait(100); continue; }
        const image = await win.webContents.capturePage({ x: Math.round(rect.x), y: Math.round(rect.y), width: 640, height: 360 });
        const bytes = image.toBitmap(), colors = new Set();
        for (let j = 0; j < bytes.length; j += 64) colors.add(bytes.subarray(j, j + 3).toString('hex'));
        if (colors.size > 10) { await settle(); return; }
      }
      await wait(100);
    }
    throw new Error('Actual office artwork/connected state did not load');
  }
  const state = () => js(`({selected:document.querySelector('[aria-pressed=true]')?.getAttribute('aria-label')??null,
    name:document.querySelector('#agent-inspection-title').textContent,
    lifecycle:document.querySelector('.agent-inspection-lifecycle')?.textContent??null,
    freshness:document.querySelector('.agent-inspection-freshness')?.textContent??null,
    summary:document.querySelector('.selected-agent-summary')?.textContent??null,
    activity:document.querySelector('dd')?.textContent??null,
    details:document.querySelector('#agent-inspection-details').textContent,
    focus:document.activeElement.getAttribute('aria-label')??document.activeElement.textContent,
    scroll:scrollY,canvases:document.querySelectorAll('canvas').length})`);
  const layout = async () => ({ nativeBounds: win.getBounds(), contentBounds: win.getContentBounds(), zoom: win.webContents.getZoomFactor(),
    ...await js(`(()=>{const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
      return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
      documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,scroll:scrollY,
      header:rect('.application-header'),host:rect('.office-scene-host'),room:rect('canvas'),context:rect('.office-context'),roster:rect('.agent-selector'),
      summary:rect('.selected-agent-summary'),dock:rect('.agent-inspection'),controls:Array.from(document.querySelectorAll('button')).map(e=>{const r=e.getBoundingClientRect();return{name:e.getAttribute('aria-label')??e.textContent,width:r.width,height:r.height}}),
      summaryDisplay:document.querySelector('.selected-agent-summary')?getComputedStyle(document.querySelector('.selected-agent-summary')).display:null,
      inspectorOverflow:getComputedStyle(document.querySelector('.agent-inspection')).overflowY,
      activityWhiteSpace:document.querySelector('dd')?getComputedStyle(document.querySelector('dd')).whiteSpace:null,
      fonts:Array.from(document.querySelectorAll('h1,h2,.connection-status,.office-context,.agent-selector-button,.selected-agent-summary,dd')).map(e=>({tag:e.tagName,class:e.className,font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}))};})()`), state: await state() });
  async function capture(name, input = 'synthetic accepted renderer inputs') {
    const geometry = await layout(), image = await win.webContents.capturePage(), png = image.toPNG();
    assert.equal(image.isEmpty(), false);
    writeFileSync(`${output}/${name}.png`, png);
    record.captures.push({ name, classification: 'direct production Electron capture', input, sampledAt: new Date().toISOString(),
      size: image.getSize(), pngSha256: hash(png), ...geometry });
    return geometry;
  }
  const select = async name => { await js(`document.querySelector('[aria-label="Select ${name}"]').click()`); await settle(); };
  const resize = async (width, height) => { win.setSize(width, height); await settle(); };
  const invariant = geometry => {
    assert.equal(geometry.horizontalOverflow, false); assert.equal(geometry.state.canvases, 1);
    assert.equal(geometry.room.width, 640); assert.equal(geometry.room.height, 360);
    assert.equal(geometry.host.width, 642); assert.equal(geometry.host.height, 362); assert.equal(geometry.host.x, 24);
    assert.equal(geometry.inspectorOverflow, 'visible');
    for (const control of geometry.controls.slice(0, 3)) assert.ok(control.height >= 44);
  };
  // Import the actual Vite script URL, including any cache-busting query, exactly once.
  const invoke = async code => {
    const url = await js("document.querySelector('script[src*=\"us-029.tsx\"]').src");
    return js(`import(${JSON.stringify(url)}).then(async ({fixture})=>{${code}})`);
  };
  const update = (name, next, activity, reason) => invoke(`fixture.update('mock-agent-'+${JSON.stringify(name.toLowerCase())},${JSON.stringify(next)},${JSON.stringify(activity)},${JSON.stringify(reason)})`);
  const pointer = async (x, y) => {
    const r = (await layout()).room, point = { x: Math.round(r.x + x), y: Math.round(r.y + y) };
    for (const event of [{ type: 'mouseMove' }, { type: 'mouseDown', button: 'left', clickCount: 1 }, { type: 'mouseUp', button: 'left', clickCount: 1 }]) win.webContents.sendInputEvent({ ...event, ...point });
    await settle();
  };
  {
    await ready(); await select('Mina');
    const nativeDesktop = await capture('a-production-native-desktop', 'production root: authenticated local development simulator'); invariant(nativeDesktop);
    await resize(760, 540);
    const nativeMinimum = await capture('b-production-native-minimum', 'production root: authenticated local development simulator'); invariant(nativeMinimum);
    assert.ok(nativeMinimum.room.bottom <= nativeMinimum.viewport[1]); assert.ok(nativeMinimum.summary.bottom <= nativeMinimum.viewport[1]);
    record.observations.productionNativeTargets = [nativeDesktop, nativeMinimum];

    await win.loadURL(`${base}/verification/us-029.html`); await ready();
    await update('Ari', 'working', 'Implementing the change.'); await update('Mina', 'waiting', 'Waiting for approval.', 'approval_required');
    await update('Sol', 'waiting', 'Taking a coffee break in the simulated office'); await select('Mina');
    const minimum = await capture('c-fixture-native-minimum'); invariant(minimum);
    assert.ok(minimum.summary.bottom <= minimum.viewport[1]); assert.equal(minimum.header.height, 40);
    await resize(1100, 760); const desktop = await capture('d-fixture-native-desktop'); invariant(desktop); assert.equal(desktop.dock.width, 304);
    // Edge of enlarged invisible world targets, outside the visible sprite.
    await pointer(292 - 23, 174 - 55); assert.equal((await state()).selected, 'Select Ari');
    const desktopPointer = await capture('e-desktop-pointer-ari');
    await resize(760, 540); await pointer(480 - 23, 174 - 55); assert.equal((await state()).selected, 'Select Mina');
    await capture('e-minimum-pointer-mina');
    await pointer(292 - 25, 174 - 55); assert.equal((await state()).selected, 'Select Mina');
    record.observations.pointer = { desktop: { x: 269, y: 119, selected: desktopPointer.state.selected }, minimum: { x: 457, y: 119, selected: 'Select Mina' }, outsideAriDoesNotSelect: true, expectedWorldTargets: [48, 64] };

    win.webContents.debugger.attach('1.3');
    const key = async (key, code, virtual, modifiers = 0) => {
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: virtual, modifiers,
        ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual, modifiers }); await settle();
    };
    // Programmatic initial anchor only; subsequent navigation/activation is Chromium keyboard input.
    await js("document.querySelector('[aria-label=\"Select Ari\"]').focus()"); await key('Tab', 'Tab', 9);
    assert.equal((await state()).focus, 'Select Mina'); await key('Tab', 'Tab', 9);
    assert.equal((await state()).focus, 'Select Sol'); assert.equal((await state()).selected, 'Select Mina');
    assert.equal(await js("document.activeElement.matches(':focus-visible')"), true);
    await capture('f-focused-sol-selected-mina');
    await js("window.us029Nodes={canvas:document.querySelector('canvas'),sol:document.querySelector('[aria-label=\"Select Sol\"]'),clear:document.querySelector('.clear-selection-button')}");
    record.observations.widthMatrix = [];
    for (const width of [1012, 1011, 1000, 900, 800, 760]) {
      await resize(width, 700);
      const value = await capture(`g-width-${width}`); invariant(value);
      assert.equal(value.state.focus, 'Select Sol'); assert.equal(value.state.selected, 'Select Mina');
      assert.equal(value.summaryDisplay, width >= 1012 ? 'none' : 'block');
      assert.equal(value.dock.width, width >= 1012 ? 304 : 642);
      assert.equal(await js("window.us029Nodes.canvas===document.querySelector('canvas')&&window.us029Nodes.sol===document.querySelector('[aria-label=\"Select Sol\"]')&&window.us029Nodes.clear===document.querySelector('.clear-selection-button')"), true);
      record.observations.widthMatrix.push(value);
    }
    record.observations.sameMountedControlsAndCanvasAcrossBreakpoint = true;
    record.observations.heightMatrix = [];
    // Native frame measured at each size; assertions use actual renderer height.
    for (const height of [760, 700, 640, 600, 588, 587, 540]) {
      await resize(760, height); const value = await layout(); invariant(value);
      assert.equal(value.header.height, value.viewport[1] <= 560 ? 40 : 56);
      record.observations.heightMatrix.push(value);
    }
    await key('Tab', 'Tab', 9); assert.equal(await js("document.activeElement===document.querySelector('.clear-selection-button')"), true);
    await key(' ', 'Space', 32); assert.equal((await state()).selected, null);
    assert.equal(await js("document.activeElement===window.us029Nodes.clear&&document.activeElement.matches(':focus-visible')"), true);
    await capture('h-keyboard-clear');
    await key('Tab', 'Tab', 9, 8); assert.equal((await state()).focus, 'Select Sol');
    await key('Tab', 'Tab', 9, 8); assert.equal((await state()).focus, 'Select Mina');
    await key(' ', 'Space', 32); assert.equal((await state()).selected, 'Select Mina');
    await key('Tab', 'Tab', 9, 8); assert.equal((await state()).focus, 'Select Ari');
    await key('Enter', 'Enter', 13); assert.equal((await state()).selected, 'Select Ari');
    await key('Tab', 'Tab', 9); await key(' ', 'Space', 32); assert.equal((await state()).selected, 'Select Mina');
    await js('scrollTo(0,0)'); const focused = await state();
    await update('Mina', 'working', 'Reviewing the change.'); await settle();
    assert.equal((await state()).focus, focused.focus); assert.equal((await state()).scroll, focused.scroll);
    await update('Mina', 'waiting', 'Waiting for approval.', 'approval_required'); await settle();
    await invoke("fixture.connection('disconnected')"); await settle();
    let retained = await capture('i-retained-minimum'); invariant(retained);
    assert.equal(retained.state.lifecycle, 'Waiting'); assert.equal(retained.state.freshness, 'Last known · Not live'); assert.ok(retained.state.summary.includes('Last known'));
    assert.equal(retained.state.focus, focused.focus); assert.equal(retained.state.scroll, focused.scroll);
    await invoke("fixture.connection('synchronizing')"); await settle(); await capture('i-synchronizing-minimum');
    await invoke("fixture.connection('ready')"); await settle();
    record.observations.keyboard = { reachability: ['Ari', 'Mina', 'Sol', 'Clear selection'], input: 'Chromium Tab/Shift+Tab/Space/Enter; initial focus anchor programmatic', focusDoesNotSelect: true, clearKeepsSameFocusedNode: true, lifecycleAndAvailabilityPreserveFocusAndScroll: true };

    const prose = 'Reviewing the local change and checking that precise activity remains readable while the office, selected identity, keyboard focus and retained information stay coherent. '.repeat(2);
    const unbroken = 'unbroken'.repeat(60);
    const multiline = 'Presentation-only line-break check.\n' + unbroken.slice(0, 440);
    record.observations.longContent = [];
    for (const [name, activity] of [['prose', prose], ['unbroken', unbroken], ['multiline', multiline]]) {
      assert.ok(Buffer.byteLength(activity) <= 512);
      for (const [width, height] of [[1100, 760], [760, 540]]) {
        await resize(width, height); await js('scrollTo(0,0)'); await update('Mina', 'waiting', activity, 'approval_required'); await settle();
        const value = await layout(); invariant(value); assert.equal(value.state.activity, activity); assert.equal(value.activityWhiteSpace, 'pre-wrap');
        await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await settle();
        record.observations.longContent.push({ name, inputBytes: Buffer.byteLength(activity), syntheticMultiline: name === 'multiline', ...await capture(`j-${name}-${width}-inspection`) });
      }
    }
    await update('Mina', 'waiting', prose, 'approval_required'); await js('scrollTo(0,0)');
    await js("document.documentElement.style.fontSize='200%'"); await settle();
    const enlarged = await capture('k-text-200-minimum-top'); invariant(enlarged);
    assert.ok(enlarged.controls.slice(0, 3).every(c => c.height > 44));
    assert.equal(enlarged.state.activity, prose); assert.equal(enlarged.zoom, 1);
    await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await settle(); await capture('k-text-200-minimum-inspection');
    await resize(1100, 760); const enlargedDesktop = await capture('k-text-200-desktop-inspection'); invariant(enlargedDesktop);
    record.observations.textEnlargement = { method: 'Root font-size 200%, inherited/rem DOM text; page zoom remains 1; Phaser/canvas unchanged', minimum: enlarged, desktop: enlargedDesktop };
    await js("document.documentElement.style.fontSize='';scrollTo(0,0)"); await resize(760, 540);
    await invoke("await fixture.reset('unavailable')"); await settle();
    const empty = await capture('l-no-trusted-state'); invariant(empty);
    assert.equal(empty.state.lifecycle, null); assert.equal(empty.state.freshness, null); assert.equal(empty.state.details, 'No trusted agent state available yet.');
    assert.ok(empty.state.summary.includes('No trusted agent state')); record.observations.noTrustedState = empty.state;

    await invoke("await fixture.reset('live')"); await ready();
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await settle();
    assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
    record.observations.reducedMotion = [];
    for (const next of ['idle', 'working', 'waiting', 'completed', 'error', 'coffee']) {
      for (const name of ['Ari', 'Mina', 'Sol']) await update(name, next === 'coffee' ? 'waiting' : next, next === 'coffee' && name === 'Sol' ? 'Taking a coffee break in the simulated office' : `Static ${next} meaning.`);
      await select(next === 'coffee' ? 'Sol' : 'Mina'); await settle();
      const presentation = await invoke('return fixture.presentation()');
      assert.ok(Object.values(presentation).every(value => value.reducedMotion));
      const r = (await layout()).room;
      const firstImage = await win.webContents.capturePage({ x: r.x, y: r.y, width: 640, height: 360 }), first = firstImage.toBitmap();
      await wait(1300);
      const secondImage = await win.webContents.capturePage({ x: r.x, y: r.y, width: 640, height: 360 }), second = secondImage.toBitmap();
      if (Buffer.compare(first, second) !== 0) {
        writeFileSync(`/tmp/us029-${next}-first.png`, firstImage.toPNG());
        writeFileSync(`/tmp/us029-${next}-second.png`, secondImage.toPNG());
        console.error('Static comparison diagnostic:', next, r, presentation);
      }
      assert.equal(Buffer.compare(first, second), 0, `${next} must stay static under emulated reduced motion`);
      record.observations.reducedMotion.push({ next, equalDecodedOfficePixelsAcross1300ms: true, ...await capture(`m-reduced-${next}`) });
    }
    await update('Sol', 'waiting', 'Generic waiting, not coffee.'); await settle(); await capture('m-reduced-generic-waiting');
    const loaded = new Promise(done => win.webContents.once('did-finish-load', done)); win.webContents.reload(); await loaded; await ready();
    assert.equal((await state()).canvases, 1); record.observations.reloadOneCanvas = true;
    assert.deepEqual(errors, []); record.observations.rendererErrors = errors;
    writeFileSync(`${output}/capture-record.json`, JSON.stringify(record, null, 2) + '\n');
    console.log('PASS US-029 native geometry / responsive / input / state / text / static-motion assertions;', record.captures.length, 'direct captures');
  }
}
run().then(() => app.quit()).catch(error => {
  console.error(error);
  // Production before-quit drains its simulator first; failed assertions must exit nonzero.
  app.once('will-quit', () => app.exit(1));
  app.quit();
});
