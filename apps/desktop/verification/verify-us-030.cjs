// Reproducible evidence integrity/scope audit; no captures or files are rewritten.
const { app, nativeImage } = require('electron');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const repo=resolve(__dirname,'../../..'), dir=resolve(repo,'docs/verification/assets/us-030');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
app.whenReady().then(()=>{
  const record=JSON.parse(readFileSync(`${dir}/capture-record.json`));
  const comparisons=JSON.parse(readFileSync(`${dir}/comparison-record.json`));
  for(const [path,expected] of Object.entries(record.productionSourceSha256))assert.equal(hash(readFileSync(resolve(repo,path))),expected,path);
  assert.equal(hash(Buffer.from(JSON.stringify(Object.entries(record.productionSourceSha256).sort()))),record.productionTreeSha256);
  for(const [path,expected] of Object.entries(record.sourceSha256))assert.equal(hash(readFileSync(resolve(__dirname,'..',path))),expected,path);
  const items=[...record.captures,...comparisons.boards];
  assert.equal(items.length,18);assert.equal(new Set(items.map(i=>i.name)).size,18);
  for(const item of items){
    const bytes=readFileSync(`${dir}/${item.name}.png`);assert.equal(hash(bytes),item.pngSha256,item.name);
    const image=nativeImage.createFromBuffer(bytes);assert.equal(image.isEmpty(),false,item.name);
    assert.deepEqual(image.getSize(),item.size??item.outputSize,item.name);
    assert.ok(image.toBitmap().length>0,item.name);
    for(const source of item.sources??[])assert.equal(hash(readFileSync(resolve(repo,source.path))),source.sha256,source.path);
  }
  assert.deepEqual(readdirSync(dir).filter(p=>p.endsWith('.png')).sort(),items.map(i=>i.name+'.png').sort());
  assert.equal(record.observations.temporal.length,23);
  execFileSync('git',['diff','--exit-code',record.baseline,'--','apps/desktop/src','apps/desktop/electron','apps/desktop/shared','packages/contracts','package.json','package-lock.json','docs/design','docs/architecture'],{cwd:repo});
  const inventoryPath=resolve(dir,'source-and-evidence-inventory.json');
  if(existsSync(inventoryPath)) {
    const inventory=JSON.parse(readFileSync(inventoryPath));
    for(const [path,expected] of Object.entries(inventory.files))assert.equal(hash(readFileSync(resolve(repo,path))),expected,path);
    assert.equal(hash(Buffer.from(JSON.stringify(Object.entries(inventory.files).sort()))),inventory.packageTreeSha256);
    assert.equal(Object.keys(inventory.files).length,26);
  }
  console.log('PASS: 18 PNGs decoded/hash-matched; reference hashes, source fingerprint, capture-harness hashes and production/design/architecture freeze verified.');
  app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
