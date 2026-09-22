import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const repo=process.env.CB_REPO, apply=process.env.CB_APPLY==='--apply', root=process.env.CB_ROOT;
const issues=JSON.parse(readFileSync(join(root,'planning/ep-01-issues.json'),'utf8'));
const gh=(args)=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','inherit']}).trim();
const existing=apply?JSON.parse(gh(['issue','list','--repo',repo,'--state','all','--limit','500','--json','title,number'])):[];
const hasId=(id)=>existing.some(issue=>issue.title.startsWith(`${id} — `));
const labels=[['epic:foundation','Project foundation','1D76DB'],['priority:P0','Critical priority','B60205'],['type:user-story','User story','0E8A16']];
if(apply){for(const [name,description,color] of labels) gh(['label','create',name,'--repo',repo,'--description',description,'--color',color,'--force']);}
const epicTitle='EP-01 — Project Foundation';
const epicBody='Establish the local-first repository, desktop setup, design system, architecture, Codex workflow and CI.\n\nExit criteria: desktop launches locally, architecture and guidelines documented, PR checks pass.';
if(!existing.some(i=>i.title===epicTitle)){
 if(apply){const url=gh(['issue','create','--repo',repo,'--title',epicTitle,'--body',epicBody,'--label','epic:foundation']);console.log(`Created epic: ${url}`);}else console.log(`Would create: ${epicTitle}`);
}else console.log(`Skipping existing: ${epicTitle}`);
for(const issue of issues){
 const title=`${issue.id} — ${issue.title}`;
 if(hasId(issue.id)){console.log(`Skipping existing: ${title}`);continue;}
 const body=`## User Story\nAs a developer, I want ${issue.title.toLowerCase()} so that Coffee Break has a maintainable, verifiable development foundation.\n\n## Metadata\n- Epic: ${issue.epic}\n- Priority: ${issue.priority}\n- Size: ${issue.size}\n- Dependencies: ${issue.dependencies.join(', ')||'None'}\n\n## Acceptance Criteria\n${issue.acceptance_criteria.map((ac,i)=>`- [ ] AC-${String(i+1).padStart(2,'0')}: ${ac}`).join('\n')}\n\n## Definition of Done\n- [ ] Acceptance criteria verified\n- [ ] Relevant tests and checks pass\n- [ ] Reviewer findings resolved\n- [ ] PR approved and merged`;
 if(apply){const url=gh(['issue','create','--repo',repo,'--title',title,'--body',body,'--label','type:user-story','--label','priority:P0','--label','epic:foundation']);console.log(`Created: ${url}`);existing.push({title});}
 else console.log(`Would create: ${title}`);
}
