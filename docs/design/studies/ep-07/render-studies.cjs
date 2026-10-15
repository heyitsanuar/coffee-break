// Captures only the isolated static study page; does not launch the Coffee Break app.
const {app,BrowserWindow,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=__dirname,out=path.join(root,'renders');
app.setPath('userData',path.join(root,'.render-cache'));
app.commandLine.appendSwitch('force-device-scale-factor','1');
const views=[['01','01-desktop-overview.png',1100,760],['02','02-desktop-ari-model-usage.png',1100,760],['03','03-label-selection-comparison.png',1400],['04','04-sprite-cell-comparison.png',1400],['05','05-fixed-hybrid-comparison.png',1450],['06a','06a-compact-760x540.png',760,540],['06c','06c-compact-full-flow.png',760],['06b','06b-expanded-1100x760.png',1100,760],['06r','06r-retained-selected-desktop.png',1100,760],['07','07-controls-state-sheet.png',1400],['08','08-bounded-movement-storyboard.png',1400]];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
app.whenReady().then(async()=>{
 fs.mkdirSync(out,{recursive:true});const records=[];
 const win=new BrowserWindow({width:1400,height:900,useContentSize:true,show:false,backgroundColor:'#08121c',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 for(const [view,file,width,height] of views){
  win.setContentSize(width,height||900);
  await win.loadFile(path.join(root,'study.html'),{query:{view}});
  const measurement=await win.webContents.executeJavaScript(`(async()=>{await window.studyReady;const b=document.body,e=document.documentElement;return {height:Math.ceil(Math.max(b.scrollHeight,e.scrollHeight)),width:Math.ceil(Math.max(b.scrollWidth,e.scrollWidth)),images:[...document.images].length,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),office:(()=>{const w=document.querySelector('.world');return w?{width:w.getBoundingClientRect().width,height:w.getBoundingClientRect().height}:null})()}})()`);
  assert.deepEqual(measurement.broken,[],view+' image load');
  assert.ok(measurement.width<=width,view+' horizontal overflow '+measurement.width+' > '+width);
  const targetHeight=height||measurement.height;
  win.setContentSize(width,targetHeight);
  await new Promise(r=>setTimeout(r,160));
  const captured=await win.webContents.capturePage(),physical=captured.getSize();
  const png=captured.resize({width,height:targetHeight,quality:'best'}).toPNG(),actual=nativeImage.createFromBuffer(png).getSize();
  assert.equal(actual.width,width,view+' width');assert.equal(actual.height,targetHeight,view+' height');
  fs.writeFileSync(path.join(out,file),png);
  records.push({view,file,width:actual.width,height:actual.height,physicalCapture:physical,sha256:hash(png),measurement,source:'Static EP-07 concept page; illustrative fixtures; not a production Electron capture'});
  console.log(file,actual.width+'x'+actual.height,'images='+measurement.images);
 }
 fs.writeFileSync(path.join(root,'render-record.json'),JSON.stringify({status:'DESIGN STUDY ONLY',baselineHead:'a02f94bf5d65c6854bed58822530798536ef2275',records},null,2)+'\n');
 win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
