// Unedited Electron renderer evidence. Synthetic cases and Chromium input/media are labeled.
const { app, BrowserWindow, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const base = process.argv[2] ?? 'http://localhost:5173';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const repo = resolve(__dirname, '../../..');
const output = resolve(repo, 'docs/verification/assets/us-033');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(done => setTimeout(done, ms));
const ids = ['mock-agent-ari','mock-agent-mina','mock-agent-sol'];
const names = ['Ari','Mina','Sol'];
const anchors = [[292,174],[360,240],[220,282]];
const plaques = [[234,184,88,36],[316,250,88,36],[176,292,88,36]];
const synthetic = 'Production components; synthetic accepted renderer inputs';
const textOnly = process.argv.includes('--text-only');
const previous = textOnly ? JSON.parse(readFileSync(resolve(output,'capture-record.json'))) : null;
const record = previous ?? { baseline:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  branch:execFileSync('git',['branch','--show-current'],{cwd:repo,encoding:'utf8'}).trim(),
  workingTree:execFileSync('git',['status','--short'],{cwd:repo,encoding:'utf8'}), capturedAt:new Date().toISOString(),
  electron:process.versions.electron, platform:process.platform,
  provenance:'Original unedited Electron capturePage PNGs. Production root uses authenticated local simulation. Supplementary fixture cases use the established US-031 fixture and unchanged production state/runtime/component ownership; the missing-agent/global-live case is explicitly a synthetic presentation-only override because the trusted reducer rejects incomplete ready mirrors. Chromium input/media emulation does not establish manual native or VoiceOver behavior. Only this capture window disables background throttling.', captures:[], observations:{} };

function verifyTextImage(png, geometry) {
  const image = nativeImage.createFromBuffer(png), { width, height } = image.getSize(), bytes = image.toBitmap();
  assert.equal(image.isEmpty(),false);
  const scaleX=width/geometry.viewport[0],scaleY=height/geometry.viewport[1],tolerance=2;
  assert.equal(scaleX,geometry.dpr);assert.equal(scaleY,geometry.dpr);
  return geometry.controls.map(control=>{
    const {x,y,width:w,height:h}=control.bounds;
    assert.ok(x>=0&&y>=0&&x+w<=geometry.viewport[0]&&y+h<=geometry.viewport[1],`${control.name}: incomplete card visibility`);
    for(const text of [control.nameBox,control.lifecycle])assert.ok(text.x>=x&&text.y>=y&&text.x+text.width<=x+w&&text.y+text.height<=y+h,`${control.name}: clipped text`);
    // Sample the straight border, excluding rounded corners. Native color conversion shifts channels slightly.
    const left=Math.ceil((x+8)*scaleX),right=Math.floor((x+w-8)*scaleX),rows=[];
    for(let row=0;row<height;row++){
      let matching=0;
      for(let col=left;col<right;col++){
        const k=(row*width+col)*4;
        const rgb=Math.abs(bytes[k]-99)<=10&&Math.abs(bytes[k+1]-125)<=10&&Math.abs(bytes[k+2]-153)<=10;
        const bgr=Math.abs(bytes[k]-153)<=10&&Math.abs(bytes[k+1]-125)<=10&&Math.abs(bytes[k+2]-99)<=10;
        if((rgb||bgr)&&bytes[k+3]===255)matching++;
      }
      if(matching/(right-left)>=0.95)rows.push(row);
    }
    const expectedTop=y*scaleY,expectedBottom=(y+h-1)*scaleY;
    const nearest=expected=>rows.reduce((best,row)=>Math.abs(row-expected)<Math.abs(best-expected)?row:best,Infinity);
    const observedTop=nearest(expectedTop),observedBottom=nearest(expectedBottom);
    assert.ok(Math.abs(observedTop-expectedTop)<=tolerance&&Math.abs(observedBottom-expectedBottom)<=tolerance,
      `${control.name}: image/layout mismatch ${JSON.stringify({expectedTop,observedTop,expectedBottom,observedBottom,rows})}`);
    return {name:control.name,cssBounds:control.bounds,expectedTop,observedTop,expectedBottom,observedBottom,tolerancePhysicalPx:tolerance,matchingFraction:0.95,colorChannelTolerance:10};
  });
}

function saveRecord() {
  record.sourceSha256=Object.fromEntries(execFileSync('git',['ls-files','apps/desktop/src','apps/desktop/electron','apps/desktop/shared','packages/contracts','docs/design/references','apps/desktop/verification/us-031.tsx','apps/desktop/verification/us-031.html','apps/desktop/verification/author-us-026-room.py','package.json','package-lock.json'],{cwd:repo,encoding:'utf8'}).trim().split('\n').map(p=>[p,hash(readFileSync(resolve(repo,p)))]));
  record.toolingSha256=hash(readFileSync(__filename));
  writeFileSync(resolve(output,'capture-record.json'),JSON.stringify(record,null,2)+'\n');
}
async function run() {
  if(textOnly){
    assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),record.baseline);
    assert.equal(execFileSync('git',['branch','--show-current'],{cwd:repo,encoding:'utf8'}).trim(),record.branch);
    for(const [path,expected]of Object.entries(record.sourceSha256))assert.equal(hash(readFileSync(resolve(repo,path))),expected,path);
    record.textCorrection={finding:'M1',capturedAt:new Date().toISOString(),originalToolingSha256:record.toolingSha256,
      workingTree:execFileSync('git',['status','--short'],{cwd:repo,encoding:'utf8'}),replacedCaptures:[]};
  }
  process.env.ELECTRON_RENDERER_URL=base;process.env.COFFEE_BREAK_LOCAL_SIMULATION='1';
  await import(pathToFileURL(resolve(__dirname,'../out/main/main.js')).href);
  await app.whenReady();
  const win=BrowserWindow.getAllWindows()[0];assert.ok(win);
  win.on('page-title-updated',event=>{event.preventDefault();win.setTitle('US-033 Automated Evidence');});
  win.setTitle('US-033 Automated Evidence');win.webContents.setBackgroundThrottling(false);win.show();win.focus();mkdirSync(output,{recursive:true});
  const errors=[];win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  const js=code=>win.webContents.executeJavaScript(code);
  const invoke=code=>js(`import([...document.scripts].find(s=>s.src&&new URL(s.src).pathname==='/verification/us-031.tsx').src).then(async ({fixture})=>{${code}})`);
  const layout=()=>js(`(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const buttons=[...document.querySelectorAll('.agent-selector-button')];
    return {outer:[outerWidth,outerHeight],viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
      canvas:rect(document.querySelector('canvas')),canvases:document.querySelectorAll('canvas').length,
      overflow:document.documentElement.scrollWidth>innerWidth,scroll:scrollY,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,rootFont:getComputedStyle(document.documentElement).fontSize,
      selected:buttons.find(e=>e.getAttribute('aria-pressed')==='true')?.querySelector('.agent-selector-name').textContent??null,
      focused:document.activeElement.getAttribute('aria-label')??document.activeElement.textContent,
      clear:rect(document.querySelector('.clear-selection-button')),
      description:document.querySelector('.office-scene-host').getAttribute('aria-label'),
      controls:buttons.map(e=>({name:e.querySelector('.agent-selector-name').textContent,label:e.getAttribute('aria-label'),bounds:rect(e),
        portrait:rect(e.querySelector('.agent-portrait')),dot:rect(e.querySelector('.freshness-dot')),
        nameBox:rect(e.querySelector('.agent-selector-name')),lifecycle:rect(e.querySelector('.agent-selector-lifecycle')),
        check:rect(e.querySelector('.agent-selector-check')),freshness:e.querySelector('.freshness-dot').dataset.freshness,
        outline:getComputedStyle(e).outline,shadow:getComputedStyle(e).boxShadow}))};})()`);
  const invariant=g=>{
    assert.equal(g.canvases,1);assert.equal(g.canvas.width,640);assert.equal(g.canvas.height,360);assert.equal(g.overflow,false);
    assert.deepEqual(g.controls.map(c=>c.name),names);assert.ok(g.clear.width>=44&&g.clear.height>=44);
    assert.ok(g.description.includes('Meeting Room and Focus Room are empty decorative zones.'));
    for(const c of g.controls){assert.equal(c.portrait.width,48);assert.equal(c.portrait.height,48);assert.equal(c.dot.width,8);assert.equal(c.dot.height,8);assert.ok(c.bounds.height>=120);}
  };
  const ready=async fixture=>{for(let i=0;i<80;i++){
    if(await js("document.querySelectorAll('canvas').length===1")&&(!fixture||await invoke('return fixture.scene()?.children.list.some(e=>e.name==="mock-agent-sol")??false;'))){await wait(150);return;}
    await wait(100);
  }throw new Error('Renderer did not initialize');};
  const resize=async(w,h)=>{win.show();win.focus();win.setSize(w,h);await wait(100);assert.deepEqual(win.getSize(),[w,h]);};
  const settleText=()=>js(`new Promise((resolve,reject)=>{
    let last='',consecutive=0,frames=0,diagnostic;
    const timeout=setTimeout(()=>reject(new Error('Text layout did not settle: '+JSON.stringify(diagnostic))),2000);
    const sample=()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
      diagnostic={scroll:[scrollX,scrollY],viewport:[innerWidth,innerHeight],font:getComputedStyle(document.documentElement).fontSize,
        cards:[...document.querySelectorAll('.agent-selector-button')].map(e=>[rect(e),rect(e.querySelector('.agent-selector-name')),rect(e.querySelector('.agent-selector-lifecycle'))]),canvas:rect(document.querySelector('canvas'))};
      const next=JSON.stringify(diagnostic);consecutive=next===last?consecutive+1:0;last=next;frames++;
      if(consecutive>=3){clearTimeout(timeout);resolve({frames,consecutiveStableFrames:consecutive+1,...diagnostic});}else requestAnimationFrame(sample);
    };requestAnimationFrame(sample);
  })`);
  const capture=async(name,provenance,office=false)=>{
    const text=name.includes('-text-');let g,rect,im,png,settlement,correspondence,lastError;
    for(let attempt=1;attempt<=(text?6:1);attempt++){
      if(text)settlement={attempt,...await settleText()};
      g=await layout();invariant(g);rect=office?{x:Math.round(g.canvas.x),y:Math.round(g.canvas.y),width:640,height:360}:undefined;
      im=await win.webContents.capturePage(rect);png=im.toPNG();assert.equal(nativeImage.createFromBuffer(png).isEmpty(),false);
      if(!text)break;
      try{
        const after=await layout();
        for(const field of ['scroll','viewport','rootFont','canvas','controls'])assert.deepEqual(after[field],g[field],`Layout changed during capture: ${field}`);
        correspondence=verifyTextImage(png,g);lastError=undefined;break;
      }catch(error){lastError=error;}
    }
    if(lastError)throw lastError;
    writeFileSync(resolve(output,name+'.png'),png);
    const fixture=win.webContents.getURL().includes('/verification/');
    const entry={name,provenance,outer:win.getSize(),contentBounds:win.getContentBounds(),...g,crop:rect??null,imageSize:im.getSize(),pngSha256:hash(png),
      ...(text?{capturedAt:new Date().toISOString(),settlement,correspondence}:{}),
      trustedState:fixture?await invoke('return fixture.snapshot();'):await js("import('/src/agentState/runtime.ts').then(m=>m.agentStateStore.getSnapshot())"),presentation:fixture?await invoke('return fixture.presentation();'):await js("import('/src/agentState/runtime.ts').then(m=>m.officePresentationRuntime.getSnapshot())")};
    if(textOnly){const index=record.captures.findIndex(c=>c.name===name);assert.ok(index>=0);record.captures[index]=entry;record.textCorrection.replacedCaptures.push(name);}
    else record.captures.push(entry);
  };
  const captureText=async()=>{
    for(const [w,h]of [[1100,760],[760,540]])for(const percent of [125,200]){
      await resize(w,h);await js(`document.documentElement.style.fontSize='${percent}%'`);
      await js("document.querySelector('.agents-section').scrollIntoView({block:'start',behavior:'instant'})");
      await capture(`${w}-text-${percent}`,synthetic+'; root text enlargement');
    }
  };
  const select=async name=>{await js(`document.querySelectorAll('.agent-selector-button')[${names.indexOf(name)}].click()`);await wait(50);assert.equal((await layout()).selected,name);};
  const clear=async()=>{await js("document.querySelector('.clear-selection-button').click()");await wait(40);assert.equal((await layout()).selected,null);};
  const scene=()=>invoke(`return fixture.scene().children.list.map(e=>({type:e.type,name:e.name,x:e.x,y:e.y,depth:e.depth,text:e.text,width:e.width,height:e.height,visible:e.visible,interactive:!!e.input,bounds:e.type==='Text'?{...e.getBounds(),right:e.getBounds().right,bottom:e.getBounds().bottom}:null,playing:e.anims?.isPlaying,commands:e.type==='Graphics'?[...e.commandBuffer]:null}));`);
  const verifyPlaques=async()=>{
    const items=await scene();
    for(const [i,id]of ids.entries()){
      const p=items.find(e=>e.name==='office-plaque-'+id);assert.ok(p);assert.deepEqual([p.x,p.y,p.depth,p.interactive],[...plaques[i].slice(0,2),12,false]);
      const texts=items.filter(e=>e.type==='Text'&&e.x>=p.x&&e.x<p.x+88&&e.y>=p.y&&e.y<p.y+36);
      assert.equal(texts.length,2);assert.ok(texts.some(e=>e.text===names[i]));
      for(const t of texts){assert.equal(t.visible,true);assert.ok(t.bounds.x>=p.x&&t.bounds.y>=p.y&&t.bounds.right<=p.x+88&&t.bounds.bottom<=p.y+36,JSON.stringify(t));}
    }
    return items;
  };
  const key=async(key,code,n,modifiers=0)=>{
    const payload={key,code,windowsVirtualKeyCode:n,nativeVirtualKeyCode:n,modifiers};
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:key==='Enter'?'keyDown':'rawKeyDown',...payload,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...payload});await wait(60);
  };
  const pointer=async(x,y)=>{const g=await layout(),point={x:Math.round(g.canvas.x+x),y:Math.round(g.canvas.y+y)};
    win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await wait(50);};
  const roomBytes=async()=>{const g=await layout();return(await win.webContents.capturePage({x:Math.round(g.canvas.x),y:Math.round(g.canvas.y),width:640,height:360})).toBitmap();};
  await ready(false);
  if(textOnly){
    await win.webContents.loadURL(base+'/verification/us-031.html');await ready(true);
    const input=record.captures.find(c=>c.name==='1100-text-200').presentation;
    for(const id of ids)await invoke(`fixture.update(${JSON.stringify(id)},${JSON.stringify(input[id].state)},${JSON.stringify(input[id].activity)},${JSON.stringify(input[id].reason)})`);
    await js("document.querySelector('.clear-selection-button').focus({preventScroll:true})");
    await captureText();assert.equal(errors.length,0,JSON.stringify(errors));saveRecord();
    console.log('PASS US-033 M1: four text captures settled and pixel-correspondence verified; other captures preserved');return;
  }
  await wait(4500);
  for(const [w,h]of [[1100,760],[760,540]]){await resize(w,h);await js('scrollTo(0,0)');await capture(`${w}-production`,'Production root; authenticated local simulation');}
  win.webContents.debugger.attach('1.3');
  await win.webContents.loadURL(base+'/verification/us-031.html');await ready(true);await resize(1100,760);
  record.observations.initialScene=await verifyPlaques();
  const g=await layout();
  for(const c of g.controls){
    assert.equal(c.bounds.width,88);assert.equal(c.bounds.height,120);
    for(const [field,x,y]of [['portrait',20,10],['dot',40,62],['nameBox',null,74],['lifecycle',null,92],['check',72,6]]){
      if(x!==null)assert.equal(c[field].x-c.bounds.x,x);assert.equal(c[field].y-c.bounds.y,y);
    }
  }
  record.observations.defaultSelector=g.controls;
  for(const state of ['idle','working','waiting','completed','error']){
    for(const id of ids)await invoke(`fixture.update('${id}','${state}','Synthetic exact ${state}')`);
    await wait(550);await verifyPlaques();
    const value=await layout();assert.ok(value.controls.every(c=>c.freshness==='current'&&c.label.includes(state[0].toUpperCase()+state.slice(1))));
    await capture('lifecycle-'+state,synthetic,true);
  }
  await select('Mina');await capture('current-error',synthetic);
  for(const state of ['working','error']){
    await invoke(`await fixture.reset('live');fixture.update('mock-agent-mina','${state}','Retained exact ${state}','approval_required');fixture.connection('disconnected')`);
    await ready(true);const retained=await roomBytes();await wait(1500);assert.equal(Buffer.compare(retained,await roomBytes()),0);
    assert.ok((await layout()).controls.every(c=>c.freshness==='last-known'));
    assert.equal(await js("document.querySelector('.agent-inspection dd').textContent"),'Retained exact '+state);
    await capture('retained-'+state,synthetic);await verifyPlaques();
  }
  await invoke("fixture.connection('synchronizing')");assert.ok((await layout()).controls.every(c=>c.freshness==='last-known'));
  await capture('recovering',synthetic);await invoke("fixture.connection('ready')");assert.ok((await layout()).controls.every(c=>c.freshness==='current'));record.observations.recovery=true;
  await invoke("await fixture.reset('unavailable')");await ready(true);await capture('no-state',synthetic);await verifyPlaques();
  assert.ok((await layout()).controls.every(c=>c.label.endsWith('No trusted state')&&c.freshness==='no-state'));
  await invoke("await fixture.reset('live');fixture.withoutTrustedPresentation('mock-agent-sol')");await ready(true);await select('Sol');
  assert.equal((await invoke('return fixture.snapshot();')).synchronized,true);
  assert.equal((await invoke("return fixture.presentation()['mock-agent-sol'];")).live,true);
  assert.equal((await layout()).controls[2].freshness,'no-state');await capture('globally-live-no-state',synthetic+'; synthetic presentation-only missing-agent override');await verifyPlaques();
  await invoke("await fixture.reset('live')");await ready(true);
  for(const [caseName,state,activity]of [['canonical','waiting','Taking a coffee break in the simulated office'],['generic-waiting','waiting','Waiting for approval'],['idle','idle','Ready']]){
    await invoke(`fixture.update('mock-agent-sol','${state}',${JSON.stringify(activity)})`);await select('Sol');await verifyPlaques();
    const items=await scene(),steam=items.find(e=>e.type==='Graphics'&&e.x===230&&e.y===248);
    assert.equal(steam.visible,caseName==='canonical');assert.ok((await layout()).controls[2].label.includes(state==='idle'?'Idle':'Waiting'));
    await capture('sol-'+caseName,synthetic,true);
  }
  await resize(1100,760);await select('Ari');await capture('selected',synthetic);
  await js("window.us033Buttons=[...document.querySelectorAll('.agent-selector-button')];window.us033Buttons[0].focus()");await key('Tab','Tab',9);
  assert.equal((await layout()).selected,'Ari');assert.ok((await layout()).focused.startsWith('Select Mina'));
  assert.ok((await layout()).controls[1].outline.includes('3px')&&(await layout()).controls[1].outline.includes('151, 220, 229'));await capture('focused-unselected',synthetic+'; Chromium keyboard input');
  await key('Enter','Enter',13);assert.equal((await layout()).selected,'Mina');await capture('selected-focused',synthetic+'; Chromium keyboard input');
  const before=await layout();
  await invoke("fixture.update('mock-agent-mina','working','Focused update');fixture.connection('disconnected')");await wait(60);
  assert.equal(await js('window.us033Buttons.every((e,i)=>e===document.querySelectorAll(".agent-selector-button")[i])'),true);
  assert.ok((await layout()).focused.startsWith('Select Mina'));assert.equal((await layout()).scroll,before.scroll);assert.equal((await layout()).selected,'Mina');
  await capture('focused-retained',synthetic);record.observations.stableNodesFocusAndScroll=true;
  await invoke("fixture.connection('synchronizing');fixture.connection('ready')");
  await resize(760,540);assert.ok((await layout()).focused.startsWith('Select Mina'));assert.equal((await layout()).selected,'Mina');
  record.observations.responsiveSelectionFocus=true;
  await js("document.querySelectorAll('.homepage-navigation button')[1].click()");await wait(60);
  assert.equal(await js('document.activeElement.id'),'agents-section-title');
  const compact=await layout();assert.ok(compact.scroll>0);
  assert.ok(compact.controls.every(c=>c.bounds.y>=0&&c.bounds.y+c.bounds.height<=compact.viewport[1]));
  record.observations.agentsNavigation=true;await capture('760-scrolled-selector',synthetic+'; Agents region navigation');
  record.observations.pointer=[];
  for(const [w,h]of [[1100,760],[760,540]]){
    await resize(w,h);await js('scrollTo(0,0)');
    for(const [i,[x,y]]of anchors.entries()){
      for(const [px,py]of [[x-23,y-55],[x+23,y-55],[x-23,y+7],[x+23,y+7]]){await clear();await pointer(px,py);assert.equal((await layout()).selected,names[i]);}
      for(const [px,py]of [[x-25,y-20],[x+25,y-20],[x,y-57],[x,y+9]]){await clear();await pointer(px,py);assert.equal((await layout()).selected,null);}
      await pointer(plaques[i][0]+44,plaques[i][1]+18);assert.equal((await layout()).selected,null);
      record.observations.pointer.push({outer:[w,h],identity:names[i],inside:4,outside:4,plaqueNoninteractive:true});
    }
    // Seed focus on the preserved Agents heading; then use real Chromium Tab/activation.
    await js("document.getElementById('agents-section-title').focus()");
    for(let i=0;i<3;i++){await key('Tab','Tab',9);assert.ok((await layout()).focused.startsWith('Select '+names[i]));
      await key(i===1?'Enter':' ',i===1?'Enter':'Space',i===1?13:32);assert.equal((await layout()).selected,names[i]);}
    await key('Tab','Tab',9);assert.equal((await layout()).focused.trim(),'Clear selection');await key(' ','Space',32);
    assert.equal((await layout()).selected,null);assert.equal((await layout()).focused.trim(),'Clear selection');
    assert.equal(await js("document.querySelector('.clear-selection-button').getAttribute('aria-disabled')"),'true');
    await capture(`${w}-keyboard-clear`,synthetic+'; Chromium keyboard input');
  }
  record.observations.keyboardBothSizes=true;
  await captureText();
  await js("document.documentElement.style.fontSize=''");await resize(1100,760);await js('scrollTo(0,0)');
  await invoke("fixture.update('mock-agent-ari','working','Reduced Working');fixture.update('mock-agent-mina','working','Reduced Working');fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(100);
  const reduced=await roomBytes();await wait(1500);assert.equal(Buffer.compare(reduced,await roomBytes()),0);await capture('reduced-motion',synthetic+'; Chromium media emulation');
  record.observations.reducedMotionStatic=true;
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});
  for(const missing of ['background','foreground']){
    win.webContents.session.webRequest.onBeforeRequest({urls:[`${base}/src/office/assets/office-room-${missing}.png*`]},(details,callback)=>callback({cancel:!new URL(details.url).searchParams.has('import')}));
    await win.webContents.session.clearCache();await win.webContents.loadURL(base+'/verification/us-031.html?missing='+missing);await ready(true);
    for(const [w,h]of [[1100,760],[760,540]]){await resize(w,h);await js('scrollTo(0,0)');await verifyPlaques();
      const items=await scene();assert.equal(items.filter(e=>e.type==='Image').length,0);
      await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");
      await capture(`${w}-fallback-${missing}`,synthetic+'; controlled single-sheet request failure');}
  }
  win.webContents.session.webRequest.onBeforeRequest(null);
  await win.webContents.loadURL(base+'/verification/us-031.html');await ready(true);await select('Mina');
  await invoke('window.us033Stopped=fixture.scene();window.us033Stopped.scene.stop()');await wait(150);
  const shutdown=await invoke('const s=window.us033Stopped;return {sprites:s.agentSprites.size,motions:s.motions.size,workstations:s.workstations.size,labels:s.statusLabels.size,plaques:s.plaques.size,steam:!!s.coffeeSteam};');
  assert.deepEqual(shutdown,{sprites:0,motions:0,workstations:0,labels:0,plaques:0,steam:false});record.observations.explicitShutdown=shutdown;
  await invoke('fixture.remount()');await ready(true);assert.equal((await layout()).selected,'Mina');record.observations.sameHostRemount=true;
  win.webContents.reload();await wait(250);await ready(true);assert.equal((await layout()).selected,null);record.observations.reloadOneCanvasUnselected=true;
  await win.webContents.debugger.sendCommand('Accessibility.enable');const ax=await win.webContents.debugger.sendCommand('Accessibility.getFullAXTree');
  record.observations.accessibilityButtons=ax.nodes.filter(n=>n.role?.value==='button').map(n=>({name:n.name?.value,properties:n.properties}));
  record.observations.rendererErrors=errors;assert.equal(errors.length,0,JSON.stringify(errors));
  saveRecord();
  console.log('PASS US-033:',record.captures.length,'original captures; default bounds, freshness, input, text enlargement, fallback, shutdown/remount/reload');
}
module.exports={verifyTextImage};
if(resolve(process.argv[1]??'')===__filename)run().then(()=>app.quit()).catch(error=>{console.error(error);app.once('will-quit',()=>app.exit(1));app.quit();});
