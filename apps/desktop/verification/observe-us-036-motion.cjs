// Timed read-only observation of real Phaser frames/Graphics; no frame/timer forcing.
const {app,BrowserWindow}=require('electron');
const {readFileSync,writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const repo=resolve(__dirname,'../../..'),base=process.argv[2]??'http://localhost:5173';
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const hash=p=>createHash('sha256').update(readFileSync(resolve(repo,p))).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 process.env.ELECTRON_RENDERER_URL=base;process.env.COFFEE_BREAK_LOCAL_SIMULATION='1';
 await import(pathToFileURL(resolve(__dirname,'../out/main/main.js')).href);await app.whenReady();
 const win=BrowserWindow.getAllWindows()[0];win.show();win.focus();win.webContents.setBackgroundThrottling(false);
 const js=code=>win.webContents.executeJavaScript(code),invoke=code=>js('import("/verification/us-035.tsx").then(({fixture})=>{'+code+'})');
 await win.webContents.loadURL(base+'/verification/us-035.html');
 for(let i=0;i<100;i++){if(await js('document.querySelectorAll("canvas").length===1')&&await invoke('return !!fixture.scene()?.children.list.length'))break;await wait(50);}
 win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 const read=()=>invoke('const s=fixture.scene(),g=s.children.list.filter(x=>x.type==="Graphics");return {frames:[...s.agentSprites].map(([id,x])=>[id,x.frame.name,x.anims.isPlaying]),monitor:g.find(x=>x.x===384&&x.y===168)?.commandBuffer,steam:g.find(x=>x.x===230&&x.y===248)?.commandBuffer,presentation:fixture.presentation(),state:fixture.snapshot(),visibility:document.visibilityState};');
 const episodes=[];
 for(const [w,h]of [[1100,760],[760,540]]){
  win.setSize(w,h);await invoke("fixture.update('mock-agent-mina','working','Timed live working');fixture.update('mock-agent-sol','waiting','Taking a coffee break in the simulated office');");await wait(80);
  const before=await read(),started=Date.now(),changes={character:false,monitor:false,coffeeCharacter:false,steam:false},firstChanged={};assert.equal(before.presentation['mock-agent-mina'].reducedMotion,false);
  while(Date.now()-started<5000&&!Object.values(changes).every(Boolean)){
   await wait(50);const after=await read();
   for(const [key,id]of [['character','mock-agent-mina'],['coffeeCharacter','mock-agent-sol']])if(JSON.stringify(after.frames.find(x=>x[0]===id))!==JSON.stringify(before.frames.find(x=>x[0]===id))){if(!changes[key])firstChanged[key]={elapsedMs:Date.now()-started,sample:after};changes[key]=true;}
   for(const key of ['monitor','steam'])if(JSON.stringify(after[key])!==JSON.stringify(before[key])){if(!changes[key])firstChanged[key]={elapsedMs:Date.now()-started,sample:after};changes[key]=true;}
  }
  assert.ok(Object.values(changes).every(Boolean),JSON.stringify(changes));const after=await read();
  episodes.push({outer:win.getBounds(),content:win.getContentBounds(),viewport:await js('[innerWidth,innerHeight]'),dpr:await js('devicePixelRatio'),before,after,changes,firstChanged,elapsedMs:Date.now()-started});
 }
 const files=['apps/desktop/src/office/OfficeScene.ts','apps/desktop/src/office/applyOfficeVisual.ts','apps/desktop/src/office/workstationPresentation.ts','apps/desktop/src/office/coffeeSteamPresentation.ts','apps/desktop/src/office/officePresentationRuntime.ts','apps/desktop/verification/us-035.tsx'];
 writeFileSync(resolve(repo,'docs/verification/assets/us-036/motion-record.json'),JSON.stringify({capturedAt:new Date().toISOString(),sourceClass:'Supplemental production-component fixture; synthetic accepted inputs; Chromium no-preference media emulation',episodes,sourceSha256:Object.fromEntries(files.map(p=>[p,hash(p)])),toolingSha256:hash('apps/desktop/verification/observe-us-036-motion.cjs'),runtime:process.versions},null,2)+'\n');console.log('PASS US-036 timed live character/monitor/coffee/steam observations: both targets');
}
run().then(()=>app.quit()).catch(e=>{console.error(e);app.exit(1)});
