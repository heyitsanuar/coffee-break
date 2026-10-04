// Direct offscreen captures and browser assertions; no image alteration or native-accessibility claim.
const { app, BrowserWindow } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const output = resolve(__dirname, '../../../docs/verification/assets/us-023');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback development URL.');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1100, height: 760, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const errors = [];
  const record = { provenance: 'Direct unedited offscreen Electron renderer captures of synthetic accepted US-023 fixture inputs',
    capturedAt: new Date().toISOString(), electron: process.versions.electron, platform: process.platform,
    captures: [], observations: {} };
  mkdirSync(output, { recursive: true });
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  let entry;
  const invoke = code => js(`import(${JSON.stringify(entry)}).then(async ({fixture}) => { ${code} })`);
  const selected = name => js(`document.querySelector('[aria-label="Select ${name}"]').getAttribute('aria-pressed')`);
  const select = async name => { await js(`document.querySelector('[aria-label="Select ${name}"]').click()`); await wait(80); };
  const text = () => js('document.body.innerText');
  const layout = () => js(`(() => {
    const rect = s => { const r=document.querySelector(s).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}; };
    const summary=document.querySelector('.selected-agent-summary');
    return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvases:document.querySelectorAll('canvas').length,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
      documentHeight:document.documentElement.scrollHeight,grid:getComputedStyle(document.querySelector('.office-composition')).gridTemplateColumns,
      canvas:rect('canvas'),inspector:rect('.agent-inspection'),selector:rect('.agent-selector'),
      summaryDisplay:summary ? getComputedStyle(summary).display : 'absent'};
  })()`);
  const capture = async (name, office = false) => {
    const rect = office ? await js(`(() => {const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:640,height:360};})()`) : undefined;
    const image = await win.webContents.capturePage(rect);
    const png = image.toPNG(); writeFileSync(`${output}/${name}.png`, png);
    record.captures.push({name,viewport:await js('[innerWidth,innerHeight]'),scrollY:await js('scrollY'),rect:rect ?? null,
      size:image.getSize(),pngSha256:createHash('sha256').update(png).digest('hex')});
    console.log('capture', name, image.getSize());
  };
  const loaded = async () => {
    for (let i=0;i<60;i++) { if (await js("document.querySelectorAll('canvas').length===1")) { await wait(400); return; } await wait(100); }
    throw new Error(`No office canvas: ${JSON.stringify(errors)}`);
  };
  try {
    await win.loadURL(`${base}/verification/us-023.html`); await loaded();
    entry = await js("Array.from(document.scripts).find(s=>new URL(s.src).pathname==='/verification/us-023.tsx').src");
    for (const name of ['Ari','Mina','Sol']) { await select(name); await capture(`normal-${name.toLowerCase()}`); }
    await capture('normal-office', true);
    record.observations.normal = await layout();
    assert.equal(record.observations.normal.summaryDisplay, 'none');
    assert.equal(record.observations.normal.horizontalOverflow, false);
    assert.equal(record.observations.normal.canvas.width, 640); assert.equal(record.observations.normal.canvas.height, 360);
    assert.ok(record.observations.normal.inspector.x > record.observations.normal.canvas.x + 640);
    await select('Ari');
    await js("document.querySelector('[aria-label=\"Select Mina\"]').focus()");
    assert.equal(await selected('Ari'),'true'); assert.equal(await selected('Mina'),'false');
    record.observations.focusAloneDoesNotSelect = true;
    await invoke("fixture.update('Exact activity after a lifecycle change', true)"); await wait(100);
    assert.equal(await selected('Ari'),'true');
    assert.equal(await js("document.activeElement.getAttribute('aria-label')"), 'Select Mina');
    record.observations.lifecyclePreservesSelectionAndFocus = true;
    await invoke("await fixture.reset('live')"); await loaded();
    assert.equal(await selected('Ari'),'true');
    record.observations.sameHostGameRemountRetainsSelection = true;
    // Exercise Phaser pointer input in the actual renderer; browser-default focus behavior is recorded separately.
    const point = await js("(() => {const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x+520),y:Math.round(r.y+224)};})()");
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point}); await wait(120);
    assert.equal(await selected('Sol'),'true'); record.observations.actualSpritePointerSelectsSol = true;
    await select('Ari');
    await invoke("fixture.update('Long exact activity: '+('reviewing implementation details and preserving semantics. '.repeat(6))+'X'.repeat(100))");
    await wait(100); await capture('normal-long'); assert.equal((await layout()).horizontalOverflow,false);
    await invoke("fixture.connection('disconnected')"); await wait(100); await capture('normal-retained');
    assert.ok((await text()).includes('Disconnected · Showing last known agent state'));
    assert.ok((await text()).includes('Last known')); assert.equal(await selected('Ari'),'true');
    await invoke("fixture.connection('synchronizing')"); await wait(100); await capture('normal-synchronizing');
    assert.ok((await text()).includes('Synchronizing · Showing last known agent state'));
    await invoke("await fixture.reset('unavailable')"); await loaded(); await capture('normal-unavailable');
    assert.ok((await text()).includes('No trusted agent state available yet.'));
    await invoke("await fixture.reset('connecting')"); await loaded(); await capture('normal-connecting');
    assert.ok((await text()).includes('Connecting to local simulation…'));
    await invoke("await fixture.reset('live')"); await loaded(); await select('Mina');
    win.setContentSize(1024,760); await wait(100); record.observations.breakpointDesktop = await layout();
    assert.equal(record.observations.breakpointDesktop.horizontalOverflow,false);
    assert.equal(record.observations.breakpointDesktop.summaryDisplay,'none');
    win.setContentSize(1023,760); await wait(100); record.observations.breakpointCompact = await layout();
    assert.equal(record.observations.breakpointCompact.horizontalOverflow,false);
    assert.equal(record.observations.breakpointCompact.summaryDisplay,'block');
    win.setContentSize(760,540); await wait(100); await js('scrollTo(0,0)');
    for (const name of ['Ari','Mina','Sol']) { await select(name); await capture(`minimum-${name.toLowerCase()}`); }
    record.observations.minimum = await layout();
    assert.equal(record.observations.minimum.summaryDisplay,'block'); assert.equal(record.observations.minimum.horizontalOverflow,false);
    assert.equal(record.observations.minimum.canvas.width,640); assert.equal(record.observations.minimum.canvas.height,360);
    assert.ok(record.observations.minimum.inspector.y>=record.observations.minimum.canvas.bottom);
    assert.ok(record.observations.minimum.documentHeight>540);
    await js("document.querySelector('canvas').scrollIntoView({block:'center'})"); await wait(100); await capture('minimum-office',true);
    await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await wait(100); await capture('minimum-inspector');
    await js('scrollTo(0,0)'); await select('Ari');
    await invoke("fixture.connection('disconnected')"); await wait(100); await capture('minimum-retained');
    assert.ok(await js("document.querySelector('.selected-agent-summary').textContent.includes('Last known')"));
    await invoke("await fixture.reset('unavailable')"); await loaded(); await capture('minimum-unavailable');
    assert.ok(await js("document.querySelector('.selected-agent-summary').textContent.includes('No trusted agent state available yet.')"));
    await invoke("await fixture.reset('live'); fixture.update('A'.repeat(512))"); await loaded(); await capture('minimum-long');
    assert.equal((await layout()).horizontalOverflow,false);
    await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await wait(80); await capture('minimum-long-inspector');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await js('scrollTo(0,0)'); await wait(120); await capture('minimum-reduced');
    assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
    record.observations.reducedMotion = 'actual renderer media emulation; no native OS or screen-reader claim';
    await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})");
    record.observations.inspectorReachableByDocumentScroll = await js('scrollY>0');
    assert.equal(record.observations.inspectorReachableByDocumentScroll,true);
    win.webContents.reload(); await loaded(); assert.equal((await layout()).canvases,1);
    assert.deepEqual(errors,[]); record.observations.reloadOneCanvas = true;
    writeFileSync(`${output}/capture-record.json`,`${JSON.stringify(record,null,2)}\n`);
    console.log('PASS',JSON.stringify(record.observations));
  } finally { win.destroy(); app.quit(); }
}).catch(error=>{console.error(error);app.exit(1);});
