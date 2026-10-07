// Runs the built production main/window, then a production-component fixture.
// Chromium automation is not native keyboard or assistive-technology evidence.
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback development URL');
const output = resolve(__dirname, '../../../docs/verification/assets/us-030');
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
  const record = { baseline: 'b129c806326a7a784eeb493f21b18b2dc19ed1e3', capturedAt: new Date().toISOString(),
    electron: process.versions.electron, platform: process.platform,
    provenance: 'Unedited capturePage of the native framed window created by production main. Initial production-root captures use the real development simulator/preload/store path. Later captures use production Application/store/runtime/host/Phaser with synthetic accepted renderer inputs. Chromium input/media automation is not native manual accessibility evidence. No frame-height constant or useContentSize override.',
    sourceSha256: {}, captures: [], observations: {} };
  mkdirSync(output, { recursive: true });
  for (const path of ['src/style.css', 'src/Application.tsx', 'src/office/OfficeSceneHost.tsx', 'src/office/AgentSelector.tsx',
    'src/office/AgentInspectionPanel.tsx', 'src/office/SelectedAgentSummary.tsx', 'src/office/OfficeScene.ts',
    'src/office/officeLayout.ts', 'src/office/createOfficeGame.ts', 'src/office/officePresentationRuntime.ts',
    'electron/main.ts', 'verification/us-030.tsx', 'verification/us-030.html', 'verification/capture-us-030.cjs']) {
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
        if (colors.size > 10) { return; }
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
    record.captures.push({ name, classification: input.startsWith('production root:') ? 'DIRECT RUNTIME EVIDENCE — PRODUCTION ROOT' : 'DIRECT RUNTIME EVIDENCE — SUPPLEMENTAL RENDERER FIXTURE', input, sampledAt: new Date().toISOString(),
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
    const url = await js("document.querySelector('script[src*=\"us-030.tsx\"]').src");
    return js(`import(${JSON.stringify(url)}).then(async ({fixture})=>{${code}})`);
  };
  const update = (name, next, activity, reason) => invoke(`fixture.update('mock-agent-'+${JSON.stringify(name.toLowerCase())},${JSON.stringify(next)},${JSON.stringify(activity)},${JSON.stringify(reason)})`);
  const pointer = async (x, y) => {
    const r = (await layout()).room, point = { x: Math.round(r.x + x), y: Math.round(r.y + y) };
    for (const event of [{ type: 'mouseMove' }, { type: 'mouseDown', button: 'left', clickCount: 1 }, { type: 'mouseUp', button: 'left', clickCount: 1 }]) win.webContents.sendInputEvent({ ...event, ...point });
    await settle();
  };
  // Read-only instance queries; verification observers delegate original methods
  // without changing arguments/results or forcing frames, clocks, timers or state.
  const sceneProbe = `(()=>{const s=window.us030Scene;if(!s?.children)return null;
    const objects=s.children.list;
    const agents=Object.fromEntries(['ari','mina','sol'].map(name=>{const o=s.children.getByName('mock-agent-'+name);
      return[name,o?{frame:Number(o.frame.name),texture:o.texture.key,playing:o.anims.isPlaying,x:o.x,y:o.y}:null]}));
    const graphics=objects.filter(o=>o.type==='Graphics').map(o=>({x:o.x,y:o.y,depth:o.depth,visible:o.visible,commands:[...o.commandBuffer]}));
    return{agents,graphics};})()`;
  const probe = () => js(sceneProbe);
  const trace = async (label, milliseconds, expectedFrame, id='ari') => {
    const samples = await js(`new Promise(resolve=>{const out=[];const start=performance.now();
      const tick=()=>{out.push({elapsedMs:performance.now()-start,scene:${sceneProbe}});
        if(performance.now()-start>=${milliseconds})resolve(out);else setTimeout(tick,20)};tick()})`);
    if (expectedFrame !== undefined) for (const sample of samples) assert.equal(sample.scene.agents[id].frame, expectedFrame, `${label}: ${id} must remain settled`);
    record.observations.temporal.push({ label, sampling: '20ms requested renderer sampling; observed timestamps below; not continuous video', samples });
    return samples;
  };
  const media = async value => {
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
    await wait(60);
  };
  const expectedMarks = {
    idle: [], working: [[6,2,3,2],[11,4,4,2]], waiting: [[6,3,3,3],[11,3,3,3]],
    completed: [[7,2,1,4],[12,2,1,4],[7,6,6,1]],
    error: [[9,1,2,1],[8,2,1,1],[11,2,1,1],[7,3,1,2],[12,3,1,2],[8,5,1,1],[11,5,1,1],[9,6,2,1]],
  };
  const fillRects = commands => {
    // Phaser 3.90 Graphics Commands: FILL_STYLE=7 takes 2 arguments; FILL_RECT=3 takes 4.
    const rects=[];
    for(let i=0;i<commands.length;) {
      const op=commands[i++];
      if(op===7)i+=2;else if(op===3){rects.push(commands.slice(i,i+4));i+=4;}
      else throw new Error(`Unexpected monitor command ${op}`);
    }
    return rects.slice(1); // First rectangle is the unchanged 20×8 blue-gray field.
  };
  const monitor = (scene, name) => scene.graphics.find(g=>g.x===(name==='ari'?316:504)&&g.y===102);
  const assertStable = (scene, name, next) => {
    const row=name==='ari'?0:name==='mina'?8:16;
    assert.equal(scene.agents[name].frame,row+({idle:0,working:1,waiting:2,completed:3,error:4})[next]);
    if(name!=='sol')assert.deepEqual(fillRects(monitor(scene,name).commands),expectedMarks[next]);
  };
  const temporalImage = async name => {
    const geometry=await layout(), image=await win.webContents.capturePage({x:geometry.room.x,y:geometry.room.y,width:640,height:360});
    const png=image.toPNG();writeFileSync(`${output}/${name}.png`,png);
    record.captures.push({name,classification:'DIRECT RUNTIME EVIDENCE — SUPPLEMENTAL RENDERER FIXTURE',input:'synthetic accepted renderer inputs',sampledAt:new Date().toISOString(),crop:{x:geometry.room.x,y:geometry.room.y,width:640,height:360},size:image.getSize(),pngSha256:hash(png),...geometry});
    return image.toBitmap();
  };
  const repo=resolve(__dirname,'../../..');
  const tracked=execFileSync('git',['ls-files','apps/desktop/src','apps/desktop/electron','apps/desktop/shared','packages/contracts','package.json','package-lock.json'],{cwd:repo,encoding:'utf8'}).trim().split('\n');
  record.productionSourceSha256=Object.fromEntries(tracked.map(path=>[path,hash(readFileSync(resolve(repo,path)))]));
  record.productionTreeSha256=hash(Buffer.from(JSON.stringify(Object.entries(record.productionSourceSha256).sort())));
  record.builtMainSha256=hash(readFileSync(resolve(__dirname,'../out/main/main.js')));
  record.observations.temporal=[];
  record.observations.manual='PENDING — no Product Owner native observations recorded by this runner';
  try {
    await ready();
    // Observe the real singleton store already loaded by the production renderer.
    await js(`import('/src/agentState/runtime.ts').then(({agentStateStore,officePresentationRuntime})=>{
      window.us030Production={store:agentStateStore,runtime:officePresentationRuntime};
      window.us030Journey=[];
      const log=()=>window.us030Journey.push({at:performance.now(),state:agentStateStore.getSnapshot(),presentation:officePresentationRuntime.getSnapshot(),scene:${sceneProbe}});
      log();agentStateStore.subscribeAcceptedUpdates(()=>log());
    })`);
    await js(`import('/src/office/OfficeScene.ts').then(({OfficeScene})=>{
      const original=OfficeScene.prototype.setAgentPresentation;
      OfficeScene.prototype.setAgentPresentation=function(...args){
        window.us030Scene=this;OfficeScene.prototype.setAgentPresentation=original;
        return original.apply(this,args);
      };
    })`);
    await select('Mina');
    const initial=await capture('01-desktop-final','production root: authenticated local development simulator'); invariant(initial);
    await resize(760,540); const compact=await capture('02-compact-final','production root: authenticated local development simulator'); invariant(compact);
    assert.ok(compact.room.bottom<=compact.viewport[1]);assert.ok(compact.summary.bottom<=compact.viewport[1]);
    // Wait on accepted production state, not an assumed wall-clock deadline.
    for(let i=0;i<180;i++) {
      if(await js("window.us030Production.store.getSnapshot().agentsById['mock-agent-sol']?.activity==='Taking a coffee break in the simulated office'"))break;
      await wait(30);
    }
    await resize(1100,760);await select('Sol');
    const coffee=await capture('04-canonical-sol-coffee','production root: authenticated local development simulator'); invariant(coffee);
    assert.equal(coffee.state.lifecycle,'Waiting');assert.equal(coffee.state.activity,'Taking a coffee break in the simulated office');
    const coffeeProbe=await probe();assert.equal(coffeeProbe.agents.sol.texture,'mock-agents');assert.ok([4,5].includes(coffeeProbe.agents.sol.frame));
    assert.equal(coffeeProbe.graphics.find(g=>g.x===230&&g.y===248).visible,true);
    for(let i=0;i<160;i++) {
      if(await js("window.us030Production.store.getSnapshot().agentsById['mock-agent-mina']?.state==='completed'"))break;
      await wait(30);
    }
    await wait(650);
    record.observations.productionJourney=await js('window.us030Journey');
    const journey=record.observations.productionJourney;
    const wanted=[['ari','idle','Ready for a task'],['ari','working','Implementing the change'],['mina','working','Reviewing the change'],
      ['sol','waiting','Taking a coffee break in the simulated office'],['ari','completed','Change implemented'],['mina','completed','Review complete']];
    let cursor=-1;
    for(const [name,next,activity] of wanted) {
      const index=journey.findIndex((entry,i)=>i>cursor&&entry.state.agentsById['mock-agent-'+name]?.state===next&&entry.state.agentsById['mock-agent-'+name]?.activity===activity);
      assert.ok(index>cursor,`Real simulator journey did not observe ${name} ${next}; capture startup may have missed initial input`);cursor=index;
      const entry=journey[index];assert.equal(entry.presentation['mock-agent-'+name].state,next);
    }
    const settled=await probe();assertStable(settled,'ari','completed');assertStable(settled,'mina','completed');
    await select('Mina');await capture('journey-completed','production root: authenticated local development simulator');
    record.observations.productionJourneySettled=settled;
    win.webContents.debugger.attach('1.3');
    await win.loadURL(`${base}/verification/us-030.html`);await ready();await invoke('window.us030Scene=fixture.scene()');
    await media('no-preference');
    await select('Ari');
    // Eligible live terminal entries: observe actual sprite frames + monitor buffers,
    // and preserve direct acknowledgement/settled Error captures for Designer review.
    for(const terminal of ['completed','error']) {
      await update('Ari','working','Preparing the terminal transition');
      await invoke(`fixture.update('mock-agent-ari',${JSON.stringify(terminal)},'Supplemental '+${JSON.stringify(terminal)})`);
      if(terminal==='error')await temporalImage('error-acknowledgement');
      const samples=await trace(`${terminal} eligible entry and settling`,800);
      const ack=terminal==='completed'?6:7,stable=terminal==='completed'?3:4;
      assert.ok(samples.some(s=>s.scene.agents.ari.frame===ack),`${terminal}: acknowledgement must be observed`);
      assert.equal(samples.at(-1).scene.agents.ari.frame,stable);
      if(terminal==='error')await temporalImage('error-settled');
      assertStable(samples.at(-1).scene,'ari',terminal);
      for(const [label,code] of [
        ['activity-only',`fixture.update('mock-agent-ari','${terminal}','Activity-only ${terminal}')`],
        ['reason-only',`fixture.update('mock-agent-ari','${terminal}','Activity-only ${terminal}','approval_required')`],
        ['snapshot repair','fixture.repair()'],
      ]) {await invoke(code);await trace(`${terminal}: ${label} non-replay`,560,stable);}
      await select('Mina');await select('Ari');await trace(`${terminal}: selection non-replay`,560,stable);
      await invoke("fixture.connection('disconnected')");await trace(`${terminal}: retained non-replay`,560,stable);
      await invoke("fixture.connection('synchronizing')");await trace(`${terminal}: synchronizing non-replay`,560,stable);
      await invoke("fixture.connection('ready')");await trace(`${terminal}: resync non-replay`,560,stable);
      await media('reduce');await media('no-preference');await trace(`${terminal}: preference restoration non-replay`,560,stable);
      await invoke('fixture.remount()');await ready();await invoke('window.us030Scene=fixture.scene()');await trace(`${terminal}: game remount non-replay`,560,stable);
    }
    await update('Ari','working','Before cancelled acknowledgement');
    await invoke("fixture.update('mock-agent-ari','completed','Superseded Completed');fixture.update('mock-agent-ari','waiting','Newer Waiting')");
    await trace('stale Completed timer cannot overwrite Waiting',750,2);
    await invoke("fixture.update('mock-agent-ari','error','Superseded Error');fixture.update('mock-agent-ari','idle','Newer Idle')");
    await trace('stale Error timer cannot overwrite Idle',750,0);

    record.observations.workstations=[];
    for(const next of ['idle','working','waiting','completed','error']) {
      for(const name of ['Ari','Mina'])await update(name,next,`Supplemental workstation ${next}`);
      await wait(next==='completed'?650:next==='error'?500:60);
      const scene=await probe();
      for(const name of ['ari','mina'])assertStable(scene,name,next);
      assert.equal(scene.graphics.filter(g=>g.y===102).length,2);
      record.observations.workstations.push({next,scene});
      if(next==='working') {
        const samples=await trace('live Working character and workstation alternation',2600);
        for(const name of ['ari','mina']) {
          assert.ok(new Set(samples.map(s=>s.scene.agents[name].frame)).size===2);
          assert.ok(new Set(samples.map(s=>JSON.stringify(monitor(s.scene,name).commands))).size===2);
        }
      }
    }
    await update('Sol','waiting','Generic waiting, not coffee.');await select('Sol');
    const negative=await capture('05-generic-sol-waiting');assert.equal(negative.state.lifecycle,'Waiting');assert.equal(negative.state.activity,'Generic waiting, not coffee.');
    const negativeScene=await probe();assertStable(negativeScene,'sol','waiting');assert.equal(negativeScene.graphics.find(g=>g.x===230&&g.y===248).visible,false);
    record.observations.coffee={canonical:coffeeProbe,genericWaiting:negativeScene};
    const long='Reviewing the local change while preserving exact activity, selected identity and readable contextual inspection. '.repeat(3);
    await update('Mina','waiting',long,'approval_required');await select('Mina');await resize(760,540);
    const longLayout=await layout();invariant(longLayout);assert.equal(longLayout.state.activity,long);assert.equal(longLayout.activityWhiteSpace,'pre-wrap');
    await js("document.querySelector('.agent-inspection').scrollIntoView({block:'start'})");await settle();
    const inspector=await capture('03-compact-inspector');assert.ok(inspector.scroll>0);assert.equal(inspector.state.activity,long);invariant(inspector);
    record.observations.longContent=inspector;
    await js('scrollTo(0,0)');await resize(1100,760);
    // Existing Chromium input seam; only the initial anchor is programmatic.
    const key=async(key,code,virtual,modifiers=0)=>{
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:key==='Enter'?'keyDown':'rawKeyDown',key,code,windowsVirtualKeyCode:virtual,modifiers,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual,modifiers});await settle();
    };
    record.observations.keyboard=[];
    for(const [width,height] of [[1100,760],[760,540]]) {
      await resize(width,height);await select('Mina');await js("document.querySelector('[aria-label=\"Select Ari\"]').focus()");
      await key('Tab','Tab',9);assert.equal((await state()).focus,'Select Mina');
      await key('Tab','Tab',9);assert.equal((await state()).focus,'Select Sol');assert.equal((await state()).selected,'Select Mina');
      assert.equal(await js("document.activeElement.matches(':focus-visible')"),true);
      const outline=await js("({style:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth,color:getComputedStyle(document.activeElement).outlineColor})");
      assert.equal(outline.style,'solid');assert.equal(outline.width,'3px');
      if(width===760)await capture('focus-sol-selected-mina');
      await key('Tab','Tab',9);assert.equal(await js("document.activeElement===document.querySelector('.clear-selection-button')"),true);
      await key(' ','Space',32);assert.equal((await state()).selected,null);
      assert.equal(await js("document.activeElement.matches(':focus-visible')&&document.activeElement===document.querySelector('.clear-selection-button')"),true);
      assert.equal((await probe()).graphics.find(g=>g.depth===11).commands.length,0);
      await key('Tab','Tab',9,8);assert.equal((await state()).focus,'Select Sol');await key('Enter','Enter',13);assert.equal((await state()).selected,'Select Sol');
      await key('Tab','Tab',9,8);assert.equal((await state()).focus,'Select Mina');await key(' ','Space',32);assert.equal((await state()).selected,'Select Mina');
      await js('scrollTo(0,0)');const before=await state();
      await update('Mina','working','Keyboard state update');await settle();assert.equal((await state()).focus,before.focus);assert.equal((await state()).scroll,before.scroll);
      await invoke("fixture.connection('disconnected')");await settle();assert.equal((await state()).focus,before.focus);assert.equal((await state()).scroll,before.scroll);
      await invoke("fixture.connection('synchronizing');fixture.connection('ready')");await settle();
      record.observations.keyboard.push({native:[width,height],method:'Chromium Tab/Shift+Tab/Space/Enter; programmatic initial anchor',focusOnlyDoesNotSelect:true,clearRetainsVisibleFocus:true,stateAvailabilityFocusScrollPreserved:true,outline});
    }
    await js('scrollTo(0,0)');const beforeResize=await state();
    for(const width of [1012,1011,760]){await resize(width,540);assert.equal((await state()).focus,beforeResize.focus);assert.equal((await state()).selected,beforeResize.selected);invariant(await layout());}
    record.observations.resizePreservesSelectionFocus=true;
    // World pointer selection must agree with inspector/roster; no artificial click hook.
    for(const [name,x,y] of [['Ari',269,119],['Mina',457,119],['Sol',197,227]]){await pointer(x,y);assert.equal((await state()).selected,`Select ${name}`);assert.equal((await state()).name,name);}
    record.observations.worldSelectionAllThree=true;
    await update('Ari','working','Retained working');await update('Mina','waiting','Retained approval','approval_required');
    await update('Sol','waiting','Taking a coffee break in the simulated office');await select('Mina');await resize(1100,760);
    await invoke("fixture.connection('disconnected')");await settle();
    const retained=await capture('06-retained-non-live');assert.equal(retained.state.lifecycle,'Waiting');assert.equal(retained.state.freshness,'Last known · Not live');
    const first=await probe();await wait(1800);assert.deepEqual(await probe(),first);
    await invoke("fixture.connection('synchronizing')");await settle();const synchronizing=await state();assert.equal(synchronizing.freshness,'Last known · Not live');
    await invoke("fixture.connection('ready')");await settle();const restored=await state();assert.equal(restored.freshness,'Current information');assert.equal(restored.selected,'Select Mina');
    record.observations.retention={retained:retained.state,synchronizing,restored,staticAcross1800ms:true};
    record.observations.semantics=await js(`({buttons:[...document.querySelectorAll('.agent-selector-button')].map(b=>({tag:b.tagName,name:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),controls:b.getAttribute('aria-controls')})),
      inspectorLabelledBy:document.querySelector('.agent-inspection').getAttribute('aria-labelledby'),heading:document.querySelector('#agent-inspection-title').tagName,
      feedback:{live:document.querySelector('.sr-only').getAttribute('aria-live'),atomic:document.querySelector('.sr-only').getAttribute('aria-atomic'),text:document.querySelector('.sr-only').textContent},
      availability:{role:document.querySelector('.connection-status').getAttribute('role'),live:document.querySelector('.connection-status').getAttribute('aria-live'),text:document.querySelector('.connection-status').textContent},
      order:[...document.querySelector('.office-world').children].map(e=>e.className),portraits:[...document.querySelectorAll('.agent-portrait')].map(e=>({hidden:e.getAttribute('aria-hidden'),style:e.getAttribute('style')}))})`);
    for(const b of record.observations.semantics.buttons){assert.equal(b.tag,'BUTTON');assert.equal(b.controls,'agent-inspection-details');assert.ok(['true','false'].includes(b.pressed));}
    assert.equal(record.observations.semantics.inspectorLabelledBy,'agent-inspection-title');assert.equal(record.observations.semantics.feedback.live,'polite');assert.equal(record.observations.semantics.availability.role,'status');
    await resize(760,540);await invoke("await fixture.reset('unavailable')");await settle();
    const empty=await state();assert.equal(empty.selected,'Select Mina');assert.equal(empty.lifecycle,null);assert.equal(empty.details,'No trusted agent state available yet.');record.observations.noTrustedState=empty;
    await invoke("await fixture.reset('live')");await ready();await invoke('window.us030Scene=fixture.scene()');await media('reduce');record.observations.reducedMotion=[];
    for(const next of ['idle','working','waiting','completed','error','coffee']) {
      for(const name of ['Ari','Mina','Sol'])await update(name,next==='coffee'?'waiting':next,next==='coffee'&&name==='Sol'?'Taking a coffee break in the simulated office':`Static ${next} meaning`);
      await select(next==='coffee'?'Sol':'Mina');const scene=await probe();
      const first=await temporalImage(`reduced-${next}`);await wait(1800);
      const rect=(await layout()).room, second=await win.webContents.capturePage({x:rect.x,y:rect.y,width:640,height:360});
      assert.equal(Buffer.compare(first,second.toBitmap()),0,`${next}: reduced office must remain static`);
      assert.deepEqual(await probe(),scene);
      const presentation=await invoke('return fixture.presentation()');assert.ok(Object.values(presentation).every(p=>p.reducedMotion));
      record.observations.reducedMotion.push({next,method:'Chromium media emulation, NOT native OS preference',identicalDecodedOfficePixelsAcross1800ms:true,scene,presentation});
    }
    const loaded=new Promise(done=>win.webContents.once('did-finish-load',done));win.webContents.reload();await loaded;await ready();assert.equal((await state()).canvases,1);
    record.observations.reloadOneCanvas=true;
    assert.deepEqual(errors,[]);record.observations.rendererErrors=errors;
    // Reused US-029 responsive evidence is historical. Verify applicable production hashes.
    const previous=JSON.parse(readFileSync(resolve(repo,'docs/verification/assets/us-029/capture-record.json')));
    record.reusedUS029={path:'docs/verification/assets/us-029/capture-record.json',sha256:hash(readFileSync(resolve(repo,'docs/verification/assets/us-029/capture-record.json'))),applicableSourceHashes:{}};
    for(const [path,sha] of Object.entries(previous.sourceSha256))if(!path.startsWith('verification/')) {
      assert.equal(hash(readFileSync(resolve(__dirname,'..',path))),sha);record.reusedUS029.applicableSourceHashes[path]=sha;
    }
    writeFileSync(`${output}/capture-record.json`,JSON.stringify(record,null,2)+'\n');
    console.log('PASS US-030 integrated renderer:',record.captures.length,'direct captures;',record.observations.temporal.length,'temporal scenarios');
  } catch(error) {
    writeFileSync(`${output}/failed-attempt.json`,JSON.stringify({error:String(error),record},null,2)+'\n');throw error;
  }
}
run().then(()=>app.quit()).catch(error=>{console.error(error);app.once('will-quit',()=>app.exit(1));app.quit();});
