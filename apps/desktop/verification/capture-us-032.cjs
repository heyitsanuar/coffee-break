// Unedited production-main captures; synthetic fixture/input/media evidence is identified separately.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const base = process.argv[2] ?? 'http://localhost:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Expected loopback development URL');
const repo = resolve(__dirname, '../../..'), output = resolve(repo, 'docs/verification/assets/us-032');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(done => setTimeout(done, ms));
const anchors = [['Ari',292,174], ['Mina',360,240], ['Sol',220,282]];
const crops = { ari:[252,88,124,116], mina:[320,162,124,106], sol:[192,200,80,112], 'ari-monitor':[308,94,56,40], 'mina-monitor':[376,160,56,40], 'right-zones':[456,20,168,312] };
async function run() {
  process.env.ELECTRON_RENDERER_URL = base;
  process.env.COFFEE_BREAK_LOCAL_SIMULATION = '1';
  await import(pathToFileURL(resolve(__dirname, '../out/main/main.js')).href);
  await app.whenReady();
  const win = BrowserWindow.getAllWindows()[0]; assert.ok(win);
  // Keep this verification window active when Codex occludes it; production options are unchanged.
  win.webContents.setBackgroundThrottling(false);win.show();win.focus();
  mkdirSync(output, { recursive:true });
  const errors = [];
  win.webContents.on('console-message', event => { if(event.level==='error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  const invoke = code => js(`import([...document.scripts].find(s=>s.src && new URL(s.src).pathname==='/verification/us-031.tsx').src).then(async ({fixture})=>{${code}})`);
  const record = { baseline:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(), capturedAt:new Date().toISOString(), electron:process.versions.electron, platform:process.platform,
    provenance:'Unedited capturePage PNGs from the framed production-main Electron window. Production-root captures use authenticated simulation. Supplementary cases reuse the existing US-031 development fixture and production Application/store/runtime/host/scene with synthetic accepted renderer inputs. Capture-window background throttling is disabled to prevent occlusion pausing Phaser. Chromium pointer/keyboard input and media emulation are not manual native or VoiceOver evidence.', captures:[], observations:{} };
  const layout = () => js(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {outer:[${'window.outerWidth'},${'window.outerHeight'}],viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvas:{x:r.x,y:r.y,width:r.width,height:r.height},canvases:document.querySelectorAll('canvas').length,overflow:document.documentElement.scrollWidth>innerWidth,scroll:scrollY,selected:document.querySelector('[aria-pressed=true]')?.getAttribute('aria-label')??null,focus:document.activeElement.getAttribute('aria-label')??document.activeElement.textContent,description:document.querySelector('.office-scene-host').getAttribute('aria-label')}})()`);
  const invariant = g => { assert.equal(g.canvases,1); assert.equal(g.canvas.width,640); assert.equal(g.canvas.height,360); assert.equal(g.overflow,false); assert.ok(g.description.includes('Meeting Room and Focus Room are empty decorative zones.')); };
  const ready = async (fixture=false) => { for(let i=0;i<80;i++) { if(await js("document.querySelectorAll('canvas').length===1") && (!fixture || await invoke('return fixture.scene()?.children.list.some(e=>e.name==="mock-agent-sol")??false;'))) { await wait(120);return; } await wait(100); } throw new Error('Renderer did not initialize'); };
  const resize = async (w,h) => { win.show();win.focus();win.setSize(w,h);await js('scrollTo(0,0)');await wait(100);assert.deepEqual(win.getSize(),[w,h]); };
  const capture = async (name, provenance, cropName) => {
    const g=await layout();invariant(g);
    let rect;
    if(cropName) { const [x,y,width,height]=cropName==='office'?[0,0,640,360]:crops[cropName];rect={x:Math.round(g.canvas.x+x),y:Math.round(g.canvas.y+y),width,height}; }
    // Electron capturePage accepts content DIP rectangles; native image size records actual DPR output.
    const im=await win.webContents.capturePage(rect), png=im.toPNG();writeFileSync(resolve(output,name+'.png'),png);
    record.captures.push({name,provenance,crop:rect??null,outer:win.getSize(),contentBounds:win.getContentBounds(),...g,imageSize:im.getSize(),pngSha256:hash(png)});
  };
  const fields = () => js("Object.fromEntries([...document.querySelectorAll('.agent-inspection dl>div')].map(r=>[r.querySelector('dt').textContent,r.querySelector('dd').textContent]))");
  const clear = async () => {await js("document.querySelector('.clear-selection-button').click()");await wait(40);};
  const select = async name => {await js(`document.querySelector('[aria-label="Select ${name}"]').click()`);await wait(40);assert.equal(await js("document.getElementById('agent-inspection-title').textContent"),name);};
  const scene = () => invoke(`return fixture.scene().children.list.map(e=>({type:e.type,name:e.name,x:e.x,y:e.y,depth:e.depth,text:e.text,interactive:!!e.input,visible:e.visible,texture:e.texture?.key,frame:e.frame?.name,playing:e.anims?.isPlaying,commands:e.type==='Graphics'?[...e.commandBuffer]:undefined}));`);
  const monitor = (items,name) => items.find(e=>e.type==='Graphics'&&e.x===(name==='Ari'?316:384)&&e.y===(name==='Ari'?102:168));
  const key = async (key,code,n,modifiers=0) => { const payload={key,code,windowsVirtualKeyCode:n,nativeVirtualKeyCode:n,modifiers};await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:key==='Enter'?'keyDown':'rawKeyDown',...payload,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...payload});await wait(60); };
  const pointer = async (x,y) => { const g=await layout();const point={x:Math.round(g.canvas.x+x),y:Math.round(g.canvas.y+y)};win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await wait(50); };
  const roomBytes = async () => {const g=await layout();return (await win.webContents.capturePage({x:Math.round(g.canvas.x),y:Math.round(g.canvas.y),width:640,height:360})).toBitmap();};
  const synthetic='Production components; synthetic accepted renderer inputs';
  await ready();await wait(4500);
  for(const [w,h] of [[1100,760],[760,540]]) {await resize(w,h);await capture(`${w}-production`,'Production root; authenticated development simulation');}
  win.webContents.debugger.attach('1.3');
  await win.webContents.loadURL(`${base}/verification/us-031.html`);await ready(true);await resize(1100,760);assert.equal(await js('document.hidden'),false);
  record.observations.initialScene=await scene();
  const items=record.observations.initialScene;
  assert.deepEqual(items.filter(e=>e.type==='Sprite').map(e=>[e.name,e.x,e.y,e.depth]),anchors.map(([name,x,y])=>[`mock-agent-${name.toLowerCase()}`,x,y,10]));
  for(const label of ['Meeting Room','Focus Room']) {const e=items.find(e=>e.text===label);assert.equal(e.depth,12);assert.equal(e.interactive,false);}
  for(const [,x,y] of anchors) assert.ok(items.some(e=>e.type==='Rectangle'&&e.x===x&&e.y===y-66&&e.depth===12));
  await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");
  await capture('complete-office',synthetic,'office');await capture('right-zones',synthetic,'right-zones');
  for(const [name] of anchors) {await select(name);await capture(name.toLowerCase()+'-relationship',synthetic,name.toLowerCase());}
  record.observations.monitorStates=[];
  for(const state of ['idle','working','waiting','completed','error']) {
    for(const name of ['ari','mina','sol']) await invoke(`fixture.update('mock-agent-${name}','${state}','Synthetic ${state}')`);
    await wait(600);const actual=await scene();const a=monitor(actual,'Ari'),b=monitor(actual,'Mina');assert.deepEqual(a.commands,b.commands);
    record.observations.monitorStates.push({state,ari:a,mina:b});
    await capture('monitors-'+state,synthetic,'office');
    if(state==='working') {await capture('ari-monitor',synthetic,'ari-monitor');await capture('mina-monitor',synthetic,'mina-monitor');}
  }
  // Observe motion without forcing frames or timers.
  for(const name of ['ari','mina']) await invoke(`fixture.update('mock-agent-${name}','working','Observe live Working')`);
  const liveA=await scene();let liveB=liveA;
  for(let i=0;i<10 && JSON.stringify(monitor(liveA,'Ari').commands)===JSON.stringify(monitor(liveB,'Ari').commands);i++) {await wait(300);liveB=await scene();}
  assert.notDeepEqual(monitor(liveA,'Ari').commands,monitor(liveB,'Ari').commands,JSON.stringify(await invoke('return {presentation:fixture.presentation(),hidden:document.hidden,loop:fixture.scene().sys.game.loop.running};')));
  record.observations.liveMonitorAlternation=true;
  record.observations.coffee=[];
  for(const [name,state,activity] of [['canonical','waiting','Taking a coffee break in the simulated office'],['generic-waiting','waiting','Waiting for approval'],['idle','idle','Ready']]) {
    await invoke(`fixture.update('mock-agent-sol','${state}',${JSON.stringify(activity)})`);
    const actual=await scene(), steam=actual.find(e=>e.type==='Graphics'&&e.x===230&&e.y===248);assert.equal(steam.visible,name==='canonical');
    record.observations.coffee.push({case:name,presentation:await invoke("return fixture.presentation()['mock-agent-sol'];"),steam});
    await capture('sol-'+name,synthetic,'sol');
  }
  await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office');fixture.connection('disconnected')");await select('Mina');await wait(50);
  const retained=await roomBytes();await wait(1700);assert.equal(Buffer.compare(retained,await roomBytes()),0);await capture('retained',synthetic);
  record.observations.retained={identicalDecodedRoomAcross1700ms:true,presentation:await invoke('return fixture.presentation();')};
  await invoke("fixture.connection('synchronizing');fixture.connection('ready')");
  record.observations.pointer=[];
  for(const [w,h] of [[1100,760],[760,540]]) {
    await resize(w,h);
    for(const [name,x,y] of anchors) {
      for(const [px,py] of [[x-23,y-55],[x+23,y-55],[x-23,y+7],[x+23,y+7]]) {await clear();await pointer(px,py);assert.equal((await layout()).selected,'Select '+name,JSON.stringify({outer:[w,h],name,px,py,layout:await layout()}));}
      for(const [px,py] of [[x-25,y-20],[x+25,y-20],[x,y-57],[x,y+9]]) {await clear();await pointer(px,py);assert.equal((await layout()).selected,null);}
      record.observations.pointer.push({outer:[w,h],name,insideCorners:4,outsideSides:4});
    }
    await select('Ari');await js("document.querySelector('[aria-label=\"Select Ari\"]').focus()");await key('Tab','Tab',9);
    assert.equal((await layout()).focus,'Select Mina');assert.equal((await layout()).selected,'Select Ari');
    const outline=await js('getComputedStyle(document.activeElement).outline');assert.ok(outline.includes('3px')&&outline.includes('151, 220, 229'));
    await key('Enter','Enter',13);assert.equal((await layout()).selected,'Select Mina');
    await key('Tab','Tab',9);await key('Tab','Tab',9);await key(' ','Space',32);assert.equal((await layout()).selected,null);
    await key('Tab','Tab',9,8);await key(' ','Space',32);assert.equal((await layout()).selected,'Select Sol');
    await capture(`${w}-keyboard-selection`,synthetic+'; Chromium keyboard input');
    await js('scrollTo(0,0)');
  }
  record.observations.keyboardBothSizes=true;
  await select('Mina');await invoke("await fixture.reset('unavailable')");await ready(true);await capture('no-state',synthetic);
  assert.ok(Object.values(await invoke('return fixture.presentation();')).every(p=>p.state===null));
  await invoke("await fixture.reset('live');fixture.update('mock-agent-ari','working','Reduced Working');fixture.update('mock-agent-mina','working','Reduced Working');fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office')");
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(100);
  const reduced=await roomBytes();await wait(1700);assert.equal(Buffer.compare(reduced,await roomBytes()),0);await capture('reduced-motion',synthetic+'; Chromium media emulation');
  record.observations.reducedMotion={identicalDecodedRoomAcross1700ms:true,presentation:await invoke('return fixture.presentation();')};
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});
  record.observations.fallback=[];const blocked=[];
  for(const missing of ['background','foreground']) {
    // Existing US-022 capture seam: Phaser XHR bytes fail; Vite ?import modules pass.
    win.webContents.session.webRequest.onBeforeRequest({urls:[`${base}/src/office/assets/office-room-${missing}.png*`]},(details,callback)=>{
      const image=!new URL(details.url).searchParams.has('import');if(image) blocked.push(details.url);callback({cancel:image});
    });
    await win.webContents.session.clearCache();await win.webContents.loadURL(`${base}/verification/us-031.html?missing=${missing}`);await ready(true);
    await invoke("fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office');fixture.update('mock-agent-ari','working','Fallback Working');fixture.update('mock-agent-mina','waiting','Fallback Waiting')");
    for(const [w,h] of [[1100,760],[760,540]]) {
      await resize(w,h);const actual=await scene();assert.equal(actual.filter(e=>e.type==='Image'&&e.texture?.startsWith('office-room-')).length,0);
      assert.equal(actual.filter(e=>e.type==='Sprite').length,3);assert.equal(actual.filter(e=>e.type==='Graphics'&&e.x===230&&e.y===248&&e.visible).length,1);
      assert.ok(monitor(actual,'Ari')&&monitor(actual,'Mina'));
      await pointer(360,216);assert.equal((await layout()).selected,'Select Mina');
      await capture(`${w}-fallback-${missing}`,synthetic+'; controlled Chromium room-PNG request failure');
      record.observations.fallback.push({missing,outer:[w,h],scene:actual});
    }
  }
  win.webContents.session.webRequest.onBeforeRequest(null);
  record.observations.fallbackBlockedRequests=blocked;
  assert.deepEqual([...new Set(blocked.map(url=>new URL(url).pathname))].sort(),['/src/office/assets/office-room-background.png','/src/office/assets/office-room-foreground.png']);
  await win.webContents.loadURL(`${base}/verification/us-031.html`);await ready(true);await select('Mina');
  await invoke('window.us032Stopped=fixture.scene();window.us032StoppedSprites=[...window.us032Stopped.agentSprites.values()];window.us032Stopped.scene.stop();');
  await wait(150); // ScenePlugin.stop queues shutdown for the next normal game step.
  const shutdown=await invoke('const s=window.us032Stopped;return {sprites:s.agentSprites.size,motions:s.motions.size,workstations:s.workstations.size,labels:s.statusLabels.size,steam:!!s.coffeeSteam};');
  assert.equal(await invoke('return window.us032StoppedSprites.every(s=>!s.scene&&!s.anims);'),true);
  assert.deepEqual(shutdown,{sprites:0,motions:0,workstations:0,labels:0,steam:false});record.observations.explicitShutdown=shutdown;
  await invoke('fixture.remount()');await ready(true);assert.equal((await layout()).selected,'Select Mina');
  record.observations.remountOneCanvas=true;
  win.webContents.reload();await wait(250);await ready(true);assert.equal((await layout()).canvases,1);record.observations.reloadOneCanvas=true;
  record.observations.rendererErrors=errors;assert.equal(errors.length,0,JSON.stringify(errors));
  record.observations.manualNative={response:'Looks good',scope:'Aggregate Product Owner response to desktop/compact native checklist. Not a per-control transcript.',unverified:['VoiceOver','native OS reduced motion']};
  record.sourceSha256=Object.fromEntries(execFileSync('git',['ls-files','apps/desktop/src','apps/desktop/electron','apps/desktop/shared','packages/contracts','docs/design/references','apps/desktop/verification/us-031.tsx','apps/desktop/verification/us-031.html','apps/desktop/verification/author-us-026-room.py','package.json','package-lock.json'],{cwd:repo,encoding:'utf8'}).trim().split('\n').map(p=>[p,hash(readFileSync(resolve(repo,p)))]));
  record.toolingSha256=hash(readFileSync(__filename));
  writeFileSync(resolve(output,'capture-record.json'),JSON.stringify(record,null,2)+'\n');
  console.log('PASS US-032 renderer:',record.captures.length,'unedited captures; geometry, motion, pointers, keyboard, both-sheet fallback, shutdown and remount/reload');
}
run().then(()=>app.quit()).catch(error=>{console.error(error);app.once('will-quit',()=>app.exit(1));app.quit();});
