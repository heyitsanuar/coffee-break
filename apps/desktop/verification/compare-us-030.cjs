// DERIVED comparison material only. References and direct PNGs remain unchanged.
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const repo=resolve(__dirname,'../../..'), output=resolve(repo,'docs/verification/assets/us-030');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const data=path=>`data:image/png;base64,${readFileSync(resolve(repo,path)).toString('base64')}`;
app.whenReady().then(async()=>{
  const runtime='docs/verification/assets/us-030/01-desktop-final.png';
  const record=JSON.parse(readFileSync(`${output}/capture-record.json`));
  const capture=record.captures.find(c=>c.name==='01-desktop-final');
  assert.equal(hash(readFileSync(resolve(repo,runtime))),capture.pngSha256);
  const original='docs/design/references/north-star/coffee-break-north-star-01.png';
  const corrected='docs/design/references/us-026/corrected-clean-office.png';
  const sources=paths=>paths.map(path=>({path,sha256:hash(readFileSync(resolve(repo,path)))}));
  const win=new BrowserWindow({width:1340,height:650,useContentSize:true,show:false,webPreferences:{offscreen:true,contextIsolation:true,sandbox:true,nodeIntegration:false}});
  const style='<style>body{margin:0;padding:24px;background:#0c1820;color:#f2e9db;font:15px Arial}h1{font-size:23px;margin:0 0 12px}h2{font-size:17px}p{line-height:1.4;max-width:1250px}section{display:flex;gap:12px}figure{margin:0;width:640px}img{display:block;image-rendering:pixelated}.crop{position:relative;overflow:hidden;width:640px;height:360px}.crop img{position:absolute;width:1100px;height:732px}</style>';
  const boards=[];
  async function board(name,height,html,provenance){
    win.setContentSize(1340,height);await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(style));
    await win.webContents.executeJavaScript('document.body.innerHTML='+JSON.stringify(html));
    await win.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode()))');
    const image=await win.webContents.capturePage(),png=image.toPNG();writeFileSync(`${output}/${name}.png`,png);
    boards.push({name,classification:'DERIVED COMPARISON MATERIAL',sourceCommit:record.baseline,tool:'apps/desktop/verification/compare-us-030.cjs',toolSha256:hash(readFileSync(__filename)),outputSize:image.getSize(),pngSha256:hash(png),...provenance});
  }
  try {
    await board('board-1-original-vs-product',710,
      `<h1>DERIVED COMPARISON MATERIAL</h1><p>Original Product Owner North Star → completed EP-05 translation</p><section><figure><h2>Original North Star · full reference</h2><img width="640" src="${data(original)}"></figure><figure><h2>Completed EP-05 · direct desktop capture</h2><img width="640" src="${data(runtime)}"></figure></section><p>Equal displayed width 640px; aspect ratios preserved. No crop or color correction. Nearest-neighbor display scaling; the original has no assumed production pixel grid.</p><p>APPROVED TRANSLATIONS: one office, three agents, restrained shell. EXCLUDED FUNCTIONALITY: telemetry, unsupported controls, extra rooms/agents. These are not missing fidelity.</p>`,
      {sources:sources([original,runtime]),crops:null,displayedWidth:640,scaling:'Nearest-neighbor CSS display, aspect ratio preserved; original 1536×1024 → 640×426.667; runtime 2200×1464 → 640×425.891. Board capture DPR measured separately.'});
    assert.deepEqual(capture.viewport,[1100,732]);assert.equal(capture.dpr,2);
    assert.equal(capture.room.width,640);assert.equal(capture.room.height,360);
    const crop={x:capture.room.x,y:capture.room.y,width:640,height:360};
    await board('board-2-corrected-vs-product',590,
      `<h1>DERIVED COMPARISON MATERIAL</h1><p>Approved clean environment study → production pixel authorship and approved later character/UI evolution</p><section><figure><h2>Approved corrected composition · 640×360</h2><img width="640" height="360" src="${data(corrected)}"></figure><figure><h2>Same final desktop capture · office crop 640×360</h2><div class="crop"><img src="${data(runtime)}" style="left:-${crop.x}px;top:-${crop.y}px"></div></figure></section><p>Runtime crop: CSS (${crop.x},${crop.y},640,360), decoded PNG (${crop.x*2},${crop.y*2},1280,720) at DPR2 → displayed 640×360. Nearest-neighbor, no stretching/smoothing/color correction.</p><p>Compare perspective, visible floor, zoning, furniture, palette, coordinated simple props, and small inhabitants. The left is a design study; the right derives from an unedited renderer PNG.</p>`,
      {sources:sources([corrected,runtime]),crops:{runtimeCss:crop,runtimeDecoded:{x:crop.x*2,y:crop.y*2,width:1280,height:720},reference:null},displayedDimensions:[640,360],scaling:'Corrected reference unchanged at 640×360; DPR2 runtime crop reduced exactly 2:1 with nearest-neighbor CSS rendering.'});
    const dpr=await win.webContents.executeJavaScript('devicePixelRatio');for(const b of boards)b.boardDpr=dpr;
    writeFileSync(`${output}/comparison-record.json`,JSON.stringify({baseline:record.baseline,generatedAt:new Date().toISOString(),boards},null,2)+'\n');
    console.log('PASS 2 labeled derived comparison boards; reference/runtime hashes verified');
  } finally {win.destroy();app.quit();}
}).catch(error=>{console.error(error.code??error.name,String(error.message).slice(0,160));app.exit(1);});
