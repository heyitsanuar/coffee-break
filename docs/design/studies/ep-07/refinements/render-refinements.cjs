// Captures only the isolated static study page; does not launch the Coffee Break app.
const {app,BrowserWindow,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=__dirname,out=path.join(root,'renders');
app.setPath('userData',path.join(root,'.render-cache'));
app.commandLine.appendSwitch('force-device-scale-factor','1');
const views=[["r1-a","r1-a-compact-plaques-desktop.png",1100,760],["r1-b","r1-b-richer-selection-desktop.png",1100,760],["r1-c","r1-c-adaptive-labels-desktop.png",1100,760],["r1-board","r1-full-office-comparison.png",1100],["r1-closeups","r1-actual-size-label-details.png",1400],["r2-compare","r2-inspectors-320px-comparison.png",728],["r2-states","r2-inspector-content-states.png",1450],["r2-integrated","r2-grouped-inspector-desktop.png",1100,760],["r3-board","r3-environment-proportions-2x.png",1400],["r3-poses","r3-foot-seat-pose-alignment.png",1400],["r4-a","r4-a-reduced-sample-desktop.png",1100,760],["r4-b","r4-b-collapsed-sample-desktop.png",1100,760],["r4-open","r4-b-sample-disclosed-full-flow.png",1100],["integrated-overview","integrated-overview-1100x760.png",1100,760],["integrated-selected","integrated-selected-1100x760.png",1100,760],["integrated-compact","integrated-compact-760x540.png",760,540],["integrated-flow","integrated-compact-full-flow.png",760]];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
app.whenReady().then(async()=>{
 fs.mkdirSync(out,{recursive:true});const records=[];const original=JSON.parse(fs.readFileSync(path.join(root,'preservation-manifest.json')));for(const f of original.originalFiles)assert.equal(hash(fs.readFileSync(f.path)),f.sha256,'Original changed: '+f.path);
 const win=new BrowserWindow({width:1400,height:900,useContentSize:true,show:false,backgroundColor:'#08121c',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 for(const [view,file,width,height] of views){
  win.setContentSize(width,height||900);
  await win.loadFile(path.join(root,'study.html'),{query:{view}});
  const measurement=await win.webContents.executeJavaScript(`(async()=>{await window.studyReady;const b=document.body,e=document.documentElement;return {height:Math.ceil(Math.max(b.scrollHeight,e.scrollHeight)),width:Math.ceil(Math.max(b.scrollWidth,e.scrollWidth)),images:[...document.images].length,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),office:(()=>{const w=document.querySelector('.ref-world');return w?{width:w.getBoundingClientRect().width,height:w.getBoundingClientRect().height}:null})()}})()`);
  assert.deepEqual(measurement.broken,[],view+' image load');
  assert.ok(measurement.width<=width,view+' horizontal overflow '+measurement.width+' > '+width);
  const geometry=await win.webContents.executeJavaScript(`(()=>{const worlds=[...document.querySelectorAll('.ref-world')];return worlds.map(w=>{const b=w.getBoundingClientRect();const labels=[...w.querySelectorAll('.ref-plaque')].map(l=>{const r=l.getBoundingClientRect();return {agent:l.dataset.agent,x:r.left-b.left-1,y:r.top-b.top-1,w:r.width,h:r.height,text:l.innerText}});return {size:w.dataset.size,placement:w.dataset.placement,labels,faces:[...w.querySelectorAll('.inhabitant')].map(a=>JSON.parse(a.dataset.face)),protected:JSON.parse(w.dataset.protected)}})})()`);
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  for(const world of geometry)for(const label of world.labels){
   assert.ok(label.x>=6&&label.y>=6&&label.x+label.w<=634&&label.y+label.h<=354,view+' label outside safe viewport '+label.agent);
   for(const face of world.faces)assert.ok(!overlap(label,face),view+' label hides face '+label.agent);
   for(const protectedArea of world.protected)assert.ok(!overlap(label,protectedArea),view+' label hides '+protectedArea.name);
   for(const other of world.labels)if(other!==label)assert.ok(!overlap(label,other),view+' label collision');
  }
  const inspectorWidths=await win.webContents.executeJavaScript(`[...document.querySelectorAll('.ref-inspector')].map(i=>i.getBoundingClientRect().width)`);
  for(const w of inspectorWidths)assert.equal(w,view.includes('compact')||view==='integrated-flow'?642:320,view+' inspector width');
  const targetHeight=height||measurement.height;
  win.setContentSize(width,targetHeight);
  await new Promise(r=>setTimeout(r,160));
  const captured=await win.webContents.capturePage(),physical=captured.getSize();
  const png=captured.resize({width,height:targetHeight,quality:'best'}).toPNG(),actual=nativeImage.createFromBuffer(png).getSize();
  assert.equal(actual.width,width,view+' width');assert.equal(actual.height,targetHeight,view+' height');
  fs.writeFileSync(path.join(out,file),png);
  records.push({view,file,width:actual.width,height:actual.height,physicalCapture:physical,sha256:hash(png),measurement,geometry,inspectorWidths,clearanceChecks:"Known face and protected desk/counter/entry rectangles; manual image inspection complements this bounded check.",source:'Static EP-07 refinement page; illustrative fixtures; not a production Electron capture'});
  console.log(file,actual.width+'x'+actual.height,'images='+measurement.images);
 }
 fs.writeFileSync(path.join(root,'render-record.json'),JSON.stringify({status:'DESIGN STUDY ONLY',baselineHead:'a02f94bf5d65c6854bed58822530798536ef2275',records},null,2)+'\n');
 for(const f of original.originalFiles)assert.equal(hash(fs.readFileSync(f.path)),f.sha256,'Original changed: '+f.path);win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
