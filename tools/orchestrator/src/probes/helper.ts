// Trusted, fixed program. No prompt, shell, arbitrary command or real secret path.
export const HELPER = String.raw`
const fs = require('node:fs');
const crypto = require('node:crypto');
const net = require('node:net');
const {spawnSync} = require('node:child_process');
const f = JSON.parse(process.argv[1]);
const mode = process.argv[2];
function attempt(fn) { try { fn(); return 'allowed'; } catch(e) { return ['EPERM','EACCES'].includes(e.code) ? 'denied' : 'ambiguous'; } }
async function network() {
  return new Promise(resolve => {
    if (!f.port) { resolve('ambiguous'); return; }
    const socket = net.connect({host:'127.0.0.1',port:f.port});
    socket.setTimeout(1500);
    socket.once('connect',()=>{socket.destroy();resolve('allowed');});
    socket.once('error',e=>{socket.destroy();resolve(['EPERM','EACCES'].includes(e.code)?'denied':'ambiguous');});
    socket.once('timeout',()=>{socket.destroy();resolve('ambiguous');});
  });
}
(async()=>{
  if(mode==='guard') {
    console.log(JSON.stringify({guardRead:attempt(()=>fs.readFileSync(f.guardFile)),guardWrite:attempt(()=>fs.writeFileSync(f.guardFile,'forbidden'))}));return;
  }
  if(mode==='network-control') {console.log(JSON.stringify({network:await network()}));return;}
  if(mode==='child') {console.log(JSON.stringify({childWrite:attempt(()=>fs.writeFileSync(f.protectedFile,'forbidden')),childCredential:attempt(()=>fs.readFileSync(f.credential))}));return;}
  const r = {};
  try {r.allowedRead = crypto.createHash('sha256').update(fs.readFileSync(f.input)).digest('hex')===f.inputHash?'allowed':'ambiguous';}catch{r.allowedRead='ambiguous';}
  r.create = attempt(()=>fs.writeFileSync(f.workspace+'/new-file','forbidden',{flag:'wx'}));
  r.modify = attempt(()=>fs.writeFileSync(f.protectedFile,'forbidden'));
  r.rename = attempt(()=>fs.renameSync(f.protectedFile,f.workspace+'/renamed'));
  r.delete = attempt(()=>fs.unlinkSync(f.protectedFile));
  r.credential = attempt(()=>fs.readFileSync(f.credential));
  r.controller = attempt(()=>fs.readFileSync(f.controller));
  r.symlink = attempt(()=>fs.readFileSync(f.escape));
  r.gitWrite = attempt(()=>fs.writeFileSync(f.gitFile,'forbidden'));
  const child = spawnSync(process.execPath,['-e',${JSON.stringify(String.raw`const fs=require('node:fs');const f=JSON.parse(process.argv[1]);const attempt=fn=>{try{fn();return 'allowed'}catch(e){return ['EPERM','EACCES'].includes(e.code)?'denied':'ambiguous'}};console.log(JSON.stringify({childWrite:attempt(()=>fs.writeFileSync(f.protectedFile,'forbidden')),childCredential:attempt(()=>fs.readFileSync(f.credential))}));`)},JSON.stringify(f)],{shell:false,env:{PATH:process.env.PATH},timeout:3000,maxBuffer:4096,encoding:'utf8'});
  if(child.status===0 && !child.error) {try {Object.assign(r,JSON.parse(child.stdout));}catch{r.childWrite='ambiguous';r.childCredential='ambiguous';}}else {r.childWrite='ambiguous';r.childCredential='ambiguous';}
  r.network = await network();
  console.log(JSON.stringify(r));
})().catch(()=>{process.exitCode=1});
`;
