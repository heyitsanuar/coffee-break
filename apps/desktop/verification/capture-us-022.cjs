// Direct captures of the development renderer only; never reconstruct or alter images.
const { app, BrowserWindow } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const directory = resolve(__dirname, '../../../docs/verification/assets/us-022');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected explicit loopback Vite development URL.');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  mkdirSync(directory, { recursive: true });
  const win = new BrowserWindow({ width: 1100, height: 760, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const errors = [];
  const record = { provenance: 'Direct offscreen Electron captures of synthetic US-022 development fixture',
    capturedAt: new Date().toISOString(), electron: process.versions.electron, platform: process.platform,
    arch: process.arch, captures: [], observations: {} };
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  try {
    const js = code => win.webContents.executeJavaScript(code);
    const loaded = async () => {
      for (let i = 0; i < 50; i++) {
        if (await js("document.querySelectorAll('canvas').length === 1 && document.body.innerText.includes('Connected')")) break;
        await wait(100);
      }
      assert.equal(await js("document.querySelectorAll('canvas').length"), 1, JSON.stringify({ errors, body: await js('document.body.innerText') })); await wait(400);
    };
    await win.loadURL(`${base}/verification/us-022.html`); await loaded();
    let entry = await js("Array.from(document.scripts).find(s => new URL(s.src).pathname === '/verification/us-022.tsx').src");
    const invoke = code => js(`import(${JSON.stringify(entry)}).then(({fixture}) => { ${code} })`);
    const capture = async (name, area = 'mug', since) => {
      const rect = area === 'page' ? undefined : await js(`(() => { const r=document.querySelector('canvas').getBoundingClientRect();
        return ${area === 'office' ? '{x:Math.round(r.x),y:Math.round(r.y),width:640,height:360}' : '{x:Math.round(r.x+570),y:Math.round(r.y+188),width:22,height:30}'}; })()`);
      const image = await win.webContents.capturePage(rect);
      const png = image.toPNG(); writeFileSync(`${directory}/${name}.png`, png);
      record.captures.push({ name, area, rect: rect ?? null, size: image.getSize(), at: performance.now(),
        elapsedMs: since === undefined ? null : performance.now() - since,
        pngSha256: createHash('sha256').update(png).digest('hex') });
      console.log('capture', name, image.getSize());
      return image;
    };
    const observe = () => js("({viewport:[innerWidth,innerHeight],scale:devicePixelRatio,canvas:document.querySelectorAll('canvas').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth})");
    const selectSol = () => js("document.querySelector('[aria-label=\"Select Sol\"]').click()");
    await capture('generic-waiting'); await capture('generic-waiting-office', 'office');
    await invoke('fixture.coffee()'); const start = performance.now();
    // Beyond 3.2 seconds, direct samples retain real timer/render uncertainty in the record.
    for (const [name, offset] of [['coffee-a', 100], ['coffee-b', 1750], ['coffee-return-a', 3400], ['coffee-later-a', 4000]]) {
      await wait(Math.max(0, start + offset - performance.now())); await capture(name, 'mug', start);
    }
    await capture('coffee-office', 'office');
    await selectSol(); await wait(80); await capture('coffee-normal', 'page'); record.observations.normal = await observe();
    assert.equal(await js("document.body.innerText.includes('Taking a coffee break in the simulated office')"), true);
    assert.equal(await js("document.querySelector('[aria-label=\"Select Sol\"]').getAttribute('aria-pressed')"), 'true');
    await js("document.querySelector('[aria-label=\"Select Sol\"]').scrollIntoView({block:'center'})");
    await wait(80); await capture('coffee-normal-inspection', 'page'); await js('scrollTo(0,0)');
    await invoke("fixture.update('mock-agent-sol','waiting')"); await wait(80); await capture('exit-waiting');
    await invoke("fixture.coffee(); fixture.update('mock-agent-sol','working')"); await wait(80); await capture('exit-working');
    await invoke("fixture.coffee(); fixture.disconnect()"); await wait(80); await capture('retained-a');
    await wait(3400); await capture('retained-later-a'); await capture('retained-normal', 'page');
    await invoke('fixture.restore()'); await wait(80); await capture('restored-a');
    win.webContents.debugger.attach('1.3');
    const media = async value => { await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] }); await wait(80); };
    await media('reduce'); assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
    await capture('reduced-a'); await wait(3400); await capture('reduced-later-a');
    await invoke("fixture.update('mock-agent-sol','waiting'); fixture.coffee('mock-agent-ari')"); await wait(80); await capture('ari-negative');
    await invoke("fixture.coffee('mock-agent-mina')"); await wait(80); await capture('mina-negative');
    await invoke("fixture.update('mock-agent-ari','waiting'); fixture.update('mock-agent-mina','waiting'); fixture.coffee()");
    await media('no-preference'); await wait(80);
    await js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Remount scene').click()");
    await wait(600); assert.equal(await js("document.querySelectorAll('canvas').length"), 1); await capture('initialized-a');
    await selectSol(); win.setContentSize(760, 540); await wait(200); await capture('coffee-minimum', 'page');
    record.observations.minimum = await observe();
    await js("document.querySelector('[aria-label=\"Select Sol\"]').scrollIntoView({block:'center'})");
    await wait(80); await capture('coffee-minimum-inspection', 'page');
    assert.equal(record.observations.normal.horizontalOverflow, false); assert.equal(record.observations.minimum.horizontalOverflow, false);
    await js('scrollTo(0,0)'); win.setContentSize(1100, 760);
    win.webContents.reload(); await loaded();
    assert.equal(await js("document.querySelectorAll('canvas').length"), 1);
    assert.deepEqual(errors, []); record.observations.artworkErrors = [...errors];
    // Induce room asset load failure in this capture window only. No production fixture hook.
    const blocked = [];
    win.webContents.session.webRequest.onBeforeRequest({ urls: [`${base}/src/office/assets/office-room-*.png*`] }, (details, callback) => {
      // Phaser uses XHR for image bytes; Vite's ?import JavaScript modules must pass.
      const image = !new URL(details.url).searchParams.has('import');
      if (image) blocked.push(details.url);
      callback({ cancel: image });
    });
    await win.webContents.session.clearCache(); await win.loadURL(`${base}/verification/us-022.html?fallback`); await loaded();
    entry = await js("Array.from(document.scripts).find(s => new URL(s.src).pathname === '/verification/us-022.tsx').src");
    assert.deepEqual([...new Set(blocked.map(url => new URL(url).pathname))].sort(),
      ['/src/office/assets/office-room-background.png', '/src/office/assets/office-room-foreground.png']);
    await invoke('fixture.coffee()'); await wait(80); await capture('fallback-coffee-office', 'office');
    await selectSol(); await wait(80); await capture('fallback-coffee-normal', 'page');
    record.observations.fallbackBlockedRequests = blocked;
    record.observations.fallbackErrors = errors.slice(record.observations.artworkErrors.length);
    assert.deepEqual(errors, []);
    record.observations.remountAndReload = 'one canvas; zero renderer console errors';
    writeFileSync(`${directory}/capture-record.json`, `${JSON.stringify(record, null, 2)}\n`);
    console.log('PASS', record.observations);
  } finally { win.destroy(); app.quit(); }
}).catch(error => { console.error(error); app.exit(1); });
