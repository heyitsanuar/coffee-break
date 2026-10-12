// Original Electron captures; accepted fixture inputs/Chromium keys are synthetic, not manual native evidence.
const { app, BrowserWindow, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const { verifyImage } = require('./us-035-image.cjs');
const repo = resolve(__dirname, '../../..'), output = resolve(repo, 'docs/verification/assets/us-035');
const base = process.argv[2] ?? 'http://localhost:5173';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const hash = b => createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(done => setTimeout(done, ms));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const record = { baseline: git('rev-parse','HEAD'), branch: git('branch','--show-current'), capturedAt: new Date().toISOString(), captures: [], observations: {} };
async function run() {
  process.env.ELECTRON_RENDERER_URL = base; process.env.COFFEE_BREAK_LOCAL_SIMULATION = '1';
  await import(pathToFileURL(resolve(__dirname,'../out/main/main.js')).href); await app.whenReady();
  const win = BrowserWindow.getAllWindows()[0]; assert.ok(win); win.setTitle('US-035 Automated Evidence'); win.show(); win.focus(); win.webContents.setBackgroundThrottling(false);
  mkdirSync(output,{recursive:true});
  const errors=[]; win.webContents.on('console-message', event => { if(event.level==='error')errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  const invoke = code => js("import([...document.scripts].find(s=>s.src&&new URL(s.src).pathname==='/verification/us-035.tsx').src).then(async({fixture})=>{"+code+'})');
  const ready = async fixture => { for(let i=0;i<80;i++){if(await js("document.querySelectorAll('canvas').length===1&&!!document.querySelector('.worlds-section')")&&(!fixture||await invoke('return !!fixture.scene()?.children.list.length;')))return;await wait(100);}throw Error('Initialization timeout');};
  const resize = async(w,h)=>{win.setSize(w,h);await wait(100);assert.deepEqual(win.getSize(),[w,h]);};
  const layout = () => js('('+(()=>{
    const q=s=>document.querySelector(s),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},visible=e=>!!e&&!!e.getClientRects().length;
    // Only unoccluded panel edges can establish decoded image/layout correspondence.
    const borders={}; for(const [name,selector,rgb]of [['toolbar','.studio-toolbar',[36,59,82]],['office','.office-scene-host',[99,125,153]],['worlds','.worlds-section',[36,59,82]],['inspector','.agent-inspection',[36,59,82]]]){const e=q(selector);borders[name]={bounds:box(e),rgb,visible:visible(e)&&(name==='toolbar'||box(e).y>=box(q('.studio-toolbar')).y+box(q('.studio-toolbar')).height)&&(name!=='inspector'||e.dataset.selected==='true')};}
    const active=document.activeElement, toolbar=q('.studio-toolbar');
    return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,rootFont:getComputedStyle(document.documentElement).fontSize,scroll:[scrollX,scrollY],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],overflow:document.documentElement.scrollWidth>innerWidth,canvases:document.querySelectorAll('canvas').length,canvas:box(q('canvas')),toolbar:box(toolbar),composition:box(q('.office-composition')),worlds:box(q('.worlds-section')),agents:box(q('.agents-section')),inspector:box(q('.agent-inspection')),borders,
      expanded:q('main').dataset.expanded==='true',selected:q('.agent-inspection h2').textContent,details:q('.agent-inspection-details').textContent,lifecycle:q('.agent-inspection-lifecycle')?.textContent??null,freshness:q('.agent-inspection-freshness')?.textContent??null,status:q('.connection-status').textContent,statusRegions:document.querySelectorAll('[role="status"]').length,
      masks: getComputedStyle(active).outlineStyle!=="none" ? [{x:box(active).x-6,y:box(active).y-6,width:box(active).width+12,height:box(active).height+12}] : [],
      focused:active.id||active.getAttribute('aria-label')||active.textContent.trim(),focus:{bounds:box(active),outline:getComputedStyle(active).outline,offset:getComputedStyle(active).outlineOffset},hidden:{navigation:!visible(q('nav')),worlds:!visible(q('.worlds-section')),sample:!visible(q('.sample-activity'))},gallery:[...document.querySelectorAll('.world-entry')].map(e=>({name:e.querySelector('.world-name').textContent,open:e.open??null,bounds:box(e)}))};
  }).toString()+')()');
  const settle=()=>js('new Promise((resolve,reject)=>{let last="",stable=0,frames=0;const timer=setTimeout(()=>reject(Error("Layout settlement timeout")),2500);function sample(){const next=JSON.stringify({scroll:[scrollX,scrollY],font:getComputedStyle(document.documentElement).fontSize,boxes:[...document.querySelectorAll(".studio-toolbar,.worlds-section,.agent-inspection,.agents-section,canvas,details")].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})});stable=next===last?stable+1:0;last=next;frames++;if(stable>=3){clearTimeout(timer);resolve({frames,consecutiveStableFrames:stable+1})}else requestAnimationFrame(sample)}requestAnimationFrame(sample)})');
  const capture=async(name,provenance='Production components/store/runtime/scene; synthetic accepted US-035 inputs and Chromium automation')=>{
    let failure;for(let attempt=1;attempt<=6;attempt++){
      const settlement={attempt,...await settle()},before=await layout();assert.equal(before.overflow,false);assert.equal(before.canvases,1);assert.equal(before.canvas.width,640);assert.equal(before.canvas.height,360);assert.equal(before.statusRegions,1);
      const png=(await win.webContents.capturePage()).toPNG(),after=await layout();
      try{assert.deepEqual(after,before);const correspondence=verifyImage(png,before);writeFileSync(resolve(output,name+'.png'),png);record.captures.push({name,provenance,outer:win.getSize(),contentBounds:win.getContentBounds(),...before,imageSize:nativeImage.createFromBuffer(png).getSize(),pngSha256:hash(png),settlement,correspondence});return before;}catch(e){failure=e;}
    }console.error('Capture failed',name,await layout());throw failure;
  };
  await ready(false);await wait(4500);
  for(const [w,h]of [[1100,760],[760,540]]){await resize(w,h);await js('scrollTo(0,0)');await capture(w+'-production','Production root with authenticated local simulation; no fixture inputs');}
  await win.webContents.loadURL(base+'/verification/us-035.html');await ready(true);win.webContents.debugger.attach('1.3');
  const key=async(key,code,virtual,modifiers=0)=>{const p={key,code,windowsVirtualKeyCode:virtual,nativeVirtualKeyCode:virtual,modifiers};await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',...p,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...p});await wait(60);};
  const click=selector=>js('document.querySelector('+JSON.stringify(selector)+').click()');
  const expand=()=>click('.expand-reservation button');
  const scroll=selector=>js('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');
  const identity=()=>invoke('const s=fixture.scene();return s===window.us035Scene&&s.sys.game===window.us035Game&&document.querySelector("canvas")===window.us035Canvas&&document.querySelector(".office-scene-host")===window.us035Host&&fixture.ownership().store===window.us035Store&&fixture.ownership().runtime===window.us035Runtime&&document.querySelector(".connection-status")===window.us035Status&&document.querySelector(".agent-selector")===window.us035Selector&&document.querySelector(".agent-inspection")===window.us035Inspector;');
  await invoke('window.us035Scene=fixture.scene();window.us035Game=fixture.scene().sys.game;window.us035Canvas=document.querySelector("canvas");window.us035Host=document.querySelector(".office-scene-host");window.us035Store=fixture.ownership().store;window.us035Runtime=fixture.ownership().runtime;window.us035Status=document.querySelector(".connection-status");window.us035Selector=document.querySelector(".agent-selector");window.us035Inspector=document.querySelector(".agent-inspection");');
  await js('window.us035Escape=new Set();const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);window.addEventListener=(type,fn,...args)=>{if(type==="keydown"&&fn.name==="escape")window.us035Escape.add(fn);return add(type,fn,...args)};window.removeEventListener=(type,fn,...args)=>{if(type==="keydown"&&fn.name==="escape")window.us035Escape.delete(fn);return remove(type,fn,...args)};void 0;');
  // Observe installed sprite methods and scene delivery without changing their behavior.
  await invoke('window.us035Motion={plays:0,acknowledgements:0};const scene=fixture.scene(),ack=scene.acknowledge.bind(scene);scene.acknowledge=value=>{window.us035Motion.acknowledgements++;ack(value)};for(const sprite of scene.children.list.filter(s=>s.name?.startsWith("mock-agent-"))){const play=sprite.play.bind(sprite);sprite.play=(...args)=>{window.us035Motion.plays++;return play(...args)}}');
  const motion=()=>js('({...window.us035Motion})');
  const subscriptions=await invoke('return fixture.subscriptions();');
  record.observations.continuity=[];
  for(const [w,h]of [[1100,760],[760,540]]){
    await resize(w,h);await click('.agent-selector-button:nth-child(2)');await scroll('.worlds-section');
    await capture(w+'-gallery');const before=await invoke('return fixture.snapshot();');
    for(let i=0;i<3;i++){await js('document.querySelectorAll(".world-entry summary")['+i+'].focus()');await key(' ','Space',32);await capture(w+'-preview-'+i);}
    assert.equal(await js('[...document.querySelectorAll(".world-entry details")].length'),0);
    assert.equal(await js('[...document.querySelectorAll(".world-entry")].filter(e=>e.open).length'),3);
    assert.deepEqual(await invoke('return fixture.snapshot();'),before);assert.equal((await layout()).selected,'Mina');assert.ok(await identity());
    await key('Enter','Enter',13);assert.equal(await js('document.querySelectorAll(".world-entry")[3].open'),false);await key('Enter','Enter',13);
    await click('.sample-project-context summary');const url=await js('location.href'),saved=await js('scrollY');
    await expand();await wait(80);const expanded=await layout();assert.equal(expanded.scroll[1],0);assert.deepEqual(expanded.hidden,{navigation:true,worlds:true,sample:true});assert.equal(expanded.focused,'Exit expanded office');assert.ok(await identity());assert.deepEqual(await invoke('return fixture.subscriptions();'),subscriptions);assert.equal(await js('window.us035Escape.size'),1);
    assert.equal(await js('document.querySelector(".studio-gallery-control").disabled'),true);
    assert.equal(await js('document.querySelector(".studio-gallery-control").getAttribute("aria-label")'),'Studio, current authored world');
    await capture(w+'-expanded');await invoke("fixture.update('mock-agent-mina','working','Work while expanded');fixture.connection('disconnected')");await capture(w+'-retained');assert.equal((await layout()).freshness,'Last known · Not live');
    await invoke("fixture.connection('synchronizing')");await capture(w+'-synchronizing');await invoke("fixture.connection('ready');fixture.update('mock-agent-mina','waiting','Waiting for approval','approval_required')");
    await key('Escape','Escape',27);await wait(80);assert.equal((await layout()).focused,'Expand office within the application');const max=await js('Math.max(0,document.documentElement.scrollHeight-document.documentElement.clientHeight)');assert.equal((await layout()).scroll[1],Math.min(saved,max));assert.equal(await js('location.href'),url);assert.equal(await js('window.us035Escape.size'),0);assert.equal(await js('document.querySelector(".sample-project-context").open'),true);assert.equal(await js('[...document.querySelectorAll(".world-entry")].filter(e=>e.open).length'),3);await capture(w+'-escape-return');
    await key('Escape','Escape',27);assert.equal((await layout()).expanded,false);
    await expand();await wait(40);await expand();await wait(60);assert.equal((await layout()).focused,'Expand office within the application');await capture(w+'-exit-return');
    for(let i=0;i<10;i++){const opening=await motion();await expand();await wait(30);assert.deepEqual(await motion(),opening);await invoke("fixture.update('mock-agent-ari','working','Cycle update')");const closing=await motion();await expand();await wait(30);assert.deepEqual(await motion(),closing);assert.ok(await identity());assert.deepEqual(await invoke('return fixture.subscriptions();'),subscriptions);assert.equal(await js('window.us035Escape.size'),0);}
    record.observations.continuity.push({outer:[w,h],cycles:10,identical:true,subscriptions,escapeListenersAfter:0,savedScroll:saved,restoredScroll:Math.min(saved,max),previewStatePreserved:true,harborPreserved:true,noAnimationOrAcknowledgementReplay:true});
    await js('document.querySelectorAll(".world-entry").forEach(e=>{if(e.tagName==="DETAILS")e.open=false});document.querySelector(".sample-project-context").open=false');
    const destination=await js('document.querySelector(".homepage-navigation [aria-current]").textContent');
    await click('.studio-gallery-control');assert.equal((await layout()).focused,'worlds-section-title');assert.equal(await js('location.href'),url);
    assert.equal(await js('document.querySelector(".homepage-navigation [aria-current]").textContent'),destination);
  }
  await invoke("fixture.update('mock-agent-ari','working','Before acknowledgement');fixture.update('mock-agent-ari','completed','Completed once')");
  const reaction=await motion();assert.equal(reaction.acknowledgements,1);await expand();await wait(40);await expand();assert.deepEqual(await motion(),reaction);record.observations.acknowledgement={accepted:1,modeReplay:0};
  // Resize/clamping: save near the bottom of a tall normal layout, then shorten it during expansion.
  await resize(760,540);await invoke("fixture.update('mock-agent-mina','waiting','Long '+('unbroken'.repeat(80)),'capacity_exhausted')");await js('scrollTo(0,document.documentElement.scrollHeight)');const oldScroll=await js('scrollY');await expand();await resize(1100,760);await invoke("fixture.update('mock-agent-mina','idle','Ready')");await expand();await wait(80);const clampMax=await js('Math.max(0,document.documentElement.scrollHeight-document.documentElement.clientHeight)');assert.equal(await js('scrollY'),Math.min(oldScroll,clampMax));record.observations.clamping={saved:oldScroll,maximum:clampMax,restored:await js('scrollY')};
  record.observations.text=[];
  for(const [w,h]of [[1100,760],[760,540]])for(const percent of [100,125,200]){
    await resize(w,h);await js('document.documentElement.style.fontSize='+JSON.stringify(percent+'%'));
    await invoke("fixture.update('mock-agent-mina','waiting','Exact first line\\n'+('unbroken'.repeat(50)),'capacity_exhausted')");
    await scroll('.worlds-section');await capture(w+'-text-'+percent+'-gallery');
    await expand();await settle();await scroll('.office-scene-host');await settle();const room=await layout();assert.ok(room.canvas.y>=room.toolbar.y+room.toolbar.height,'Room behind toolbar: '+JSON.stringify({w,percent,canvas:room.canvas,toolbar:room.toolbar}));assert.ok(room.canvas.y+room.canvas.height<=room.viewport[1],'Complete room is not reachable');
    await scroll('.agent-inspection');await capture(w+'-text-'+percent+'-expanded');
    await scroll('.agent-selector-button');await js('document.querySelector(".agent-selector-button").focus()');await key('Tab','Tab',9);const focus=await layout();assert.equal(focus.selected,'Mina');assert.ok(focus.focus.outline.includes('3px'));assert.ok(focus.focus.bounds.y>=focus.toolbar.y+focus.toolbar.height-0.01,'Sticky toolbar overlaps focused agent');await capture(w+'-text-'+percent+'-focus');
    record.observations.text.push({outer:[w,h],percent,overflow:focus.overflow,toolbarHeight:focus.toolbar.height,focusClearance:focus.focus.bounds.y-focus.toolbar.y-focus.toolbar.height});await expand();
  }
  await js('document.documentElement.style.fontSize=""');await resize(1100,760);
  await js('document.getElementById("agents-section-title").focus()');
  await key('Tab','Tab',9);assert.ok((await layout()).focused.startsWith('Select Ari'));const focusedSelection=(await layout()).selected;await key('Tab','Tab',9);assert.equal((await layout()).selected,focusedSelection);await key('Tab','Tab',9,8);assert.ok((await layout()).focused.startsWith('Select Ari'));await key('Tab','Tab',9);await key('Enter','Enter',13);assert.equal((await layout()).selected,'Mina');await key('Tab','Tab',9);await key(' ','Space',32);assert.equal((await layout()).selected,'Sol');await key('Tab','Tab',9);assert.equal((await layout()).focused,'Clear selection');await key('Enter','Enter',13);assert.equal((await layout()).selected,'Select an inhabitant');assert.equal((await layout()).focused,'Clear selection');record.observations.keyboardSelectionAndClear=true;
  await expand();await capture('expanded-unselected');await expand();await click('.agent-selector-button:nth-child(2)');
  await invoke("fixture.withoutTrustedPresentation('mock-agent-mina')");await wait(100);await expand();await capture('expanded-selected-no-state');await expand();
  // Separate reset episode, outside continuity proof.
  await invoke('await fixture.reset("live")');await ready(true);await click('.agent-selector-button:nth-child(3)');await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");await expand();await capture('expanded-coffee');
  await invoke("fixture.update('mock-agent-sol','waiting','Generic waiting')");await capture('expanded-generic-waiting');assert.equal(await invoke('return fixture.presentation()["mock-agent-sol"].visual;'),'waiting');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");await capture('expanded-reduced-motion');assert.equal(await invoke('return fixture.presentation()["mock-agent-sol"].reducedMotion;'),true);
  await expand();await click('.homepage-navigation button:nth-child(3)');assert.equal((await layout()).focused,'projects-section-title');
  await expand();assert.equal(await js('window.us035Escape.size'),1);
  await js('window.dispatchEvent(new Event("pagehide"))');await wait(60);
  assert.equal(await js('document.querySelectorAll("canvas").length'),0);assert.equal(await js('window.us035Escape.size'),0);
  assert.deepEqual(await invoke('return fixture.subscriptions();'),{store:0,runtime:0,acknowledgements:0,watch:0});
  record.observations.expandedDisposal={canvases:0,escapeListeners:0,subscriptions:{store:0,runtime:0,acknowledgements:0,watch:0}};
  await win.webContents.reload();await ready(true);assert.equal((await layout()).canvases,1);assert.equal((await layout()).expanded,false);record.observations.reload=true;
  // F1/F2/F4: fresh documents, natural keyboard traversal only; no focus()/scroll prepositioning.
  const controlKey = () => js(`(() => {
    const e=document.activeElement;
    if(e.matches('.homepage-navigation button'))return e.textContent;
    if(e.matches('.studio-gallery-control'))return 'Studio';
    if(e.matches('.expand-reservation button'))return e.textContent;
    if(e.matches('.agent-selector-button'))return e.querySelector('.agent-selector-name').textContent;
    if(e.matches('.clear-selection-button'))return 'Clear';
    if(e.matches('.world-entry summary'))return e.closest('details').querySelector('.world-name').textContent;
    if(e.matches('.sample-project-context summary'))return 'Harbor';
    return e.tagName;
  })()`);
  const keyboardGeometry = async () => {
    const value=await layout(), outside=await js('document.querySelector(".office-composition").contains(document.activeElement)&&!document.querySelector(".studio-toolbar").contains(document.activeElement)');
    if(outside){assert.ok(value.focus.bounds.y>=value.toolbar.y+value.toolbar.height+6-0.01, 'F2 top clearance: '+JSON.stringify(value.focus));assert.ok(value.focus.bounds.y+value.focus.bounds.height<=value.viewport[1]-6+0.01,'F2 bottom focus outline clipped');}
    return {control:await controlKey(),top:value.focus.bounds.y,bottom:value.focus.bounds.y+value.focus.bounds.height,toolbarBottom:value.toolbar.y+value.toolbar.height,clearance:value.focus.bounds.y-value.toolbar.y-value.toolbar.height,viewport:value.viewport,scroll:value.scroll,outline:value.focus.outline,clearanceRequired:outside};
  };
  const readingOrder = async expanded => {
    const {nodes}=await win.webContents.debugger.sendCommand('Accessibility.getFullAXTree');
    const byId=new Map(nodes.map(n=>[n.nodeId,n])), ordered=[];
    function walk(node){if(!node)return;if(!node.ignored)ordered.push({role:node.role?.value,name:node.name?.value??''});for(const id of node.childIds??[])walk(byId.get(id));}
    walk(nodes.find(n=>!n.parentId));
    const headings=ordered.filter(n=>n.role==='heading').map(n=>n.name);
    const inspection=(await layout()).selected;
    assert.deepEqual(headings,expanded?['Office — Studio','Agents',inspection]:['Coffee Break','Office — Studio','Agents',inspection,'Worlds','Recent Activity','Projects — Harbor']);
    const studio=ordered.find(n=>n.role==='button'&&n.name.startsWith('Studio,'));
    assert.equal(studio.name,expanded?'Studio, current authored world':'Studio, current authored world. View Worlds');
    const dom=await js('[...document.querySelectorAll(".agents-section,.agent-inspection,.worlds-section,.sample-activity")].filter(e=>e.getClientRects().length).map(e=>e.className)');
    assert.deepEqual(dom,expanded?['agents-section','agent-inspection']:['agents-section','agent-inspection','worlds-section','sample-activity']);
    return {headings,dom,studio:studio.name,controls:ordered.filter(n=>n.role==='button'||n.role==='DisclosureTriangle')};
  };
  record.observations.corrections={keyboard:[],columns:[]};
  for(const [w,h]of [[1100,760],[760,540]])for(const percent of [100,125,200])for(const expanded of [false,true]){
    await win.webContents.reload();await ready(true);await resize(w,h);await js('document.documentElement.style.fontSize='+JSON.stringify(percent+'%'));
    if(expanded){await invoke('await fixture.reset("unavailable")');await ready(true);await expand();}
    await settle();
    const expected=expanded?['Exit','Ari','Mina','Sol','Clear']:['Office','Agents','Projects','Studio','Expand','Ari','Mina','Sol','Clear','Retro 70s','Arcade 80s','Cyber 2000','Harbor'];
    const before=await invoke('return fixture.snapshot();'), selection=(await layout()).selected, forward=[],reverse=[];
    for(let i=0;i<expected.length;i++){
      if(!expanded||i!==0)await key('Tab','Tab',9);
      assert.equal(await controlKey(),expected[i]);forward.push(await keyboardGeometry());
      if(expected[i]===(expanded?'Clear':'Retro 70s'))await capture(`${w}-correction-${expanded?'expanded':'normal'}-${percent}-forward`);
    }
    await key('Tab','Tab',9);assert.equal(await controlKey(),expected[0]);
    for(let i=expected.length-1;i>=0;i--){
      await key('Tab','Tab',9,8);
      assert.equal(await controlKey(),expected[i]);reverse.push(await keyboardGeometry());
      if(expected[i]===(expanded?'Clear':'Retro 70s'))await capture(`${w}-correction-${expanded?'expanded':'normal'}-${percent}-reverse`);
    }
    assert.equal((await layout()).selected,selection);assert.deepEqual(await invoke('return fixture.snapshot();'),before);
    record.observations.corrections.keyboard.push({outer:[w,h],percent,expanded,session:expanded?'initial no-state/no-selection':'live/unselected',expected,forward,reverse,accessibility:await readingOrder(expanded),noViewportPrepositioning:true});
  }
  // An actual pointer click must not run the keyboard-only clearance correction.
  await win.webContents.reload();await ready(true);await resize(1100,760);
  const pointerStart=await js('scrollY');
  const point=await js('(()=>{const r=document.querySelector(".agent-selector-button:nth-child(2)").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  assert.ok(point.y>0&&point.y<win.getContentSize()[1]);
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await settle();
  assert.equal(await js('document.activeElement.matches(":focus-visible")'),false);assert.equal(await js('scrollY'),pointerStart);
  record.observations.corrections.pointer={scrollBefore:pointerStart,scrollAfter:await js('scrollY'),focusVisible:false};
  // F3: independent natural column flows, short/long inspection at each approved text size.
  for(const percent of [100,125,200]){
    await win.webContents.reload();await ready(true);await resize(1100,760);await js('document.documentElement.style.fontSize='+JSON.stringify(percent+'%'));
    await click('.agent-selector-button:nth-child(2)');await js('scrollTo({top:0,behavior:"instant"})');
    const measure=()=>js(`(() => {
      const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,height:r.height}};
      const t=rect('.studio-toolbar'),r=rect('.office-scene-host'),c=rect('.office-context'),w=rect('.worlds-section'),a=rect('.agents-section'),i=rect('.agent-inspection'),s=rect('.sample-activity');
      return {canvasTop:r.top+1,toolbarRoom:r.top-t.bottom,roomContext:c.top-r.bottom,contextWorlds:w.top-c.bottom,contextAgents:a.top-c.bottom,canvasWorlds:w.top-(r.bottom-1),inspectorSample:s.top-i.bottom,inspectorHeight:i.height,sampleTop:s.top,worldsTop:w.top};
    })()`);
    await invoke("fixture.update('mock-agent-mina','idle','Ready')");await settle();const short=await measure();await capture(`1100-correction-flow-${percent}-short`);
    await invoke("fixture.update('mock-agent-mina','waiting','Long activity: '+('unbroken'.repeat(60)),'capacity_exhausted')");await settle();const long=await measure();await capture(`1100-correction-flow-${percent}-long`);
    for(const name of ['canvasTop','toolbarRoom','roomContext','contextWorlds','contextAgents','canvasWorlds','worldsTop'])assert.ok(Math.abs(short[name]-long[name])<=0.01, 'F3 rail influences '+name+': '+JSON.stringify({short,long}));
    for(const v of [short,long]){assert.equal(v.toolbarRoom,8,JSON.stringify(v));assert.equal(v.roomContext,8,JSON.stringify(v));assert.equal(v.contextWorlds,12);assert.equal(v.contextAgents,12);assert.equal(v.inspectorSample,12*percent/100);}
    assert.ok(long.inspectorHeight>short.inspectorHeight);assert.ok(Math.abs((long.sampleTop-short.sampleTop)-(long.inspectorHeight-short.inspectorHeight))<=0.01);
    record.observations.corrections.columns.push({percent,short,long});
  }
  assert.equal(errors.length,0,JSON.stringify(errors));record.observations.rendererErrors=errors;
  const paths=[...git('ls-files','apps/desktop/src','apps/desktop/electron','apps/desktop/shared','packages/contracts','docs/design/references','docs/verification/assets/us-031','docs/verification/assets/us-032','docs/verification/assets/us-033','docs/verification/assets/us-034','package.json','package-lock.json').split('\n'),...git('ls-files','--others','--exclude-standard','apps/desktop/src','apps/desktop/verification').split('\n')].filter(Boolean);
  record.sourceSha256=Object.fromEntries(paths.map(p=>[p,hash(readFileSync(resolve(repo,p)))]));record.toolingSha256=hash(readFileSync(__filename));
  writeFileSync(resolve(output,'capture-record.json'),JSON.stringify(record,null,2)+'\n');console.log('PASS US-035: '+record.captures.length+' original captures, real identity continuity, subscriptions, preview/Harbor state, keys, scroll, clamping, text and reload.');
}
module.exports={verifyImage};
if(resolve(process.argv[1]??'')===__filename)run().then(()=>app.quit()).catch(e=>{console.error(e);app.exit(1)});
