// Actual production-main Electron window; Chromium automation is not native a11y evidence.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback development URL');
const repo = resolve(__dirname, '../../..');
const output = resolve(repo, 'docs/verification/assets/us-031');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(done => setTimeout(done, ms));

async function run() {
  process.env.ELECTRON_RENDERER_URL = base;
  process.env.COFFEE_BREAK_LOCAL_SIMULATION = '1';
  await import(pathToFileURL(resolve(__dirname, '../out/main/main.js')).href);
  await app.whenReady();
  const win = BrowserWindow.getAllWindows()[0];
  assert.ok(win);
  const js = async code => {
    try { return await win.webContents.executeJavaScript(code); }
    catch (error) { console.error('Renderer query:', code, 'errors:', errors); throw error; }
  };
  const invoke = code => js(`import('/verification/us-031.tsx').then(async ({fixture})=>{${code}})`);
  const errors = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const record = { baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    capturedAt: new Date().toISOString(), electron: process.versions.electron, platform: process.platform,
    provenance: 'Unedited capturePage PNGs from the native framed production-main window. Production-root captures use authenticated development simulation. Supplemental fixture delegates to production Application/store/runtime/host/scene with synthetic accepted renderer messages. Input and media emulation are Chromium automation, not manual native keyboard, OS preference or VoiceOver verification.',
    captures: [], observations: {}, sourceSha256: {} };
  mkdirSync(output, { recursive: true });
  const files = execFileSync('git', ['ls-files', 'apps/desktop/src', 'apps/desktop/electron', 'apps/desktop/shared', 'packages/contracts', 'package.json', 'package-lock.json'], { cwd: repo, encoding: 'utf8' }).trim().split('\n');
  for (const path of [...files, 'apps/desktop/verification/us-031.tsx', 'apps/desktop/verification/us-031.html', 'apps/desktop/verification/capture-us-031.cjs']) record.sourceSha256[path] = hash(readFileSync(resolve(repo, path)));
  async function ready() {
    for (let i = 0; i < 100; i++) {
      if (await js("document.querySelectorAll('canvas').length===1&&document.body.innerText.includes('Connected')")) { await wait(250); return; }
      await wait(100);
    }
    throw new Error('Production canvas/connected state not ready');
  }
  async function resize(width, height) { win.setSize(width, height); await wait(120); }
  const layout = async () => ({ outer: win.getBounds(), content: win.getContentBounds(),
    ...await js(`(()=>{const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
      return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,url:location.href,scroll:scrollY,documentHeight:document.documentElement.scrollHeight,
        horizontalOverflow:document.documentElement.scrollWidth>innerWidth,header:rect('.application-header'),toolbar:rect('.studio-toolbar'),
        composition:rect('.office-composition'),room:rect('canvas'),host:rect('.office-scene-host'),roster:rect('.agent-selector'),inspector:rect('.agent-inspection'),projects:rect('.projects-section'),
        canvasCount:document.querySelectorAll('canvas').length,selected:document.querySelector('[aria-pressed=true]')?.getAttribute('aria-label')??null,
        focus:document.activeElement.id||document.activeElement.getAttribute('aria-label')||document.activeElement.textContent,
        status:document.querySelector('.connection-status').textContent,statusCount:document.querySelectorAll('[role=status]').length,
        inhabitants:document.querySelector('.inhabitant-count').textContent,activity:document.querySelector('dd')?.textContent??null,
        freshness:document.querySelector('.agent-inspection-freshness')?.textContent??null,
        inspectorOverflow:getComputedStyle(document.querySelector('.agent-inspection')).overflowY};})()`) });
  const invariant = g => { assert.equal(g.horizontalOverflow, false); assert.equal(g.canvasCount, 1); assert.equal(g.room.width, 640); assert.equal(g.room.height, 360); assert.equal(g.statusCount, 1); assert.equal(g.inhabitants, '3 inhabitants'); assert.equal(g.inspectorOverflow, 'visible'); };
  async function capture(name, provenance) {
    const geometry = await layout(); invariant(geometry);
    const image = await win.webContents.capturePage(); assert.equal(image.isEmpty(), false);
    const bytes = image.toPNG(); writeFileSync(resolve(output, `${name}.png`), bytes);
    record.captures.push({ name, provenance, sampledAt: new Date().toISOString(), imageSize: image.getSize(), pngSha256: hash(bytes), ...geometry });
    return geometry;
  }
  const select = async name => { await js(`document.querySelector('[aria-label="Select ${name}"]').click()`); await wait(60); };
  const key = async (key, code, virtual, modifiers = 0) => {
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: virtual, modifiers, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual, modifiers }); await wait(60);
  };
  const outline = () => js("({visible:document.activeElement.matches(':focus-visible'),width:getComputedStyle(document.activeElement).outlineWidth,color:getComputedStyle(document.activeElement).outlineColor,offset:getComputedStyle(document.activeElement).outlineOffset})");
  try {
    await ready();
    await js("import('/src/agentState/runtime.ts').then(({agentStateStore})=>{window.us031Store=agentStateStore;window.us031Updates=[];agentStateStore.subscribeAcceptedUpdates(()=>window.us031Updates.push(agentStateStore.getSnapshot()));})");
    await resize(1100, 760); await select('Mina');
    const desktop = await capture('01-desktop-production', 'Production root — authenticated development simulator');
    assert.equal(desktop.composition.width, 964); assert.equal(desktop.toolbar.width, 642); assert.equal(desktop.inspector.width, 304);
    assert.equal(desktop.header.height, 56); assert.equal(desktop.toolbar.height, 40); assert.equal(desktop.toolbar.y, desktop.inspector.y);
    await resize(760, 540); await js('scrollTo(0,0)');
    const compact = await capture('02-compact-production', 'Production root — authenticated development simulator');
    assert.equal(compact.header.height, 80); assert.equal(compact.composition.width, 642); assert.equal(compact.toolbar.height, 40);
    assert.ok(compact.room.bottom <= compact.viewport[1]); assert.ok(compact.roster.y > compact.viewport[1]);
    for (let i = 0; i < 120 && !(await js('window.us031Updates.length>0')); i++) await wait(50);
    assert.ok(await js('window.us031Updates.length>0'), 'Real simulator accepted updates must continue');
    record.observations.productionUpdates = await js('window.us031Updates');
    win.webContents.debugger.attach('1.3');
    await win.loadURL(`${base}/verification/us-031.html?evidence=us031#preserve-this-hash`); await ready();
    await select('Mina');
    await invoke('window.us031Original={scene:fixture.scene(),game:fixture.scene().sys.game,store:fixture.snapshot(),canvas:document.querySelector("canvas")};');
    const continuity = () => invoke('return {scene:fixture.scene()===window.us031Original.scene,game:fixture.scene().sys.game===window.us031Original.game,store:fixture.snapshot()===window.us031Original.store,canvas:document.querySelector("canvas")===window.us031Original.canvas};');
    record.observations.navigation = [];
    for (const [width, height] of [[1100, 760], [760, 540]]) {
      await resize(width, height);
      const url = await js('location.href');
      for (const [label, tabs, activation] of [['Office', 0, 'Enter'], ['Agents', 1, 'Enter'], ['Projects', 2, 'Space']]) {
        await js("document.querySelector('nav button').focus()"); // Explicit automation anchor, not manual native evidence.
        if (tabs === 0) { await key('Tab', 'Tab', 9); await key('Tab', 'Tab', 9, 8); }
        for (let i = 0; i < tabs; i++) await key('Tab', 'Tab', 9);
        const focus = await outline(); assert.equal(focus.visible, true); assert.equal(focus.width, '3px'); assert.equal(focus.offset, '3px');
        assert.equal((await layout()).selected, 'Select Mina');
        assert.equal(await js('document.activeElement.textContent'), label);
        assert.ok(await js('document.activeElement.getBoundingClientRect().height>=44'));
        await key(activation === 'Space' ? ' ' : 'Enter', activation, activation === 'Space' ? 32 : 13);
        const g = await layout(); invariant(g); assert.equal(g.url, url); assert.equal(g.selected, 'Select Mina');
        assert.equal(g.focus, `${label.toLowerCase()}-section-title`);
        assert.equal(await js("document.querySelector('nav [aria-current=location]').textContent"), label);
        assert.equal((await outline()).width, '3px');
        assert.deepEqual(await continuity(), { scene: true, game: true, store: true, canvas: true });
        if (width === 760 && label !== 'Office') assert.ok(g.scroll > 0);
        record.observations.navigation.push({ outer: [width, height], label, activation, urlUnchanged: true, heading: g.focus, scroll: g.scroll, selected: g.selected, continuity: await continuity(), focus });
        if (width === 760 && label === 'Agents') await capture('03-compact-agents-focus', 'Production components — synthetic accepted renderer input; Chromium keyboard');
        if (width === 760 && label === 'Projects') await capture('04-compact-projects-focus', 'Production components — synthetic accepted renderer input; Chromium keyboard');
      }
    }
    // Activity and availability updates retain the selected identity and existing scene.
    await invoke("fixture.update('mock-agent-mina','working','Runtime continues after navigation')"); await wait(80);
    assert.equal((await layout()).activity, 'Runtime continues after navigation');
    const afterUpdate = await continuity(); assert.equal(afterUpdate.game, true); assert.equal(afterUpdate.canvas, true);
    record.observations.runtimeAfterNavigation = { ...(await layout()), continuity: afterUpdate };
    record.observations.availability = [];
    for (const phase of ['disconnected', 'synchronizing', 'ready']) {
      await invoke(`fixture.connection('${phase}')`); await wait(60);
      const g = await layout(); invariant(g); assert.equal(g.selected, 'Select Mina'); assert.equal((await continuity()).game, true);
      assert.equal(g.freshness, phase === 'ready' ? 'Current information' : 'Last known · Not live');
      record.observations.availability.push({ phase, status: g.status, freshness: g.freshness, inhabitants: g.inhabitants });
      if (phase === 'disconnected') { await resize(1100, 760); await js('scrollTo(0,0)'); await capture('05-desktop-retained', 'Production components — synthetic disconnected accepted state'); }
    }
    record.observations.keyboard = [];
    for (const [width, height] of [[1100, 760], [760, 540]]) {
      await resize(width, height); await select('Mina'); await js("document.querySelector('[aria-label=\"Select Ari\"]').focus()");
      await key('Tab', 'Tab', 9); await key('Tab', 'Tab', 9);
      assert.equal((await layout()).focus, 'Select Sol'); assert.equal((await layout()).selected, 'Select Mina');
      assert.equal((await outline()).visible, true); assert.equal((await outline()).color, 'rgb(151, 220, 229)');
      if (width === 760) await capture('06-compact-agent-focus', 'Production components — Chromium focus on Sol while Mina remains selected');
      await key('Enter', 'Enter', 13); assert.equal((await layout()).selected, 'Select Sol');
      await key('Tab', 'Tab', 9); await key(' ', 'Space', 32); assert.equal((await layout()).selected, null);
      assert.equal(await js("document.activeElement===document.querySelector('.clear-selection-button')"), true);
      assert.equal((await outline()).visible, true);
      assert.equal(await invoke('return fixture.scene().children.list.find(e=>e.type==="Graphics"&&e.depth===11).commandBuffer.length;'), 0);
      await key('Tab', 'Tab', 9, 8); assert.equal((await layout()).focus, 'Select Sol');
      await key(' ', 'Space', 32); assert.equal((await layout()).selected, 'Select Sol');
      const before = await layout();
      await invoke("fixture.update('mock-agent-sol','working','Focused update')"); await wait(60);
      const after = await layout(); assert.equal(after.focus, before.focus); assert.equal(after.scroll, before.scroll);
      await invoke("fixture.connection('disconnected')"); await wait(60);
      assert.equal((await layout()).focus, before.focus); assert.equal((await layout()).scroll, before.scroll);
      await invoke("fixture.connection('synchronizing');fixture.connection('ready')"); await wait(60);
      record.observations.keyboard.push({ outer: [width, height], focusDoesNotSelect: true, enterSpaceSelect: true, clearRetainsFocus: true, shiftTab: true, lifecycleAvailabilityPreservesFocusScroll: true });
    }
    record.observations.breakpoints = [];
    for (const width of [1040, 1039, 900, 760]) {
      await resize(width, 540); await js('scrollTo(0,0)'); const g = await layout(); invariant(g);
      assert.equal(g.composition.width, width > 1039 ? 964 : 642);
      assert.equal(g.selected, 'Select Sol'); assert.equal((await continuity()).game, true);
      record.observations.breakpoints.push(g);
    }
    // Native pointer hit testing in Chromium, never a fixture select-agent hook.
    for (const [name, x, y] of [['Ari', 269, 119], ['Mina', 457, 119], ['Sol', 197, 227]]) {
      await js('scrollTo(0,0)'); const g = await layout();
      const point = { x: Math.round(g.room.x + x), y: Math.round(g.room.y + y) };
      win.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
      win.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 }); await wait(60);
      assert.equal((await layout()).selected, `Select ${name}`);
    }
    record.observations.pointerSelection = ['Ari', 'Mina', 'Sol'];
    const long = 'Reviewing the local change while preserving exact activity and readable inspection. '.repeat(4);
    await invoke(`fixture.update('mock-agent-mina','waiting',${JSON.stringify(long)},'approval_required')`); await select('Mina');
    await js('document.documentElement.style.fontSize="125%";scrollTo(0,0)'); await wait(60);
    const enlarged = await layout(); invariant(enlarged); assert.equal(enlarged.activity, long);
    await js("document.querySelector('.agent-inspection').scrollIntoView({behavior:'instant',block:'start'})"); await wait(60);
    record.observations.enlargedText = await capture('07-compact-enlarged-inspection', 'Production components — synthetic long exact activity and 125% root text; vertical flow');
    await js('document.documentElement.style.fontSize="";scrollTo(0,0)');
    await invoke("await fixture.reset('unavailable')"); await wait(250);
    const empty = await capture('08-compact-no-state', 'Production components — synthetic unavailable/no-state');
    assert.equal(empty.activity, null); assert.equal(empty.selected, 'Select Mina'); assert.ok(empty.status.includes('unavailable'));
    record.observations.noState = empty;
    await invoke("await fixture.reset('live')"); await ready();
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await wait(60);
    await invoke("fixture.update('mock-agent-mina','working','Reduced motion Working')"); await wait(60);
    assert.ok(await invoke('return Object.values(fixture.presentation()).every(p=>p.reducedMotion)'));
    await js('scrollTo(0,0)'); const room = (await layout()).room;
    const crop = { x: room.x, y: room.y, width: 640, height: 360 };
    const first = (await win.webContents.capturePage(crop)).toBitmap(); await wait(1600);
    assert.equal(Buffer.compare(first, (await win.webContents.capturePage(crop)).toBitmap()), 0);
    record.observations.reducedMotion = { method: 'Chromium media emulation; not native OS', identicalDecodedRoomAcross1600ms: true };
    record.observations.contrast = await js(`(()=>{const parse=c=>c.startsWith('#')?c.slice(1).match(/../g).map(v=>parseInt(v,16)):c.match(/\\d+/g).slice(0,3).map(Number);const lum=c=>parse(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
      const items=[['Brand','.office-heading h1','.application-header'],['Inactive navigation','nav button','.application-header'],['Active navigation','nav [aria-current=location]','nav [aria-current=location]'],['Toolbar muted','.inhabitant-count','.studio-toolbar'],['Projects copy','.projects-section p','.projects-section'],['Sample label','.sample-label','.projects-section'],['Interactive border','.agent-selector-button','.agent-selector-button'],['Current text','.connection-status','.application-header'],['Focus','.agent-selector-button',':root']];
      return items.map(([name,s,b])=>{const style=getComputedStyle(document.querySelector(s)),back=getComputedStyle(document.querySelector(b));const foreground=name==='Interactive border'?style.borderColor:name==='Focus'?getComputedStyle(document.documentElement).getPropertyValue('--color-focus').trim():style.color;const background=back.backgroundColor;return{name,foreground,background,ratio:ratio(foreground,background)};});})()`);
    for (const item of record.observations.contrast) assert.ok(item.ratio >= (['Interactive border', 'Focus'].includes(item.name) ? 3 : 4.5), `${item.name} contrast ${item.ratio}`);
    await invoke('fixture.remount()'); await ready(); assert.equal((await layout()).canvasCount, 1); assert.equal((await layout()).selected, 'Select Mina');
    record.observations.remountOneCanvas = true;
    const loaded = new Promise(done => win.webContents.once('did-finish-load', done)); win.webContents.reload(); await loaded; await ready();
    assert.equal((await layout()).canvasCount, 1); record.observations.reloadOneCanvas = true;
    assert.deepEqual(errors, []); record.observations.rendererErrors = errors;
    record.observations.manualNative = 'UNVERIFIED by this automated runner';
    writeFileSync(resolve(output, 'capture-record.json'), JSON.stringify(record, null, 2) + '\n');
    console.log('PASS US-031 Electron verification:', record.captures.length, 'captures; navigation, continuity, keyboard, reflow and regressions');
  } catch (error) { console.error(error); throw error; }
}
run().then(() => app.quit()).catch(() => { app.once('will-quit', () => app.exit(1)); app.quit(); });
