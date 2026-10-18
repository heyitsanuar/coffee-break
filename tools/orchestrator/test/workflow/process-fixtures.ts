import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import type { Operation } from '../../src/workflow/store.js';

// Compile current source only into owned scratch storage. Tests never consume
// ignored dist/ and do not need a pre-test build or a newly installed loader.
export async function compileRuntime(root: string): Promise<string> {
  const output = join(root, 'runtime'); await mkdir(output, { mode: 0o700 });
  await writeFile(join(output, 'package.json'), '{"type":"module"}', { mode: 0o600 });
  const source = fileURLToPath(new URL('../../src/', import.meta.url));
  const modules = ['policy.ts'];
  for (const directory of ['workflow', 'inputs', 'reports']) modules.push(...(await readdir(join(source, directory))).filter(name => name.endsWith('.ts')).map(name => directory + '/' + name));
  for (const path of modules) {
    await mkdir(join(output, path, '..'), { recursive: true, mode: 0o700 });
    const compiled = ts.transpileModule(await readFile(join(source, path), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
    await writeFile(join(output, path.replace(/\.ts$/, '.js')), compiled.outputText, { mode: 0o600 });
  }
  return pathToFileURL(output + '/').href;
}
export interface WorkerMessage { ok?: boolean; token?: string; code?: string; phase?: string; report?: Operation; processLaunchAttempts?: number }
export function worker(root: string, runtime: string, mode: 'hold' | 'attempt' | 'reconcile' | 'store-hold' | 'store-pause' | 'recover-cold' | 'artifact-hold', token = ''): { child: ChildProcess; next(): Promise<WorkerMessage>; stop(): Promise<void> } {
  const program = `
    const [root,runtime,mode,token]=process.argv.slice(1);
    let processLaunchAttempts=0;
    if(mode==='recover-cold') {
      const cp=(await import('node:child_process')).default;
      const deny=()=>{processLaunchAttempts++;throw new Error('Unexpected recovery subprocess')};
      cp.execFile=deny;cp.spawn=deny;
      (await import('node:module')).syncBuiltinESMExports();
    }
    const {StoragePaths}=await import(runtime+'workflow/paths.js');
    const {acquire,reconcileLock}=await import(runtime+'workflow/lock.js');
    const {hostname}=await import('node:os');
    const environment={identity:async()=>({pid:process.pid,uid:process.getuid(),host:hostname(),bootId:'controlled-process-fixture',processStartedAt:new Date(performance.timeOrigin).toISOString()}),now:()=>new Date().toISOString(),exists:pid=>{try{process.kill(pid,0);return 'present'}catch(e){return e.code==='ESRCH'?'absent':'unknown'}}};
    const dir=await new StoragePaths(root).open('11111111-1111-4111-8111-111111111111');
    if(mode==='recover-cold') {
      const {WorkflowStore}=await import(runtime+'workflow/store.js');
      const report=await new WorkflowStore(root).recover('11111111-1111-4111-8111-111111111111',1);
      process.send({report,processLaunchAttempts});process.disconnect();
    }else if(mode==='artifact-hold') {
      const {WorkflowStore}=await import(runtime+'workflow/store.js');
      const prepared=await new Promise(resolve=>{process.once('message',resolve);process.send({phase:'input-ready'})});
      prepared.blobs=new Map(prepared.blobs.map(([id,data])=>[id,Buffer.from(data,'base64')]));
      const fault=async point=>{if(point==='beforePublish')await new Promise(resolve=>{process.once('message',resolve);process.send({phase:'artifact-written'})})};
      const report=await new WorkflowStore(root,{lockEnvironment:environment,artifactFault:fault}).publishInputs('11111111-1111-4111-8111-111111111111',1,prepared);
      process.send({report});process.disconnect();
    }else if(mode==='store-hold'||mode==='store-pause') {
      const {WorkflowStore}=await import(runtime+'workflow/store.js');
      const {randomUUID}=await import('node:crypto');
      const fault=async point=>{if(mode==='store-hold'&&point==='beforeJournalSync'){await new Promise(resolve=>{process.once('message',resolve);process.send({phase:'journal-written'})})}};
      const store=new WorkflowStore(root,{lockEnvironment:environment,fault});
      const report=await store.apply('11111111-1111-4111-8111-111111111111',{schemaVersion:1,eventId:randomUUID(),runId:'11111111-1111-4111-8111-111111111111',expectedRevision:1,at:new Date().toISOString(),type:'run.paused',payload:{}});
      process.send({report});process.disconnect();
    }else if(mode==='reconcile') {
      process.once('message',async()=>{try{await reconcileLock(dir,token,environment);process.send({ok:true})}catch(e){process.send({ok:false,code:e.code})}finally{process.disconnect()}});
      process.send({phase:'ready'});
    }else{
      try{const lease=await acquire(dir,environment);
        process.once('message',async()=>{await lease.release();process.disconnect()});
        process.send({ok:true,token:lease.owner.token});
      }catch(e){process.send({ok:false,code:e.code});process.disconnect()}
    }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', program, root, runtime, mode, token], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let diagnostic = ''; child.stderr!.on('data', (chunk: Buffer) => { diagnostic = (diagnostic + chunk.toString()).slice(0, 2048); });
  return { child, next: () => new Promise((resolve, reject) => {
    const message = (value: WorkerMessage): void => { cleanup(); resolve(value); };
    const exit = (): void => { cleanup(); reject(new Error('Fixture exited before barrier: ' + diagnostic)); };
    const cleanup = (): void => { child.off('message', message); child.off('exit', exit); };
    child.once('message', message); child.once('exit', exit);
  }), stop: async () => { if (child.exitCode === null && child.signalCode === null) { const done = once(child, 'exit'); child.kill('SIGKILL'); await done; } } };
}
