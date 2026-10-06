// Direct production renderer evidence using development-only accepted inputs; not native input verification.
const { app, BrowserWindow, nativeImage } = require('electron');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback dev URL');
const output = resolve(__dirname, '../../../docs/verification/assets/us-028');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  mkdirSync(output, { recursive: true });
  const win = new BrowserWindow({ width: 1100, height: 760, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const errors = [], record = { baseline: '951574dfd7a668e31a31ee55c6451e9ea0c9ff6e', capturedAt: new Date().toISOString(),
    provenance: 'Direct unedited Electron capturePage of production Application/store/runtime/host/Phaser. Synthetic accepted renderer inputs, not authenticated transport evidence. Chromium input emulation, not native keyboard/OS preference/screen-reader verification. Multiline fixture tests rendering only; ingress control-character validation is unchanged.',
    electron: process.versions.electron, sourceSha256: {}, assets: {}, captures: [], observations: {} };
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = async code => { try { return await win.webContents.executeJavaScript(code); } catch(error) { console.error('Renderer query failed:',code,'Console errors:',errors); throw error; } };
  const invoke = code => js(`import('/verification/us-028.tsx').then(async ({fixture})=>{${code}})`);
  const update = (name, state, activity, reason) => invoke(`fixture.update('mock-agent-'+${JSON.stringify(name.toLowerCase())},${JSON.stringify(state)},${JSON.stringify(activity)},${JSON.stringify(reason)})`);
  const state = () => js(`({selected:document.querySelector('[aria-pressed=true]')?.getAttribute('aria-label')??null,
    name:document.querySelector('#agent-inspection-title').textContent,
    lifecycle:document.querySelector('.agent-inspection-lifecycle')?.textContent??null,
    freshness:document.querySelector('.agent-inspection-freshness')?.textContent??null,
    details:document.querySelector('#agent-inspection-details').textContent,
    focus:document.activeElement.getAttribute('aria-label')??document.activeElement.textContent,
    scroll:scrollY,canvases:document.querySelectorAll('canvas').length})`);
  const capture = async name => {
    const image = await win.webContents.capturePage(), png = image.toPNG();
    assert.equal(image.isEmpty(), false); writeFileSync(`${output}/${name}.png`, png);
    record.captures.push({ name, kind: 'direct-runtime', sampledAt: new Date().toISOString(), viewport: await js('[innerWidth,innerHeight]'), dpr: await js('devicePixelRatio'), size: image.getSize(), pngSha256: hash(png) });
  };
  const settle = () => wait(100);
  const select = async name => { await js(`document.querySelector('[aria-label="Select ${name}"]').click()`); await settle(); };
  const clear = async () => { await js("document.querySelector('.clear-selection-button').click()"); await settle(); };
  const room = () => js("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()");
  const pointer = async (x,y) => {
    const r = await room(), point = { x: Math.round(r.x+x), y: Math.round(r.y+y) };
    win.webContents.sendInputEvent({type:'mouseMove',...point});
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point}); await settle();
  };
  const renderedRoom = async () => {
    for(let attempt=0;attempt<40;attempt++) {
      const r=await js("(()=>{const canvas=document.querySelector('canvas');if(!canvas)return null;const r=canvas.getBoundingClientRect();return{x:r.x,y:r.y}})()");
      if(r) {
        const image=await win.webContents.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:640,height:360});
        const bytes=image.toBitmap(), colors=new Set();
        for(let i=0;i<bytes.length;i+=64) colors.add(bytes.subarray(i,i+3).toString('hex'));
        if(colors.size>10) return; // Actual room palette, not the uniform loading canvas.
      }
      await wait(50);
    }
    throw new Error('Office artwork did not finish rendering');
  };
  const layout = () => js(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
    return {viewport:[innerWidth,innerHeight],horizontalOverflow:document.documentElement.scrollWidth>innerWidth,documentHeight:document.documentElement.scrollHeight,room:rect('canvas'),dock:rect('.agent-inspection'),roster:rect('.agent-selector'),summary:document.querySelector('.selected-agent-summary')?rect('.selected-agent-summary'):null,
    inspectorOverflow:getComputedStyle(document.querySelector('.agent-inspection')).overflowY,activityWhiteSpace:document.querySelector('dd')?getComputedStyle(document.querySelector('dd')).whiteSpace:null,
    portraits:Array.from(document.querySelectorAll('.agent-portrait')).map(p=>({width:p.getBoundingClientRect().width,height:p.getBoundingClientRect().height,pixelated:getComputedStyle(p).imageRendering,position:p.style.backgroundPosition})),controlHeights:Array.from(document.querySelectorAll('.agent-selector-button')).map(p=>p.getBoundingClientRect().height)}})()`);
  const selected = async name => { const current = await state(); assert.equal(current.selected,`Select ${name}`); assert.equal(current.name,name); assert.equal(current.canvases,1); return current; };
  try {
    for (const path of ['src/office/AgentPortrait.tsx','src/office/AgentSelector.tsx','src/office/AgentInspectionPanel.tsx','src/office/OfficeScene.ts','src/office/OfficeSceneHost.tsx','src/office/SelectedAgentSummary.tsx','src/office/officePresentationRuntime.ts','src/style.css','verification/us-028.tsx','verification/us-028.html','verification/capture-us-028.cjs']) record.sourceSha256[path]=hash(readFileSync(resolve(__dirname,'..',path)));
    for (const name of ['agent-lifecycle','mock-agents','office-room-background','office-room-foreground']) {
      const path = resolve(__dirname,`../src/office/assets/${name}.png`), image = nativeImage.createFromPath(path);
      assert.equal(image.isEmpty(),false); record.assets[name]={size:image.getSize(),pngSha256:hash(readFileSync(path))};
    }
    await win.loadURL(`${base}/verification/us-028.html`);
    for(let i=0;i<100;i++) { if(await js("document.querySelectorAll('canvas').length===1&&document.body.innerText.includes('Connected')")) break; await wait(100); }
    await renderedRoom(); await settle(); assert.equal((await state()).canvases,1);
    // Spy only records explicit calls; native input/browser behavior is not overridden.
    await js("window.us028FocusCalls=0;window.us028OriginalFocus=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(...args){window.us028FocusCalls++;return window.us028OriginalFocus.apply(this,args)};undefined");
    await update('Ari','working','Implementing the change.'); await update('Mina','waiting','Waiting for approval.','approval_required');
    await update('Sol','waiting','Taking a coffee break in the simulated office'); await settle();
    await capture('a-desktop-no-selection');
    const untouched = await state(); await clear(); assert.deepEqual(await state(),untouched);
    record.observations.emptyClearNonoperative=true;
    record.observations.selectionRoutes=[];
    for(const [name,x,y] of [['Ari',292,174],['Mina',480,174],['Sol',220,282]]) {
      await select(name); const roster=await selected(name);
      await clear(); await pointer(x-23,y-55); const world=await selected(name); // Outside visible 40×48 art.
      assert.equal(world.lifecycle,roster.lifecycle); assert.equal(world.details,roster.details);
      record.observations.selectionRoutes.push({name,roster:roster.selected,world:world.selected,pointer:{x:x-23,y:y-55},lifecycle:world.lifecycle});
      await capture(`${name==='Ari'?'b':name==='Mina'?'c':'d'}-desktop-${name.toLowerCase()}-selected`);
    }
    // Clicking just outside the envelope must leave a different identity selected.
    await select('Mina'); await pointer(292-25,174-55); await selected('Mina'); record.observations.outsideTargetDoesNotSelect=true;
    assert.equal(await js('window.us028FocusCalls'),0); record.observations.selectionNoProgrammaticFocus=true;
    win.webContents.debugger.attach('1.3');
    const key=async(key,code,virtual)=>{
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:virtual});
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual}); await settle();
    };
    await select('Ari'); await js("document.querySelector('[aria-label=\"Select Ari\"]').focus()"); await key('Tab','Tab',9);
    assert.equal((await state()).focus,'Select Mina'); await selected('Ari');
    assert.equal(await js('document.activeElement.matches(":focus-visible")'),true); await capture('f-focus-only-mina-selected-ari');
    await key(' ','Space',32); await selected('Mina'); await capture('f-focus-and-selected-mina');
    const focusCalls=await js('window.us028FocusCalls'), startScroll=(await state()).scroll;
    record.observations.selectedUpdateJourney=[];
    for(const [next,activity,reason] of [['idle','Ready'],['working','Reviewing exact text'],['waiting','Need approval','approval_required'],['waiting','Capacity required','capacity_exhausted'],['completed','Review complete'],['error','Review failed']]) {
      await update('Mina',next,activity,reason); await settle(); const current=await selected('Mina');
      assert.equal(current.focus,'Select Mina'); assert.equal(current.scroll,startScroll); assert.ok(current.details.includes(activity));
      record.observations.selectedUpdateJourney.push({state:next,activity,lifecycle:current.lifecycle,focus:current.focus});
      if(next==='working') {await wait(650);await selected('Mina');}
      if(next==='completed'||next==='error') {await wait(650);await selected('Mina');}
    }
    await update('Mina','waiting','Waiting for approval.','approval_required'); await settle(); await capture('g-inspector-live');
    const live=await state(); await invoke("fixture.connection('disconnected')"); await settle(); const retained=await selected('Mina');
    assert.equal(retained.lifecycle,live.lifecycle); assert.ok(retained.details.includes('Waiting for approval.')); assert.ok(retained.details.includes('Approval required')); assert.equal(retained.freshness,'Last known · Not live'); assert.equal(retained.focus,live.focus);
    await capture('j-inspector-retained'); await invoke("fixture.connection('synchronizing')"); await settle(); await selected('Mina');
    await invoke("fixture.connection('ready')"); await settle(); const restored=await selected('Mina'); assert.equal(restored.freshness,'Current information'); assert.equal(restored.focus,live.focus);
    assert.equal(await js('window.us028FocusCalls'),focusCalls); record.observations.focusAndSelectionPreservedAcrossUpdatesAndAvailability=true;
    await key('Tab','Tab',9); assert.equal((await state()).focus,'Select Sol'); await key('Tab','Tab',9);
    const clearNode=await js("document.activeElement===document.querySelector('.clear-selection-button')"); assert.equal(clearNode,true);
    await key(' ','Space',32); const empty=await state(); assert.equal(empty.selected,null);
    assert.equal(await js("document.activeElement===document.querySelector('.clear-selection-button')"),true);
    assert.equal(await js("document.activeElement.matches(':focus-visible')"),true); assert.equal(await js('window.us028FocusCalls'),focusCalls);
    await capture('f-clear-focus-after-clearing'); record.observations.chromiumKeyboardClearKeepsFocus=true;
    // Default/hover/selected-only captured directly, with no composited substitute UI.
    await js('document.activeElement.blur()'); await pointer(10,10); await capture('f-default-roster');
    const hover=await js("(()=>{const r=document.querySelector('[aria-label=\"Select Mina\"]').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");
    win.webContents.sendInputEvent({type:'mouseMove',...hover}); await settle(); assert.equal(await js("document.querySelector('[aria-label=\"Select Mina\"]').matches(':hover')"),true); await capture('f-hover-mina');
    await select('Mina'); await js('document.activeElement.blur()'); await pointer(10,10); await capture('f-selected-only-mina');
    record.observations.desktop=await layout();
    assert.equal(record.observations.desktop.dock.width,304); assert.equal(record.observations.desktop.horizontalOverflow,false);
    assert.deepEqual(record.observations.desktop.controlHeights,[44,44,44]);
    for(const portrait of record.observations.desktop.portraits) assert.equal(portrait.pixelated,'pixelated');
    win.setContentSize(760,540); await settle(); await capture('e-compact-selected'); record.observations.compact=await layout();
    assert.equal(record.observations.compact.horizontalOverflow,false); assert.equal(record.observations.compact.room.width,640); assert.equal(record.observations.compact.room.height,360);
    assert.ok(record.observations.compact.summary.bottom<=540); assert.ok(record.observations.compact.roster.bottom<=540);
    await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await settle(); await capture('e-compact-inspector-scroll'); assert.ok((await state()).scroll>0);
    await js('scrollTo(0,0)');
    const longActivity='Reviewing the exact accepted text.\n'+ 'unbroken'.repeat(56); assert.ok(Buffer.byteLength(longActivity,'utf8')<=512);
    await update('Mina','waiting',longActivity,'approval_required'); await settle();
    assert.equal(await js("document.querySelector('dd').textContent"),longActivity);
    record.observations.longCompact=await layout(); assert.equal(record.observations.longCompact.horizontalOverflow,false); assert.equal(record.observations.longCompact.activityWhiteSpace,'pre-wrap'); assert.equal(record.observations.longCompact.inspectorOverflow,'visible');
    await capture('k-compact-long-top'); await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})"); await settle(); await capture('k-compact-long-inspector');
    await js('scrollTo(0,0)'); win.setContentSize(1100,760); await settle(); await capture('k-desktop-long'); record.observations.longDesktop=await layout();
    assert.equal(record.observations.longDesktop.horizontalOverflow,false); assert.equal(record.observations.longDesktop.dock.width,304);
    assert.ok(record.observations.longDesktop.dock.height>record.observations.desktop.dock.height);
    assert.ok(record.observations.longCompact.documentHeight>540);
    await invoke("await fixture.reset('unavailable')"); await renderedRoom(); await settle(); await selected('Mina'); assert.equal((await state()).lifecycle,null); assert.equal((await state()).freshness,null); assert.equal((await state()).details,'No trusted agent state available yet.'); await capture('l-selected-no-trusted-state');
    await invoke("await fixture.reset('live')"); await renderedRoom(); await settle();
    await select('Sol'); await update('Sol','waiting','Waiting for approval.','approval_required'); await settle(); await capture('m-generic-sol-waiting'); assert.equal((await state()).lifecycle,'Waiting'); assert.ok(!(await state()).details.includes('coffee'));
    await update('Sol','waiting','Taking a coffee break in the simulated office'); await settle(); const coffeeFocusCalls=await js('window.us028FocusCalls'); await wait(1100); await selected('Sol'); assert.equal(await js('window.us028FocusCalls'),coffeeFocusCalls);
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); await settle(); await capture('n-emulated-reduced-motion-coffee');
    record.observations.reducedMotion='Chromium emulation only; no new UI motion or native OS preference claim.';
    const reload=new Promise(resolve=>win.webContents.once('did-finish-load',resolve)); win.webContents.reload(); await reload; await wait(500); assert.equal((await state()).canvases,1); record.observations.reloadOneCanvas=true;
    assert.deepEqual(errors,[]); record.observations.rendererErrors=errors;
    writeFileSync(`${output}/capture-record.json`,JSON.stringify(record,null,2)+'\n');
    console.log('PASS',JSON.stringify(record.observations));
  } finally { win.destroy(); app.quit(); }
}).catch(error=>{console.error(error);app.exit(1);});
