// Read-only audit of the declared US-036 tree and original/derived evidence.
const { app, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { verifyImage } = require('./us-035-image.cjs');
const repo=resolve(__dirname,'../../..'),dir=resolve(repo,'docs/verification/assets/us-036');
const baseline='83d91ea64dd2259c6316f8c67b384d055cda0352',tree='fe0ee0e787176548e7e42ed2af899d08cc9f70da';
const hash=b=>createHash('sha256').update(b).digest('hex');
function digest(path,expected){assert.match(expected,/^[a-f0-9]{64}$/);assert.equal(hash(readFileSync(resolve(repo,path))),expected,path+' digest mismatch');}
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'});
function exact(actual,expected,label){assert.equal(new Set(actual).size,actual.length,label+' duplicate');assert.deepEqual([...actual].sort(),[...expected].sort(),label);}
function names(){
 const result=[];
 for(const w of [1100,760]){
  result.push(`${w}-production-100`,`${w}-production-unavailable-100`,`${w}-harbor-open`,`${w}-reload`);
  for(const p of ['retained','synchronizing','recovered'])result.push(`${w}-recovery-${p}-100`);
  for(const s of ['idle','working','waiting','completed','error'])result.push(`${w}-state-${s}`);
  for(const s of ['coffee','generic-waiting','idle'])result.push(`${w}-sol-${s}`);
  for(const p of ['retro','arcade','cyber','all-open'])result.push(`${w}-preview-${p}`);
  for(const a of ['exit','escape'])result.push(`${w}-return-${a}`);
  for(const s of ['working','coffee','completed','error'])result.push(`${w}-reduced-${s}`);
  for(const m of ['normal','expanded']){
   for(const f of ['current','last-known','no-state'])result.push(`${w}-${m}-freshness-${f}`);
   for(const t of [100,125,200])for(const k of ['room','inspection','keyboard-forward','keyboard-reverse'])result.push(`${w}-${m}-${t}-${k}`);
  }
 }
 for(const m of ['normal','expanded'])for(const t of [100,125,200])for(const r of ['desktop-to-compact','compact-to-desktop'])for(const b of ['before','after']){
  result.push(`${m}-${t}-resize-${r}-${b}`,`f1-baseline-${m}-${t}-resize-${r}-${b}`);
 }
 return result;
}
function clear(value){assert.ok(value.focus.bounds.y-value.toolbar.y-value.toolbar.height>=6,'Focus top under-clearance');assert.ok(value.viewport[1]-value.focus.bounds.y-value.focus.bounds.height>=6,'Focus bottom under-clearance');}
function validateCapture(c,diagnostic=false){
 assert.match(c.name,/^[a-zA-Z0-9-]+$/);assert.match(c.pngSha256,/^[a-f0-9]{64}$/);assert.ok(c.imageSize.width>0&&c.imageSize.height>0);
 assert.deepEqual([c.canvas.width,c.canvas.height],[640,360]);assert.equal(c.canvases,1);assert.equal(c.overflow,false);assert.equal(c.statusRegions,1);assert.equal(c.zoom,1);
 assert.deepEqual([c.imageSize.width,c.imageSize.height],c.viewport.map(x=>x*c.dpr));
 assert.ok(c.settlement.consecutiveStableFrames>=4&&c.settlement.attempt<=6);
 const b=c.focus.bounds;exact(Object.keys(c.borders),['toolbar','office','worlds','inspector'],'Image border inventory');
 assert.deepEqual(c.masks,c.focus.outline.includes('none')?[]:[{x:b.x-6,y:b.y-6,width:b.width+12,height:b.height+12}]);
 if(!diagnostic&&/-resize-.*-after$/.test(c.name))clear(c);
}
function validateFlows(flows){
 exact(flows.map(f=>`${f.mode}-${f.percent}`),['normal','expanded'].flatMap(m=>[100,125,200].map(t=>`${m}-${t}`)),'Compact flow cases');
 for(const f of flows){assert.equal(f.slices[0].scroll,0);assert.equal(f.slices.at(-1).scroll,f.documentHeight-f.viewportHeight);assert.equal(f.reachesBottom,true);
  for(let i=0;i<f.slices.length;i++){assert.equal(f.slices[i].name,`760-${f.mode}-${f.percent}-flow-${String(i+1).padStart(2,'0')}`);if(i){const a=f.slices[i-1],b=f.slices[i];assert.ok(b.scroll>a.scroll);assert.ok(b.scroll-a.scroll<=a.viewport[1]-a.toolbar.height-20,'Compact flow lacks usable overlap');}}
 }
}
function auditScope(actual,expected){exact(actual.tracked,expected.tracked,'Tracked scope');exact(actual.untracked,expected.untracked,'Untracked scope');assert.deepEqual(actual.staged,[],'Index not empty');}
async function run(){
 await app.whenReady();assert.equal(git('rev-parse','HEAD').trim(),baseline);assert.equal(git('rev-parse','HEAD^{tree}').trim(),tree);assert.equal(git('branch','--show-current').trim(),'feature/us-036-homepage-fidelity');
 const record=JSON.parse(readFileSync(resolve(dir,'capture-record.json'))),comparison=JSON.parse(readFileSync(resolve(dir,'comparison-record.json')));
 assert.equal(record.baseline,baseline);assert.equal(record.tree,tree);exact(Object.keys(record.ac),Array.from({length:20},(_,i)=>`AC-${String(i+1).padStart(2,'0')}`),'Acceptance criteria mapping');
 assert.equal(record.nativeObservations.voiceOver,'unverified');assert.equal(record.nativeObservations.nativeReducedMotion,'unverified');
 for(const [key,entry] of Object.entries(record.ac)){assert.ok(entry.evidence.length>0,key+' missing evidence');assert.equal(entry.status,key==='AC-19'?'PENDING REVIEW':'DEVELOPER VERIFIED');}
 assert.deepEqual(record.review,{designer:'PENDING',technical:'PENDING',productOwnerImplementation:'PENDING',finalization:'NOT AUTHORIZED'});
 const captures=record.captures;validateFlows(record.observations.fixture.flow);assert.equal(record.observations.fixture.inspection.length,12);for(const f of record.observations.fixture.inspection)assert.equal(f.reachesBottom,true);
 const expectedNames=[...names(),...record.observations.fixture.flow.flatMap(f=>f.slices.map(s=>s.name)),...record.observations.fixture.inspection.flatMap(f=>f.slices.slice(1)), 'diagnostic-trusted-reflow-1100-expanded-100'];exact(captures.map(c=>c.name),expectedNames,'Capture names');
 exact(comparison.boards.map(b=>b.name),['desktop','compact','compact-flow','expanded','retained','keyboard','environment'].map(n=>'comparison-'+n),'Comparison boards');
 const files=[...expectedNames.map(n=>n+'.png'),...comparison.boards.map(b=>b.name+'.png'),'capture-record.json','comparison-record.json','f1-baseline-record.json','fixture-record.json','simulator-record.json','unavailable-record.json','recovery-record.json','reflow-failure-record.json','motion-record.json'];exact(readdirSync(dir),files,'Evidence directory');
 const expected={tracked:['apps/desktop/src/office/OfficeSceneHost.tsx','apps/desktop/src/office/OfficeSceneHost.test.ts','docs/verification/us-035-world-previews-expansion.md'],untracked:['apps/desktop/verification/capture-us-036.cjs','apps/desktop/verification/verify-us-036.cjs','apps/desktop/verification/create-us-036-comparisons.py','apps/desktop/verification/observe-us-036-motion.cjs','docs/verification/us-036-homepage-fidelity.md',...files.map(f=>'docs/verification/assets/us-036/'+f)]};
 const paths=(...args)=>git(...args).split('\0').filter(Boolean);auditScope({tracked:paths('diff','--name-only','-z',baseline),untracked:paths('ls-files','--others','--exclude-standard','-z'),staged:paths('diff','--cached','--name-only','-z')},expected);
 for(const c of captures){validateCapture(c,c.name.startsWith('f1-baseline-'));const bytes=readFileSync(resolve(dir,c.name+'.png'));digest('docs/verification/assets/us-036/'+c.name+'.png',c.pngSha256);const im=nativeImage.createFromBuffer(bytes);assert.equal(im.isEmpty(),false);assert.deepEqual(im.getSize(),c.imageSize);assert.deepEqual(verifyImage(bytes,c),c.correspondence);}
 for(const s of ['fixture','simulator','unavailable','recovery']){
  const r=JSON.parse(readFileSync(resolve(dir,s+'-record.json')));assert.deepEqual(r.observations.rendererErrors,[]);assert.equal(r.baseline,baseline);assert.equal(r.tree,tree);assert.equal(hash(Buffer.from(r.captureToolSource)),r.toolingSha256,'Executed collector revision');assert.equal(r.nativeObservations.voiceOver,'unverified');assert.equal(r.nativeObservations.nativeReducedMotion,'unverified');
  const expectedSources=git('ls-files','apps/desktop/src','apps/desktop/electron','apps/desktop/shared','packages/contracts','docs/design/references','docs/verification/assets/us-031','docs/verification/assets/us-032','docs/verification/assets/us-033','docs/verification/assets/us-034','docs/verification/assets/us-035','package.json','package-lock.json').trim().split('\n');exact(Object.keys(r.sourceSha256),expectedSources,'Source provenance inventory');for(const [p,h] of Object.entries(r.sourceSha256))digest(p,h);
 }
 const old=JSON.parse(readFileSync(resolve(dir,'f1-baseline-record.json')));assert.equal(hash(Buffer.from(old.captureToolSource)),old.toolingSha256);assert.ok(old.observations.resize.some(x=>x.clearance<6||x.bottomClearance<6),'Baseline defect missing');
 const failed=JSON.parse(readFileSync(resolve(dir,'reflow-failure-record.json')));assert.equal(hash(Buffer.from(failed.captureToolSource)),failed.toolingSha256);assert.equal(hash(Buffer.from(failed.productionSource)),failed.sourceSha256['apps/desktop/src/office/OfficeSceneHost.tsx']);assert.equal(failed.captures.length,1);assert.ok(failed.captures[0].focus.bounds.y>failed.captures[0].viewport[1]);
 const f=record.observations.fixture;assert.equal(f.resize.length,12);for(const r of f.resize){clear(r.after);assert.equal(r.sameNode,true);assert.equal(r.noNewFocus,true);}
 assert.equal(f.reflow.length,12);for(const r of f.reflow.filter(x=>x.mode==='normal'))for(const v of r.variants.filter(x=>x.activity)){assert.equal(v.after.canvas.y+v.after.scroll[1],r.before.canvas.y+r.before.scroll[1],'Inspector height displaced office');}for(const r of f.reflow)for(const v of r.variants){clear(v.after);assert.equal(v.after.focusEvents,0);assert.equal(v.after.selected,r.before.selected);}
 assert.equal(f.keyboard.length,12);for(const k of f.keyboard){exact(k.forward.map(x=>x.focused),k.reverse.map(x=>x.focused),'Forward/reverse focus');for(const x of [...k.forward,...k.reverse])if(x.belowToolbar)clear(x);}
 assert.equal(f.continuity.length,2);for(const c of f.continuity){assert.equal(c.cycles,10);assert.equal(c.sameObjects,true);assert.equal(c.noAcknowledgementReplay,true);assert.equal(c.noAnimationReplay,true);assert.equal(c.positiveAcknowledgement,1);assert.equal(c.resizeListeners,1);assert.equal(c.escapeListeners,0);assert.deepEqual(c.subscriptions,{store:1,runtime:2,acknowledgements:1,watch:1});}
 assert.equal(f.motion.length,8);for(const m of f.motion){assert.equal(m.staticObjects,true);assert.equal(m.reactionsSuppressed,true);assert.ok(m.durationMs>=1700);}
 assert.ok(f.persistentControls.length>=36);for(const c of f.persistentControls){clear(c.compact);clear(c.desktop);assert.equal(c.compact.focusEvents,c.before.focusEvents);assert.equal(c.desktop.focusEvents,c.before.focusEvents);assert.equal(c.sameNode,true);}
 assert.deepEqual(f.breakpoints,[1040,1039,900,1039,1040]);
 for(const b of comparison.boards){assert.equal(hash(readFileSync(resolve(dir,b.name+'.png'))),b.sha256);for(const s of b.sources)assert.equal(hash(readFileSync(resolve(repo,s.path))),s.sha256);}
 const motion=JSON.parse(readFileSync(resolve(dir,'motion-record.json')));digest('apps/desktop/verification/observe-us-036-motion.cjs',motion.toolingSha256);assert.equal(motion.episodes.length,2);for(const e of motion.episodes){assert.ok(Object.values(e.changes).every(Boolean));for(const key of ['monitor','steam'])assert.notDeepEqual(e.firstChanged[key].sample[key],e.before[key]);for(const [key,id]of [['character','mock-agent-mina'],['coffeeCharacter','mock-agent-sol']])assert.notDeepEqual(e.firstChanged[key].sample.frames.find(x=>x[0]===id),e.before.frames.find(x=>x[0]===id));}for(const [p,h]of Object.entries(motion.sourceSha256))digest(p,h);
 let negatives=0;const rejects=fn=>{assert.throws(fn);negatives++;};
 rejects(()=>auditScope({...expected,staged:['README.md']},expected));rejects(()=>auditScope({...expected,staged:[],tracked:[...expected.tracked,'README.md']},expected));rejects(()=>auditScope({...expected,staged:[],untracked:expected.untracked.slice(1)},expected));
 rejects(()=>validateCapture({...captures[0],name:'../escape'}));rejects(()=>validateCapture({...captures[0],pngSha256:'bad'}));rejects(()=>validateCapture({...captures[0],imageSize:{width:1,height:1}}));rejects(()=>validateCapture({...captures[0],canvas:{...captures[0].canvas,width:639}}));
 rejects(()=>clear({...captures[0],focus:{bounds:{y:0,height:44}}}));rejects(()=>validateFlows(f.flow.slice(1)));rejects(()=>exact(['AC-01'],Object.keys(record.ac),'AC coverage'));
 const bad=structuredClone(captures.find(c=>!c.name.startsWith('f1-baseline-')&&c.borders.office.visible));bad.borders.office.bounds.y+=30;rejects(()=>verifyImage(readFileSync(resolve(dir,bad.name+'.png')),bad));
 rejects(()=>digest('docs/verification/assets/us-036/'+captures[0].name+'.png','0'.repeat(64)));rejects(()=>digest(comparison.boards[0].sources[0].path,'0'.repeat(64)));rejects(()=>exact([],Object.keys(record.sourceSha256),'Missing source provenance'));
 execFileSync(process.env.COFFEE_BREAK_EVIDENCE_PYTHON || 'python3',['-B',resolve(__dirname,'create-us-036-comparisons.py'),'--check'],{cwd:repo,stdio:'inherit'});
 console.log(`PASS US-036: ${captures.length} original PNGs, 7 boards, strict scope/provenance/geometry, ${negatives} negative checks`);
}
if(resolve(process.argv[1]??'')===__filename)run().then(()=>app.quit()).catch(e=>{console.error(e);app.exit(1)});
module.exports={validateCapture,validateFlows,clear,auditScope};
