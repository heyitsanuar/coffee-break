const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { mkdirSync } = require('node:fs');
const directory = resolve(__dirname, '../../../docs/verification/assets/us-020');
mkdirSync(directory, { recursive: true });
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected an explicit loopback Vite development URL.');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
 const win = new BrowserWindow({ width: 1100, height: 760, useContentSize: true, show: false,
  webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false } });
 const errors = [];
 win.webContents.on('console-message', event => { if (event.level === 'error') { errors.push(event.message); console.log('renderer error:', event.message); } });
 try {
  console.log('environment', { electron: process.versions.electron, platform: process.platform, arch: process.arch, capturedAt: new Date().toISOString() });
  await win.loadURL(`${base}/verification/us-020.html`);
  const js = code => win.webContents.executeJavaScript(code);
  for (let i=0;i<50;i++) { if (await js("document.querySelectorAll('canvas').length === 1 && document.body.innerText.includes('Connected')")) break; await wait(100); }
  assert.equal(await js("document.querySelectorAll('canvas').length"),1);
  await wait(400);
  // Reuse Vite's loaded module URL, including its timestamp, so fixtures share the existing React root.
  const entryUrl = await js("Array.from(document.scripts).find(s => new URL(s.src).pathname === '/verification/us-020.tsx').src");
  const invoke = code => js(`import(${JSON.stringify(entryUrl)}).then(({fixture}) => { ${code} })`);
  const capture = async (name, strip = false) => {
   const rect = strip ? await js("(() => { const r=document.querySelector('canvas').getBoundingClientRect(); return {x: Math.round(r.x+112),y:Math.round(r.y+192),width:432,height:56}; })()") : undefined;
   const png = await win.webContents.capturePage(rect); writeFileSync(`${directory}/${name}.png`,png.toPNG());
   console.log('capture',name, png.getSize());
  };
  await capture('idle-normal'); await capture('idle-poses',true);
  await invoke("fixture.lifecycle('working')"); await wait(80); await capture('working-poses-a',true); await wait(650); await capture('working-poses-b',true); await capture('working-normal');
  await invoke("fixture.lifecycle('waiting')"); await wait(80); await capture('waiting-poses',true);
  await invoke("fixture.lifecycle('working'); fixture.lifecycle('completed')"); await wait(90); await capture('completed-acknowledgement',true); await wait(700); await capture('completed-settled',true);
  await invoke("fixture.lifecycle('working'); fixture.lifecycle('error')"); await wait(80); await capture('error-acknowledgement',true); await wait(650); await capture('error-settled',true); await capture('error-normal');
  await invoke("fixture.lifecycle('working'); fixture.disconnect()"); await wait(80); await capture('working-retained-a',true); await wait(750); await capture('working-retained-b',true); await capture('retained-normal');
  await invoke('fixture.restore()'); await wait(80);
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await wait(80); assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
  await capture('working-reduced-a',true); await wait(750); await capture('working-reduced-b',true);
  await invoke("fixture.lifecycle('error')"); await wait(80); await capture('error-reduced',true);
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]}); await wait(80); await capture('error-motion-restored',true);
  await invoke("fixture.lifecycle('waiting'); fixture.coffee()"); await wait(80); await capture('coffee-normal'); await invoke('fixture.disconnect()'); await wait(80); await capture('coffee-retained-a',true); await wait(750); await capture('coffee-retained-b',true);
  await invoke('fixture.restore()'); await wait(80);
  const observations = await js("({viewport:[innerWidth,innerHeight],scale:devicePixelRatio,canvas:document.querySelectorAll('canvas').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth})");
  console.log('normal',observations);
  await js("document.querySelector('[aria-label=\"Select Mina\"]').click()"); await wait(80);
  assert.ok(await js("document.querySelector('[aria-label=\"Select Mina\"]').getAttribute('aria-pressed') === 'true'"));
  win.setContentSize(760,540); await wait(150); await capture('minimum-coffee');
  console.log('minimum',await js("({viewport:[innerWidth,innerHeight],canvas:document.querySelectorAll('canvas').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,selected:document.querySelector('[aria-label=\"Select Mina\"]').getAttribute('aria-pressed')})"));
  await js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Remount scene').click()"); await wait(500); assert.equal(await js("document.querySelectorAll('canvas').length"),1);
  console.log('before reload error count', errors.length);
  assert.deepEqual(errors, [], 'Renderer errors before reload');
  win.webContents.reload(); await wait(900); assert.equal(await js("document.querySelectorAll('canvas').length"),1);
  console.log('after reload error count', errors.length);
  assert.deepEqual(errors, [], 'Renderer errors during reload');
  console.log('reload/remount: one canvas, zero renderer errors');
 } finally { win.destroy(); app.quit(); }
}).catch(error => { console.error(error); app.exit(1); });
