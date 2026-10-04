// Direct production-component renderer evidence; synthetic state, not provider/transport or native keyboard evidence.
const { app, BrowserWindow } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback development URL');
const output = resolve(__dirname, '../../../docs/verification/assets/us-025');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  mkdirSync(output, { recursive: true });
  const win = new BrowserWindow({ width: 1100, height: 760, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const errors = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const record = { base: '697654144d1630d72d4a1011f0ed8b001b2c50be', capturedAt: new Date().toISOString(),
    provenance: 'Unedited offscreen Electron capturePage of production Application, store, runtime, host and Phaser; development-only synthetic accepted inputs; no native keyboard, provider or authenticated transport claim',
    electron: process.versions.electron, platform: process.platform, captures: [], observations: {} };
  const js = code => win.webContents.executeJavaScript(code);
  let entry;
  const invoke = code => js(`import(${JSON.stringify(entry)}).then(async ({fixture})=>{${code}})`);
  const rendered = async () => {
    for (let i=0;i<80;i++) {
      if (await js("document.querySelectorAll('canvas').length===1")) { await wait(250); return; }
      await wait(100);
    }
    throw new Error(`Missing canvas: ${JSON.stringify(errors)}`);
  };
  const select = async name => { await js(`document.querySelector('[aria-label="Select ${name}"]').click()`); await wait(80); };
  const clear = async () => { await js("document.querySelector('.clear-selection-button').click()"); await wait(80); };
  const fields = () => js("Object.fromEntries(Array.from(document.querySelectorAll('.agent-inspection dl>div')).map(r=>[r.querySelector('dt').textContent,r.querySelector('dd').textContent]))");
  const layout = () => js(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvases:document.querySelectorAll('canvas').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,documentHeight:document.documentElement.scrollHeight,canvas:rect('canvas'),inspector:rect('.agent-inspection'),selector:rect('.agent-selector'),header:rect('.application-header'),columns:getComputedStyle(document.querySelector('.office-composition')).gridTemplateColumns}})()`);
  const capture = async name => {
    const image = await win.webContents.capturePage(); const png=image.toPNG();
    writeFileSync(`${output}/${name}.png`,png);
    record.captures.push({name,viewport:await js('[innerWidth,innerHeight]'),scrollY:await js('scrollY'),size:image.getSize(),pngSha256:createHash('sha256').update(png).digest('hex')});
  };
  const canvasHash = async () => {
    const rect=await js("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:640,height:360}})()");
    return createHash('sha256').update((await win.webContents.capturePage(rect)).toPNG()).digest('hex');
  };
  const size = async width => { win.setContentSize(width,width===760?540:760); await js('scrollTo(0,0)'); await wait(100); };
  try {
    await win.loadURL(`${base}/verification/us-025.html`); await rendered();
    entry=await js("Array.from(document.scripts).find(s=>new URL(s.src).pathname==='/verification/us-025.tsx').src");
    for (const width of [1100,760]) {
      await size(width); await clear();
      const unselected = await layout();
      assert.equal(unselected.horizontalOverflow,false); assert.equal(unselected.canvas.width,640); assert.equal(unselected.canvas.height,360);
      await capture(`${width}-unselected`);
      await select('Mina'); const selected=await layout();
      assert.deepEqual(selected.canvas,unselected.canvas,'selection does not shift room');
      assert.equal(selected.inspector.x,unselected.inspector.x); assert.equal(selected.inspector.width,unselected.inspector.width);
      assert.ok(selected.selector.y>=selected.canvas.bottom,'room precedes roster');
      if(width===1100) assert.ok(selected.inspector.x>=selected.canvas.x+640);
      else {
        assert.ok(selected.inspector.y>selected.selector.bottom);
        assert.ok(await js("document.querySelector('.selected-agent-summary').getBoundingClientRect().bottom<=innerHeight"));
      }
      assert.equal((await fields()).Name,'Mina'); assert.equal((await fields())['Current state'],'Waiting'); assert.equal((await fields()).Reason,'Approval required');
      record.observations[width]={unselected,selected}; await capture(`${width}-selected`);
      if(width===760) {
        await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await wait(80);
        assert.ok(await js('scrollY>0')); await capture('760-inspector-scroll');
      }
    }
    record.observations.intermediateWidths=[];
    for(const width of [800,960,1011,1012,1024,1200]) {
      await size(width); const current=await layout(); assert.equal(current.horizontalOverflow,false); assert.equal(current.canvas.width,640);
      record.observations.intermediateWidths.push(current);
    }
    await size(1100); await select('Ari');
    const point=await js("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.x+520),y:Math.round(r.y+224)}})()");
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point}); await wait(80);
    assert.equal((await fields()).Name,'Sol');
    assert.equal(await js("document.querySelector('[aria-label=\"Select Sol\"]').getAttribute('aria-pressed')"),'true');
    record.observations.spriteSelectorAgreement=true;
    await select('Ari');
    // Renderer keyboard-event emulation, explicitly distinct from native macOS verification.
    win.webContents.debugger.attach('1.3');
    const key = async (key, code, virtual) => {
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:virtual});
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});
    };
    await js("document.querySelector('[aria-label=\"Select Ari\"]').focus()");
    await key('Tab','Tab',9); await wait(80);
    assert.equal(await js('document.activeElement.getAttribute("aria-label")'),'Select Mina');
    assert.equal(await js('document.activeElement.matches(":focus-visible")'),true);
    assert.equal(await js('document.activeElement.getAttribute("aria-pressed")'),'false');
    assert.equal((await fields()).Name,'Ari');
    record.observations.focus={method:'programmatic initial focus followed by Chromium debugger Input.dispatchKeyEvent Tab; not native observation',
      focused:await js('document.activeElement.getAttribute("aria-label")'),selection:(await fields()).Name,
      outline:await js('getComputedStyle(document.activeElement).outline'),selectedBorder:await js('getComputedStyle(document.querySelector("[aria-pressed=true]")).borderColor')};
    await capture('1100-focus-mina-selected-ari');
    await key(' ','Space',32); await wait(80);
    assert.equal((await fields()).Name,'Mina');
    await invoke("fixture.update('mock-agent-mina','working','Reviewing the change')"); await wait(80);
    assert.equal(await js('document.activeElement.getAttribute("aria-label")'),'Select Mina');
    assert.equal((await fields()).Activity,'Reviewing the change');
    await invoke("fixture.connection('disconnected')"); await wait(80);
    assert.equal(await js('document.activeElement.getAttribute("aria-label")'),'Select Mina');
    assert.equal((await fields()).Freshness,'Last known');
    assert.equal(await js("document.querySelector('.application-header .connection-status').textContent"),'Disconnected · Showing last known agent state');
    await capture('1100-retained');
    await invoke("fixture.connection('synchronizing')"); await wait(80);
    assert.equal(await js("document.querySelector('.connection-status').textContent"),'Synchronizing · Showing last known agent state');
    await invoke("fixture.connection('ready')"); await wait(80);
    const longActivity='Reviewing implementation details and preserving exact trusted wording. '.repeat(5)+'X'.repeat(128);
    await invoke(`fixture.update('mock-agent-mina','waiting',${JSON.stringify(longActivity)},'capacity_exhausted')`); await wait(80);
    for(const width of [1100,760]) {
      await size(width); assert.equal((await layout()).horizontalOverflow,false);
      assert.equal((await fields()).Activity,longActivity); assert.equal((await fields()).Reason,'Capacity exhausted');
      await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await wait(80); await capture(`${width}-long-activity-reason`);
      assert.equal(await js("getComputedStyle(document.querySelector('.agent-inspection')).overflowY"),'visible');
    }
    await size(760); await invoke("await fixture.reset('unavailable')"); await rendered();
    assert.equal(await js("document.querySelector('.connection-status').textContent"),'Disconnected · Local simulation unavailable');
    assert.equal((await fields()).Status,'No trusted agent state available yet.'); await capture('760-unavailable');
    await invoke("await fixture.reset('connecting')"); await rendered();
    assert.equal(await js("document.querySelector('.connection-status').textContent"),'Connecting to local simulation…');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await invoke("await fixture.reset('live')"); await rendered();
    await select('Ari'); const before=await canvasHash(); await wait(1700); assert.equal(await canvasHash(),before);
    await capture('760-reduced-motion'); record.observations.reducedMotion='Renderer media emulation; full office PNG crop unchanged over 1700ms with working Ari and canonical Sol coffee. Native OS setting not tested.';
    const reload=new Promise(resolve=>win.webContents.once('did-finish-load',resolve)); win.webContents.reload(); await reload; await rendered();
    assert.equal((await layout()).canvases,1); record.observations.reloadOneCanvas=true;
    assert.deepEqual(errors,[]); record.observations.rendererErrors=errors;
    writeFileSync(`${output}/capture-record.json`,JSON.stringify(record,null,2)+'\n');
    console.log('PASS',JSON.stringify(record.observations));
  } finally { win.destroy(); app.quit(); }
}).catch(error=>{console.error(error);app.exit(1);});
