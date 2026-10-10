// Read-only evidence integrity and protected-region audit; no files/captures are rewritten.
const { app, nativeImage } = require('electron');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { verifyTextImage } = require('./capture-us-033.cjs');
const repo=resolve(__dirname,'../../..'),dir=resolve(repo,'docs/verification/assets/us-033');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const image=path=>{const im=nativeImage.createFromBuffer(readFileSync(path));assert.equal(im.isEmpty(),false,path);return {size:im.getSize(),bytes:im.toBitmap()};};
// Corresponding decoded native bitmap regions; no encoding/byte-order assumptions enter equality.
const region=(im,x,y,w,h)=>Buffer.concat(Array.from({length:h},(_,row)=>im.bytes.subarray(((y+row)*im.size.width+x)*4,((y+row)*im.size.width+x+w)*4)));
app.whenReady().then(()=>{
  const record=JSON.parse(readFileSync(resolve(dir,'capture-record.json')));
  assert.equal(record.captures.length,32);
  assert.deepEqual(readdirSync(dir).filter(p=>p.endsWith('.png')).sort(),record.captures.map(c=>c.name+'.png').sort());
  for(const c of record.captures){
    const path=resolve(dir,c.name+'.png');assert.equal(hash(readFileSync(path)),c.pngSha256,c.name);
    const im=image(path);assert.deepEqual(im.size,c.imageSize,c.name);assert.equal(im.bytes.length,im.size.width*im.size.height*4);
    assert.equal(c.overflow,false);assert.equal(c.canvases,1);
    if(c.name.includes('-text-'))assert.deepEqual(verifyTextImage(readFileSync(path),c),c.correspondence,`${c.name}: recorded image/layout correspondence`);
  }
  for(const [path,expected]of Object.entries(record.sourceSha256))assert.equal(hash(readFileSync(resolve(repo,path))),expected,path);
  assert.equal(hash(readFileSync(resolve(__dirname,'capture-us-033.cjs'))),record.toolingSha256);
  const frozen=['apps/desktop/src/office/assets','apps/desktop/src/office/officeLayout.ts','apps/desktop/src/office/mockAgents.ts','apps/desktop/src/office/agentLifecycleFrames.ts','apps/desktop/src/office/applyOfficeVisual.ts','apps/desktop/src/office/workstationPresentation.ts','apps/desktop/src/office/coffeeSteamPresentation.ts','apps/desktop/src/office/officePresentationRuntime.ts','apps/desktop/src/agentState','apps/desktop/src/Application.tsx','apps/desktop/src/main.tsx','apps/desktop/src/office/AgentPortrait.tsx','apps/desktop/src/office/AgentInspectionPanel.tsx','apps/desktop/src/office/SelectedAgentSummary.tsx','apps/desktop/src/office/ConnectionStatus.tsx','apps/desktop/electron','apps/desktop/shared','packages/contracts','docs/design','docs/architecture','planning','package.json','package-lock.json','apps/desktop/package.json','apps/desktop/electron.vite.config.ts','apps/desktop/verification/author-us-026-room.py','docs/verification/assets/us-032'];
  execFileSync('git',['diff','--exit-code',record.baseline,'--',...frozen],{cwd:repo});
  let comparisons=0;
  for(const state of ['idle','working','waiting','completed','error']){
    const now=image(resolve(dir,'lifecycle-'+state+'.png'));
    const before=image(resolve(repo,'docs/verification/assets/us-032/monitors-'+state+'.png'));
    assert.deepEqual(now.size,before.size);assert.deepEqual(now.size,{width:1280,height:720});
    for(const [x,y,w,h]of [[316,102,40,16],[384,168,40,16],[282,166,20,4],[350,232,20,4]]){
      assert.equal(Buffer.compare(region(now,x*2,y*2,w*2,h*2),region(before,x*2,y*2,w*2,h*2)),0,state+' protected region '+[x,y]);comparisons++;
    }
  }
  assert.equal(execFileSync('git',['diff','--cached','--name-only'],{cwd:repo,encoding:'utf8'}).trim(),'');
  execFileSync('git',['diff','--check'],{cwd:repo});
  console.log('PASS: 32 PNGs fully decoded/hash-matched; '+Object.keys(record.sourceSha256).length+' source hashes and capture harness match; '+comparisons+' corresponding protected monitor/foreground bitmap comparisons match US-032; frozen assets/boundaries unchanged; index empty; diff-check passes.');
  app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
