// Captures this development fixture only. No production/preload changes or native input automation.
const { app, BrowserWindow } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const directory = resolve(__dirname, '../../../docs/verification/assets/us-021');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected an explicit loopback Vite development URL.');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  mkdirSync(directory, { recursive: true });
  const win = new BrowserWindow({ width: 1100, height: 760, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const errors = [];
  const record = { provenance: 'Offscreen Electron, synthetic development fixture', capturedAt: new Date().toISOString(),
    electron: process.versions.electron, platform: process.platform, arch: process.arch, captures: [], observations: {} };
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  try {
    const js = code => win.webContents.executeJavaScript(code);
    await win.loadURL(`${base}/verification/us-021.html`);
    for (let i = 0; i < 50; i++) {
      if (await js("document.querySelectorAll('canvas').length === 1 && document.body.innerText.includes('Connected')")) break;
      await wait(100);
    }
    assert.equal(await js("document.querySelectorAll('canvas').length"), 1);
    await wait(400);
    // Import the exact loaded Vite URL so HMR timestamps cannot create a second React root.
    const entry = await js("Array.from(document.scripts).find(s => new URL(s.src).pathname === '/verification/us-021.tsx').src");
    const invoke = code => js(`import(${JSON.stringify(entry)}).then(({fixture}) => { ${code} })`);
    const capture = async (name, monitors = true) => {
      const rect = monitors ? await js("(() => { const r=document.querySelector('canvas').getBoundingClientRect(); return {x:Math.round(r.x+80),y:Math.round(r.y+74),width:240,height:34}; })()") : undefined;
      const image = await win.webContents.capturePage(rect);
      const png = image.toPNG();
      writeFileSync(`${directory}/${name}.png`, png);
      record.captures.push({ name, rect: rect ?? null, size: image.getSize(), at: performance.now(), pngSha256: createHash('sha256').update(png).digest('hex') });
      console.log('capture', name, image.getSize());
    };
    const observations = () => js("({viewport:[innerWidth,innerHeight],scale:devicePixelRatio,canvas:document.querySelectorAll('canvas').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth})");
    await capture('idle-monitors'); await capture('idle-normal', false);
    await invoke("fixture.both('working')");
    const start = performance.now();
    // Repeated actual-renderer samples over more than a full cycle; not a reconstructed animation.
    for (let i = 0; i <= 14; i++) {
      await wait(Math.max(0, start + 80 + i * 200 - performance.now()));
      await capture(`working-series-${String(i).padStart(2, '0')}`);
    }
    await capture('working-normal', false);
    await invoke("fixture.both('waiting')"); await wait(80); await capture('waiting-monitors');
    await invoke("fixture.both('working'); fixture.both('completed')"); await wait(80); await capture('completed-widened');
    await wait(650); await capture('completed-settled');
    await invoke("fixture.both('working'); fixture.both('error')"); await wait(80); await capture('error-monitors');
    await capture('error-normal', false);
    await invoke("fixture.both('working'); fixture.disconnect()"); await wait(80); await capture('working-retained-a');
    await wait(1350); await capture('working-retained-b'); await capture('retained-normal', false);
    await invoke('fixture.restore()'); await wait(80);
    win.webContents.debugger.attach('1.3');
    const media = async value => { await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] }); await wait(80); };
    await media('reduce'); assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
    await capture('working-reduced-a'); await wait(1350); await capture('working-reduced-b');
    await invoke("fixture.both('completed')"); await wait(80); await capture('completed-reduced');
    await media('no-preference'); await capture('completed-motion-restored');
    await invoke("fixture.both('working'); fixture.both('completed'); fixture.disconnect()"); await wait(80); await capture('completed-retained');
    await invoke('fixture.restore()'); await wait(80); await capture('completed-snapshot-restored');
    await invoke("fixture.lifecycle('mock-agent-ari','waiting'); fixture.lifecycle('mock-agent-mina','error')"); await wait(80); await capture('mixed-waiting-error');
    await invoke("fixture.lifecycle('mock-agent-ari','idle')"); await wait(80); await capture('ari-only-change');
    await invoke("fixture.lifecycle('mock-agent-mina','waiting')"); await wait(80); await capture('mina-only-change');
    await invoke("fixture.lifecycle('mock-agent-sol','error')"); await wait(80); await capture('sol-only-change');
    await invoke("fixture.lifecycle('mock-agent-ari','working'); fixture.lifecycle('mock-agent-ari','waiting')"); await wait(80); await capture('rapid-working-waiting');
    await invoke("fixture.lifecycle('mock-agent-ari','working'); fixture.lifecycle('mock-agent-ari','completed')"); await wait(80); await capture('rapid-working-completed');
    await invoke("fixture.lifecycle('mock-agent-ari','working'); fixture.lifecycle('mock-agent-ari','error')"); await wait(80); await capture('rapid-working-error');
    await wait(1350); await capture('rapid-error-after-stale-deadlines');
    await js("document.querySelector('[aria-label=\"Select Mina\"]').click()"); await wait(80);
    await capture('selected-normal', false); record.observations.normal = await observations();
    await js("document.querySelector('[aria-label=\"Select Mina\"]').scrollIntoView({block:'center'})"); await wait(80);
    await capture('normal-inspection', false);
    await js('scrollTo(0,0)');
    win.setContentSize(760, 540); await wait(200); await capture('minimum-selected', false);
    record.observations.minimum = await observations();
    assert.equal(record.observations.normal.horizontalOverflow, false); assert.equal(record.observations.minimum.horizontalOverflow, false);
    assert.equal(await js("document.querySelector('[aria-label=\"Select Mina\"]').getAttribute('aria-pressed')"), 'true');
    await js("document.querySelector('[aria-label=\"Select Mina\"]').scrollIntoView({block:'center'})"); await wait(80);
    await capture('minimum-inspection', false);
    await js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Remount scene').click()"); await wait(600);
    assert.equal(await js("document.querySelectorAll('canvas').length"), 1);
    win.webContents.reload(); await wait(1000); assert.equal(await js("document.querySelectorAll('canvas').length"), 1);
    assert.deepEqual(errors, []);
    record.observations.remountAndReload = 'one canvas; zero renderer console errors';
    writeFileSync(`${directory}/capture-record.json`, `${JSON.stringify(record, null, 2)}\n`);
    console.log('PASS', record.observations);
  } finally { win.destroy(); app.quit(); }
}).catch(error => { console.error(error); app.exit(1); });
