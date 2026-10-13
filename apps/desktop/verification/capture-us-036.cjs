// Original Electron evidence; synthetic fixture and Chromium input are labeled separately.
const { app, BrowserWindow, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const { verifyImage } = require('./us-035-image.cjs');
const repo = resolve(__dirname, '../../..'), output = resolve(repo, 'docs/verification/assets/us-036');
const base = process.argv[2] ?? 'http://localhost:5173';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const wait = ms => new Promise(done => setTimeout(done, ms));
const session = process.argv[3] ?? 'fixture';
assert.ok(['fixture','simulator','unavailable','recovery','reproduce'].includes(session));
assert.notEqual(session, 'reproduce', 'Baseline failure evidence is archived; never overwrite it from the corrected tree.');
const interactionOnly=process.argv.includes('--interaction-only');
const record = { session, interactionOnly, baseline: git('rev-parse','HEAD'), tree: git('rev-parse','HEAD^{tree}'), branch: git('branch','--show-current'), capturedAt: new Date().toISOString(), inputs: [], captures: [], observations: {} };
async function run() {
  process.env.ELECTRON_RENDERER_URL = base;
  if (session === 'unavailable') delete process.env.COFFEE_BREAK_LOCAL_SIMULATION;
  else process.env.COFFEE_BREAK_LOCAL_SIMULATION = '1';
  if (session === 'recovery') process.env.COFFEE_BREAK_SIMULATION_RECOVERY = '1';
  await import(pathToFileURL(resolve(__dirname,'../out/main/main.js')).href); await app.whenReady();
  const win = BrowserWindow.getAllWindows()[0]; assert.ok(win); win.setTitle('US-036 Automated Renderer Evidence'); win.show(); win.focus(); win.webContents.setBackgroundThrottling(false);
  mkdirSync(output,{recursive:true});
  let fixtureLoaded=false;
  const js = code => win.webContents.executeJavaScript(code).catch(error=>{console.error('Failed renderer expression:',code);throw error});
  const invoke = code => js("import([...document.scripts].find(s=>s.src&&new URL(s.src).pathname==='/verification/us-035.tsx').src).then(async({fixture})=>{"+code+'})');
  const ready = async(fixture=true) => { for(let i=0;i<80;i++){if(await js("document.querySelectorAll('canvas').length===1&&!!document.querySelector('.worlds-section')")&&(!fixture||await invoke('return !!fixture.scene()?.children.list.length;'))) return;await wait(100);}throw Error('Initialization timeout'); };
  const rendererErrors=[];win.webContents.on('console-message',event=>{if(event.level==='error')rendererErrors.push(event.message)});
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Page.enable');
  await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:`window.us036Listeners={resize:new Set(),escape:new Set()};const originalAdd=window.addEventListener,originalRemove=window.removeEventListener;window.addEventListener=function(type,fn,...args){if(type==='resize'&&fn.name==='scheduleFocusCheck')window.us036Listeners.resize.add(fn);if(type==='keydown'&&fn.name==='escape')window.us036Listeners.escape.add(fn);return originalAdd.call(this,type,fn,...args)};window.removeEventListener=function(type,fn,...args){if(type==='resize')window.us036Listeners.resize.delete(fn);if(type==='keydown')window.us036Listeners.escape.delete(fn);return originalRemove.call(this,type,fn,...args)};`});
  const key = async(key,code,virtual,modifiers=0) => { record.inputs.push({action:'Chromium keyboard',key,modifiers}); const p={key,code,windowsVirtualKeyCode:virtual,nativeVirtualKeyCode:virtual,modifiers}; await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',...p,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})}); await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...p});await wait(60); };
  const settle = () => js('new Promise((resolve,reject)=>{let last="",stable=0,frames=0;const deadline=setTimeout(()=>reject(Error("Layout settlement timeout")),2500);function sample(){const next=JSON.stringify({scroll:[scrollX,scrollY],font:getComputedStyle(document.documentElement).fontSize,boxes:[...document.querySelectorAll(".studio-toolbar,.worlds-section,.agent-inspection,.agents-section,canvas,details")].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})});stable=next===last?stable+1:0;last=next;frames++;if(stable>=3){clearTimeout(deadline);resolve({frames,consecutiveStableFrames:stable+1})}else requestAnimationFrame(sample)}requestAnimationFrame(sample)})');
  const layout = () => js('('+(()=>{
    const q=s=>document.querySelector(s), box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},visible=e=>!!e&&!!e.getClientRects().length;
    const active=document.activeElement,toolbar=q('.studio-toolbar'),borders={};
    for(const [name,selector,rgb] of [['toolbar','.studio-toolbar',[36,59,82]],['office','.office-scene-host',[99,125,153]],['worlds','.worlds-section',[36,59,82]],['inspector','.agent-inspection',[36,59,82]]]) { const e=q(selector);borders[name]={bounds:box(e),rgb,visible:visible(e)&&(name==='toolbar'||box(e).y>=box(toolbar).y+box(toolbar).height)&&(name!=='inspector'||e.dataset.selected==='true')}; }
    return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,rootFont:getComputedStyle(document.documentElement).fontSize,scroll:[scrollX,scrollY],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],overflow:document.documentElement.scrollWidth>innerWidth,canvases:document.querySelectorAll('canvas').length,canvas:box(q('canvas')),toolbar:box(toolbar),borders,
      expanded:q('main').dataset.expanded==='true',selected:q('.agent-inspection h2').textContent,details:q('.agent-inspection-details').textContent,lifecycle:q('.agent-inspection-lifecycle')?.textContent??null,freshness:q('.agent-inspection-freshness')?.textContent??null,status:q('.connection-status').textContent,statusRegions:document.querySelectorAll('[role="status"]').length,
      masks:getComputedStyle(active).outlineStyle!=='none'?[{x:box(active).x-6,y:box(active).y-6,width:box(active).width+12,height:box(active).height+12}]:[],focused:active.id||active.getAttribute('aria-label')||active.textContent.trim(),focus:{bounds:box(active),visible:active.matches(':focus-visible'),outline:getComputedStyle(active).outline,offset:getComputedStyle(active).outlineOffset},focusEvents:window.us036FocusEvents??0};
  }).toString()+')()');
  const capture = async(name) => {
    let failure;
    for(let attempt=1;attempt<=6;attempt++) {
      const settlement={attempt,...await settle()},before=await layout();assert.equal(before.overflow,false);assert.equal(before.canvases,1);assert.deepEqual([before.canvas.width,before.canvas.height],[640,360]);
      if(/-room$/.test(name)){assert.ok(before.canvas.y>=before.toolbar.y+before.toolbar.height);assert.ok(before.canvas.y+360<=before.viewport[1]);}
      const png=(await win.webContents.capturePage()).toPNG(),after=await layout();
      try { assert.deepEqual(after,before);const correspondence=verifyImage(png,before);writeFileSync(resolve(output,name+'.png'),png);record.captures.push({name,sourceClass:fixtureLoaded?'supplemental production-component fixture':session==='reproduce'?'supplemental production-component fixture':session==='recovery'?'production authenticated recovery simulator':session==='unavailable'?'ordinary production startup':'production authenticated simulator',inputThrough:record.inputs.length,sampledAt:new Date().toISOString(),trustedState:fixtureLoaded?await invoke('return fixture.snapshot()'):await productionSnapshot(),presentation:fixtureLoaded?await invoke('return fixture.presentation()'):null,outer:win.getBounds(),contentBounds:win.getContentBounds(),zoom:win.webContents.getZoomFactor(),...before,imageSize:nativeImage.createFromBuffer(png).getSize(),pngSha256:hash(png),settlement,correspondence});return before; } catch(error){ failure=error; }
    }
    throw failure;
  };
  const finish = async name => {
    const paths=git('ls-files','apps/desktop/src','apps/desktop/electron','apps/desktop/shared','packages/contracts','docs/design/references','docs/verification/assets/us-031','docs/verification/assets/us-032','docs/verification/assets/us-033','docs/verification/assets/us-034','docs/verification/assets/us-035','package.json','package-lock.json').split('\n').filter(Boolean);
    record.sourceSha256=Object.fromEntries(paths.map(p=>[p,hash(readFileSync(resolve(repo,p)))]));
    record.buildSha256=Object.fromEntries(['apps/desktop/out/main/main.js','apps/desktop/out/main/simulator.js','apps/desktop/out/preload/preload.cjs'].map(p=>[p,hash(readFileSync(resolve(repo,p)))]));
    record.toolingSha256=hash(readFileSync(__filename));record.imageToolSha256=hash(readFileSync(resolve(__dirname,'us-035-image.cjs')));record.fixtureSha256=hash(readFileSync(resolve(__dirname,'us-035.tsx')));record.runtime={...process.versions,platform:process.platform};
    assert.deepEqual(rendererErrors,[]);record.observations.rendererErrors=rendererErrors;
    record.nativeObservations={keyboard:'User-assisted aggregate checklist confirmation: I checked everything and seems to be correct',voiceOver:'unverified',nativeReducedMotion:'unverified'};
    writeFileSync(resolve(output,name),JSON.stringify(record,null,2)+'\n');console.log('PASS US-036 '+session+': '+record.captures.length+' original captures');
  };
  const resize = async(w,h) => { record.inputs.push({action:'native setSize',size:[w,h]});win.setSize(w,h);await settle();assert.deepEqual(win.getSize(),[w,h]); };
  const loadFixture = async() => { fixtureLoaded=true;await win.webContents.loadURL(base+'/verification/us-035.html');await ready();win.focus();win.webContents.focus(); };
  const click = async selector => {record.inputs.push({action:'DOM activation',selector});await js('document.querySelector('+JSON.stringify(selector)+').click()');await settle();};
  const expand = () => click('.expand-reservation button');
  const update = async(state,activity='Ready',reason) => {record.inputs.push({action:'synthetic accepted update',id:'mock-agent-mina',state,activity,reason});await invoke(`fixture.update('mock-agent-mina',${JSON.stringify(state)},${JSON.stringify(activity)},${JSON.stringify(reason)})`);await settle();};
  const scroll = async selector => {record.inputs.push({action:'document scroll to region',selector});await js('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await settle();};
  const focusClear = async() => {
    for(let i=0;i<16;i++){if(await js('document.activeElement.matches(".clear-selection-button")'))return;await key('Tab','Tab',9);if(await js('document.activeElement.matches(".agent-selector-button:nth-child(2)")'))await key(' ','Space',32);}
    throw Error('Keyboard cannot reach Clear');
  };
  const focusGeometry = async() => {
    const value=await layout(),below=await js('document.querySelector(".office-composition").contains(document.activeElement)&&!document.querySelector(".studio-toolbar").contains(document.activeElement)');
    if(below){assert.ok(value.focus.bounds.y-value.toolbar.y-value.toolbar.height>=6,JSON.stringify(value));assert.ok(value.viewport[1]-value.focus.bounds.y-value.focus.bounds.height>=6,JSON.stringify(value));}
    return {...value,belowToolbar:below};
  };
  const productionSnapshot = () => js('import("/src/agentState/runtime.ts").then(m=>m.agentStateStore.getSnapshot())');
  const waitFor = async predicate => {for(let i=0;i<400;i++){if(await predicate())return;await wait(30);}throw Error('Runtime observation timeout');};
  if(['simulator','unavailable','recovery'].includes(session)) {
    await ready(false);
    if(session==='simulator') await waitFor(async()=> (await productionSnapshot()).agentsById['mock-agent-mina']?.state==='completed');
    if(session==='unavailable') await waitFor(async()=> (await productionSnapshot()).connection==='disconnected');
    if(session==='recovery') {
      record.observations.recovery=[];
      for(const phase of ['retained','synchronizing','recovered']) {
        await waitFor(async()=>{const s=await productionSnapshot();return phase==='retained'?s.connection==='disconnected'&&Object.keys(s.agentsById).length===3:phase==='synchronizing'?s.connection==='connecting'&&Object.keys(s.agentsById).length===3: s.connection==='connected'&&s.synchronized;});
        const snapshot=await productionSnapshot();record.observations.recovery.push({phase,snapshot});
        for(const [w,h] of [[1100,760],[760,540]]){await resize(w,h);await js('scrollTo(0,0)');await capture(`${w}-recovery-${phase}-100`);}
      }
      assert.notEqual(record.observations.recovery[0].snapshot.sessionId,record.observations.recovery[2].snapshot.sessionId);
    } else for(const [w,h] of [[1100,760],[760,540]]){await resize(w,h);await js('scrollTo(0,0)');await capture(`${w}-production${session==='unavailable'?'-unavailable':''}-100`);}
    await finish(session+'-record.json');return;
  }
  const freshName = session === 'reproduce' ? 'f1-baseline-' : '';
  fixtureLoaded=true;
  record.observations.resize=[];
  for(const mode of interactionOnly?[]:['normal','expanded']) for(const percent of [100,125,200]) for(const direction of ['desktop-to-compact','compact-to-desktop']) {
    const start=direction==='desktop-to-compact'?[1100,760]:[760,540],end=direction==='desktop-to-compact'?[760,540]:[1100,760];
    await win.webContents.loadURL(base+'/verification/us-035.html');await ready();win.focus();win.webContents.focus();win.setSize(...start);await js('document.documentElement.style.fontSize='+JSON.stringify(percent+'%'));await settle();
    await js('window.us036FocusEvents=0;document.addEventListener("focusin",()=>window.us036FocusEvents++);');
    if(mode==='expanded') {await js('document.querySelector(".expand-reservation button").click()');await settle();}
    for(let i=0;i<16;i++) { if(await js('document.activeElement.matches(".clear-selection-button")')) break;await key('Tab','Tab',9);if(await js('document.activeElement.matches(".agent-selector-button:nth-child(2)")'))await key(' ','Space',32); }
    assert.equal(await js('document.activeElement.matches(".clear-selection-button:focus-visible")'),true,JSON.stringify({mode,percent,direction,layout:await layout()}));
    await invoke('window.us036FocusNode=document.activeElement;window.us036Scene=fixture.scene();window.us036Canvas=document.querySelector("canvas");window.us036Ownership=fixture.ownership();');
    const name=`${freshName}${mode}-${percent}-resize-${direction}`,before=await capture(name+'-before');win.setSize(...end);await settle();const after=await capture(name+'-after');
    assert.equal(await js('document.activeElement===window.us036FocusNode'),true);assert.equal(after.focusEvents,before.focusEvents);assert.equal(after.selected,before.selected);
    assert.equal(await invoke('return fixture.scene()===window.us036Scene&&document.querySelector("canvas")===window.us036Canvas&&fixture.ownership().store===window.us036Ownership.store&&fixture.ownership().runtime===window.us036Ownership.runtime;'),true);
    if (session !== 'reproduce') {assert.ok(after.focus.bounds.y-(after.toolbar.y+after.toolbar.height)>=6);assert.ok(after.viewport[1]-after.focus.bounds.y-after.focus.bounds.height>=6, JSON.stringify({mode,percent,direction,before,after}));}
    record.observations.resize.push({mode,percent,direction,before,after,sameNode:true,noNewFocus:true,clearance:after.focus.bounds.y-(after.toolbar.y+after.toolbar.height),bottomClearance:after.viewport[1]-after.focus.bounds.y-after.focus.bounds.height});
  }
  if(session==='fixture') {
    record.observations.reflow=[];record.observations.keyboard=[];record.observations.flow=[];record.observations.inspection=[];
    const multiline='Literal first line\n'+'unbroken'.repeat(60),unbroken='unbroken'.repeat(60);
    for(const [w,h] of interactionOnly?[]:[[1100,760],[760,540]]) for(const mode of ['normal','expanded']) for(const percent of [100,125,200]) {
      await loadFixture();await resize(w,h);await js('document.documentElement.style.fontSize='+JSON.stringify(percent+'%'));await settle();
      if(mode==='expanded') await expand();
      await focusClear();await js('window.us036FocusNode=document.activeElement;window.us036FocusEvents=0;document.addEventListener("focusin",()=>window.us036FocusEvents++);');
      const before=await focusGeometry(),variants=[];
      for(const [activity,reason] of [[multiline,'approval_required'],[unbroken,'capacity_exhausted'],['Ready',undefined]]) {
        await update('waiting',activity,reason);let after;try{after=await focusGeometry();}catch(error){await capture(`diagnostic-trusted-reflow-${w}-${mode}-${percent}`);record.captureToolSource=readFileSync(__filename,'utf8');record.productionSource=readFileSync(resolve(repo,'apps/desktop/src/office/OfficeSceneHost.tsx'),'utf8');await finish('reflow-failure-record.json');throw error;}assert.equal(await js('document.activeElement===window.us036FocusNode'),true);assert.equal(after.focusEvents,0);assert.equal(after.selected,before.selected);assert.ok(after.details.includes(activity));variants.push({activity,reason,after});
      }
      for(const phase of ['disconnected','synchronizing','ready']) {await invoke(`fixture.connection(${JSON.stringify(phase)})`);await settle();const after=await focusGeometry();assert.equal(await js('document.activeElement===window.us036FocusNode'),true);assert.equal(after.focusEvents,0);variants.push({phase,after});}
      record.observations.reflow.push({w,mode,percent,before,variants,sameFocusedNode:true});
      await update('waiting',multiline,'approval_required');
      // Capture layout outside the persistent-focus proof; blur only for these region captures.
      await js('document.activeElement.blur()');await scroll('.office-scene-host');await capture(`${w}-${mode}-${percent}-room`);
      await scroll('.agent-inspection');await capture(`${w}-${mode}-${percent}-inspection`);
      const inspectionSlices=[`${w}-${mode}-${percent}-inspection`];
      for(let i=2;i<=30;i++) {
        const value=await layout(),bounds=value.borders.inspector.bounds;if(bounds.y+bounds.height<=value.viewport[1]-6)break;
        const maximum=value.document[1]-value.viewport[1],target=Math.min(maximum,value.scroll[1]+Math.max(1,value.viewport[1]-value.toolbar.height-40),value.scroll[1]+bounds.y+bounds.height-value.viewport[1]+12);
        assert.ok(target>value.scroll[1]);await js(`scrollTo({top:${target},behavior:'instant'})`);await settle();const name=`${w}-${mode}-${percent}-inspection-${String(i).padStart(2,'0')}`;await capture(name);inspectionSlices.push(name);
      }
      const endInspection=await layout();assert.ok(endInspection.borders.inspector.bounds.y+endInspection.borders.inspector.bounds.height<=endInspection.viewport[1]-6);record.observations.inspection.push({w,mode,percent,slices:inspectionSlices,reachesBottom:true});
      if(w===760) {
        await js('scrollTo(0,0)');await settle();let previous=-1,index=1,slices=[];
        for(let bound=0;bound<60;bound++) {
          const value=await layout();assert.ok(value.scroll[1]>previous);previous=value.scroll[1];const name=`760-${mode}-${percent}-flow-${String(index++).padStart(2,'0')}`;await capture(name);slices.push({name,scroll:previous,viewport:value.viewport,toolbar:value.toolbar});
          const maximum=value.document[1]-value.viewport[1];if(previous>=maximum)break;
          const stride=Math.max(1,value.viewport[1]-value.toolbar.height-40);await js(`scrollTo({top:${Math.min(maximum,previous+stride)},behavior:'instant'})`);await settle();
        }
        const end=await layout();assert.equal(end.scroll[1],end.document[1]-end.viewport[1]);record.observations.flow.push({mode,percent,slices,documentHeight:end.document[1],viewportHeight:end.viewport[1],reachesBottom:true});
      }
      // Fresh document, ordinary Tab traversal: no programmatic focus or scroll positioning.
      await loadFixture();await resize(w,h);await js('document.documentElement.style.fontSize='+JSON.stringify(percent+'%'));await settle();if(mode==='expanded')await expand();
      const expected=mode==='expanded'?['Exit','Ari','Mina','Sol','Clear']:['Office','Agents','Projects','Studio','Expand','Ari','Mina','Sol','Clear','Retro 70s','Arcade 80s','Cyber 2000','Harbor'];
      const controlKey=()=>js(`(()=>{const e=document.activeElement;if(e.matches('.homepage-navigation button'))return e.textContent;if(e.matches('.studio-gallery-control'))return 'Studio';if(e.matches('.expand-reservation button'))return e.textContent;if(e.matches('.agent-selector-button'))return e.querySelector('.agent-selector-name').textContent;if(e.matches('.clear-selection-button'))return 'Clear';if(e.matches('.world-entry summary'))return e.closest('details').querySelector('.world-name').textContent;if(e.matches('.sample-project-context summary'))return 'Harbor';return e.tagName})()`);
      const forward=[],reverse=[];
      for(let i=0;i<expected.length;i++){if(mode==='normal'||i!==0)await key('Tab','Tab',9);assert.equal(await controlKey(),expected[i]);forward.push(await focusGeometry());if(expected[i]===(mode==='expanded'?'Clear':'Retro 70s'))await capture(`${w}-${mode}-${percent}-keyboard-forward`);}
      await key('Tab','Tab',9);assert.equal(await controlKey(),expected[0]);
      for(let i=expected.length-1;i>=0;i--){await key('Tab','Tab',9,8);assert.equal(await controlKey(),expected[i]);reverse.push(await focusGeometry());if(expected[i]===(mode==='expanded'?'Clear':'Retro 70s'))await capture(`${w}-${mode}-${percent}-keyboard-reverse`);}
      assert.equal((await layout()).selected,'Select an inhabitant');
      const {nodes}=await win.webContents.debugger.sendCommand('Accessibility.getFullAXTree');const byId=new Map(nodes.map(n=>[n.nodeId,n])),ordered=[];
      function walk(node){if(!node)return;if(!node.ignored)ordered.push({role:node.role?.value,name:node.name?.value??''});for(const id of node.childIds??[])walk(byId.get(id));}walk(nodes.find(n=>!n.parentId));
      const headings=ordered.filter(n=>n.role==='heading').map(n=>n.name);assert.deepEqual(headings,mode==='expanded'?['Office — Studio','Agents','Select an inhabitant']:['Coffee Break','Office — Studio','Agents','Select an inhabitant','Worlds','Recent Activity','Projects — Harbor']);
      record.observations.keyboard.push({w,mode,percent,expected,forward,reverse,headings,selectionUnchanged:true});
    }
    record.observations.semantic=[];record.observations.continuity=[];record.observations.motion=[];
    for(const [w,h] of [[1100,760],[760,540]]) {
      await loadFixture();await resize(w,h);await click('.agent-selector-button:nth-child(2)');
      for(const state of ['idle','working','waiting','completed','error']) {await update(state,`Exact ${state} activity`,'approval_required');await js('scrollTo(0,0)');await capture(`${w}-state-${state}`);assert.equal((await layout()).lifecycle,state[0].toUpperCase()+state.slice(1));}
      for(const [kind,state,activity] of [['coffee','waiting','Taking a coffee break in the simulated office'],['generic-waiting','waiting','Generic Waiting'],['idle','idle','Ready']]) {
        await click('.agent-selector-button:nth-child(3)');await invoke(`fixture.update('mock-agent-sol',${JSON.stringify(state)},${JSON.stringify(activity)})`);await settle();await js('scrollTo(0,0)');await capture(`${w}-sol-${kind}`);assert.equal(await invoke('return fixture.presentation()["mock-agent-sol"].visual'),kind==='coffee'?'coffee':state);
      }
      for(const mode of ['normal','expanded']) for(const freshness of ['current','last-known','no-state']) {
        await loadFixture();await resize(w,h);await click('.agent-selector-button:nth-child(2)');
        if(freshness==='last-known')await invoke("fixture.connection('disconnected')");
        if(freshness==='no-state'){await invoke('await fixture.reset("unavailable")');await ready();}
        if(mode==='expanded')await expand();await js('scrollTo(0,0)');await capture(`${w}-${mode}-freshness-${freshness}`);
        const p=await invoke('return fixture.presentation()["mock-agent-mina"]');assert.equal(p.state===null?'no-state':p.live?'current':'last-known',freshness);
      }
      await loadFixture();await resize(w,h);await click('.agent-selector-button:nth-child(2)');
      const url=await js('location.href');for(const [n,id] of [[1,'office'],[2,'agents'],[3,'projects']]){await click(`.homepage-navigation button:nth-child(${n})`);assert.equal(await js('document.activeElement.id'),id+'-section-title');assert.equal(await js('location.href'),url);assert.equal((await layout()).selected,'Mina');}
      await click('.studio-gallery-control');assert.equal(await js('document.activeElement.id'),'worlds-section-title');
      for(const [i,name] of ['retro','arcade','cyber'].entries()){await js('document.querySelectorAll(".world-entry summary")['+i+'].click()');await settle();await scroll('.worlds-section');await capture(`${w}-preview-${name}`);}
      await capture(`${w}-preview-all-open`);assert.equal(await js('document.querySelectorAll(".world-entry[open]").length'),3);
      await js('document.querySelector(".sample-project-context").open=true');await scroll('.sample-activity');await capture(`${w}-harbor-open`);assert.equal(await js('document.querySelectorAll(".sample-activity-list li").length'),3);
      await invoke('window.us036Scene=fixture.scene();window.us036Game=fixture.scene().sys.game;window.us036Canvas=document.querySelector("canvas");window.us036Ownership=fixture.ownership();');
      const identity=()=>invoke('return fixture.scene()===window.us036Scene&&fixture.scene().sys.game===window.us036Game&&document.querySelector("canvas")===window.us036Canvas&&fixture.ownership().store===window.us036Ownership.store&&fixture.ownership().runtime===window.us036Ownership.runtime;');
      const subscriptions=await invoke('return fixture.subscriptions()');
      for(const action of ['exit','escape']) {await js('scrollTo(0,document.documentElement.scrollHeight)');await settle();const saved=(await layout()).scroll[1];await expand();await update('working','Working while expanded');await invoke("fixture.connection('disconnected');fixture.connection('synchronizing');fixture.connection('ready');");await settle();assert.equal(await identity(),true);if(action==='exit')await expand();else await key('Escape','Escape',27);await settle();const value=await layout();assert.equal(value.scroll[1],Math.min(saved,value.document[1]-value.viewport[1]));assert.equal(value.focused,'Expand office within the application');await capture(`${w}-return-${action}`);}
      await invoke('window.us036Acknowledgements=0;window.us036AcknowledgementMethod=fixture.scene().acknowledge;fixture.scene().acknowledge=function(v){window.us036Acknowledgements++;return window.us036AcknowledgementMethod.call(this,v)};');
      await update('working','Positive acknowledgement setup');await update('completed','Positive acknowledgement');assert.equal(await js('window.us036Acknowledgements'),1);await update('working','Cycle start');
      await invoke('window.us036PlayCalls=0;for(const sprite of fixture.scene().children.list.filter(x=>x.type==="Sprite")){const play=sprite.play;sprite.play=function(...args){window.us036PlayCalls++;return play.apply(this,args)}}');
      const reactions=await js('window.us036Acknowledgements');
      for(let i=0;i<10;i++){const plays=await js('window.us036PlayCalls');await expand();assert.equal(await js('window.us036PlayCalls'),plays);await update('working','Cycle '+i);const updated=await js('window.us036PlayCalls');await expand();assert.equal(await js('window.us036PlayCalls'),updated);assert.equal(await js('window.us036Listeners.resize.size'),1);assert.equal(await js('window.us036Listeners.escape.size'),0);assert.equal(await identity(),true);assert.deepEqual(await invoke('return fixture.subscriptions()'),subscriptions);}
      assert.equal(await js('window.us036Acknowledgements'),reactions);assert.equal(await js('document.querySelectorAll(".world-entry[open]").length'),3);assert.equal(await js('document.querySelector(".sample-project-context").open'),true);
      record.observations.continuity.push({w,cycles:10,sameObjects:true,subscriptions,noAcknowledgementReplay:true,noAnimationReplay:true,positiveAcknowledgement:1,resizeListeners:1,escapeListeners:0,disclosuresPreserved:true});
      // Real pointer events on all three world hit targets, then native selector activation/Clear.
      await js('document.activeElement.blur()');await scroll('.office-scene-host');
      await waitFor(()=>invoke('const b=fixture.scene().sys.game.scale.canvasBounds,r=document.querySelector("canvas").getBoundingClientRect();return b.x===r.x+scrollX&&b.y===r.y+scrollY;'));
      for(const [id,x,y] of [['mock-agent-ari',292,174],['mock-agent-mina',360,240],['mock-agent-sol',220,282]]) {
        const c=(await layout()).canvas;const point={x:c.x+x,y:c.y+y-20};await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...point,button:'none'});await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await settle();assert.equal((await layout()).selected,id.split('-').at(-1).replace(/^./,s=>s.toUpperCase()));
      }
      await click('.expand-reservation button');await focusClear();await key('Enter','Enter',13);assert.equal((await layout()).selected,'Select an inhabitant');assert.equal((await layout()).focused,'Clear selection');await expand();
      // Pointer-focus resize must not invoke the keyboard-only scroll correction.
      await scroll('.agent-selector-button');const bounds=await js('(()=>{const r=document.querySelector(".agent-selector-button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
      await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...bounds,button:'left',clickCount:1});await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...bounds,button:'left',clickCount:1});await settle();assert.equal((await layout()).focus.visible,false);
      await js('window.us036ScrollBy=window.scrollBy;window.us036CorrectionCalls=0;window.scrollBy=function(...args){window.us036CorrectionCalls++;return window.us036ScrollBy.apply(this,args)};void 0');const pointerBefore=(await layout()).scroll[1];await resize(w===1100?760:1100,w===1100?540:760);const pointerAfter=await layout();assert.equal(pointerAfter.focus.visible,false);assert.equal(await js('window.us036CorrectionCalls'),0);await js('window.scrollBy=window.us036ScrollBy;void 0');record.observations.semantic.push({w,navigation:true,pointerSelection:true,nativeClear:true,pointerNegative:{before:pointerBefore,after:pointerAfter.scroll[1],focusVisible:false}});
      await resize(w,h);
      // Media emulation, actual Graphics/frames over time and non-replayed entry reactions.
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      for(const kind of ['working','coffee','completed','error']) {
        await click(kind==='coffee'?'.agent-selector-button:nth-child(3)':'.agent-selector-button:nth-child(2)');
        if(kind==='coffee')await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");else await update(kind,'Reduced '+kind);
        await js('document.activeElement.blur()');await scroll('.office-scene-host');await capture(`${w}-reduced-${kind}`);
        const state=await invoke('return {frames:fixture.scene().children.list.filter(x=>x.type==="Sprite").map(x=>[x.texture.key,x.frame.name,x.anims.isPlaying]),graphics:fixture.scene().children.list.filter(x=>x.type==="Graphics").map(x=>x.commandBuffer),reactions:window.us036Acknowledgements};');await wait(1700);const after=await invoke('return {frames:fixture.scene().children.list.filter(x=>x.type==="Sprite").map(x=>[x.texture.key,x.frame.name,x.anims.isPlaying]),graphics:fixture.scene().children.list.filter(x=>x.type==="Graphics").map(x=>x.commandBuffer),reactions:window.us036Acknowledgements};');assert.deepEqual(after,state);record.observations.motion.push({w,kind,emulated:true,durationMs:1700,staticObjects:true,reactionsSuppressed:true});
      }
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});
      await invoke('fixture.remount()');await ready();assert.equal((await layout()).canvases,1);
      await invoke('window.us036OldScene=fixture.scene();fixture.scene().scene.stop();');await settle();assert.equal(await invoke('return window.us036OldScene.motions.size+window.us036OldScene.workstations.size+window.us036OldScene.agentSprites.size+window.us036OldScene.plaques.size'),0);
      await win.webContents.reload();await ready();await resize(w,h);await capture(`${w}-reload`);
      await js('window.us036FinalScroll=scrollY;window.us036DisposeCorrections=0;const scrollBy=window.scrollBy;window.scrollBy=function(...args){window.us036DisposeCorrections++;return scrollBy.apply(this,args)};window.dispatchEvent(new Event("resize"));window.dispatchEvent(new Event("pagehide"));void 0');await wait(80);assert.equal(await js('window.us036DisposeCorrections'),0);assert.equal(await js('window.us036Listeners.resize.size+window.us036Listeners.escape.size'),0);assert.equal(await js('document.querySelectorAll("canvas").length'),0);assert.deepEqual(await invoke('return fixture.subscriptions()'),{store:0,runtime:0,acknowledgements:0,watch:0});
    }
    record.observations.persistentControls=[];
    for(const mode of ['normal','expanded'])for(const percent of [100,125,200]){
      await loadFixture();await resize(1100,760);await js('document.documentElement.style.fontSize='+JSON.stringify(percent+'%'));await settle();if(mode==='expanded')await expand();
      await js('window.us036FocusEvents=0;document.addEventListener("focusin",()=>window.us036FocusEvents++);');
      const count=mode==='expanded'?4:13;
      for(let i=0;i<count;i++){
        await key('Tab','Tab',9);const eligible=await js('document.querySelector(".office-composition").contains(document.activeElement)&&!document.querySelector(".studio-toolbar").contains(document.activeElement)');if(!eligible)continue;
        await js('window.us036FocusNode=document.activeElement;void 0');const before=await focusGeometry();await resize(760,540);const compact=await focusGeometry();await resize(1100,760);const desktop=await focusGeometry();assert.equal(await js('document.activeElement===window.us036FocusNode'),true);assert.equal(compact.focusEvents,before.focusEvents);assert.equal(desktop.focusEvents,before.focusEvents);record.observations.persistentControls.push({mode,percent,before,compact,desktop,sameNode:true});
      }
    }
    await loadFixture();await resize(1100,760);await focusClear();
    for(const width of [1040,1039,900,1039,1040]){await resize(width,760);await focusGeometry();assert.equal(await js('document.activeElement.matches(".clear-selection-button")'),true);}
    record.observations.breakpoints=[1040,1039,900,1039,1040];
    await finish(interactionOnly?'interaction-diagnostic-record.json':'fixture-record.json');return;
  }
  await finish('f1-baseline-record.json');

}
if(resolve(process.argv[1]??'')===__filename) run().then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1);});
