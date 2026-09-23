import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const repo=process.env.CB_REPO, apply=process.env.CB_APPLY==='--apply', root=process.env.CB_ROOT;
const issues=JSON.parse(readFileSync(join(root,'planning/ep-01-issues.json'),'utf8'));
const ep2=JSON.parse(readFileSync(join(root,'planning/ep-02-issues.json'),'utf8'));
const gh=(args)=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','inherit']}).trim();
const existing=apply?JSON.parse(gh(['issue','list','--repo',repo,'--state','all','--limit','500','--json','title,number,url'])):[];
const hasId=(id)=>existing.some(issue=>issue.title.startsWith(`${id} — `));
const findById=(id)=>existing.find(issue=>issue.title.startsWith(`${id} — `));
const labels=[['epic:foundation','Project foundation','1D76DB'],['epic:virtual-office','Virtual office foundation','1D76DB'],['priority:P0','Critical priority','B60205'],['type:user-story','User story','0E8A16']];
if(apply){for(const [name,description,color] of labels) gh(['label','create',name,'--repo',repo,'--description',description,'--color',color,'--force']);}
const remember=(title,url)=>existing.push({title,url,number:Number(url.split('/').at(-1))});
const issueLink=(id)=>{const issue=findById(id);return issue?`[${issue.title}](${issue.url})`:id;};
const checklist=(items,prefix)=>items.map((item,index)=>`- [ ] ${prefix}-${String(index+1).padStart(2,'0')}: ${item}`).join('\n');
const definitionOfDone='- [ ] Acceptance criteria verified\n- [ ] Relevant tests and checks pass\n- [ ] Reviewer findings resolved\n- [ ] PR approved and merged';
const epicTitle='EP-01 — Project Foundation';
const epicBody='Establish the local-first repository, desktop setup, design system, architecture, Codex workflow and CI.\n\nExit criteria: desktop launches locally, architecture and guidelines documented, PR checks pass.';
if(!existing.some(i=>i.title===epicTitle)){
 if(apply){const url=gh(['issue','create','--repo',repo,'--title',epicTitle,'--body',epicBody,'--label','epic:foundation']);remember(epicTitle,url);console.log(`Created epic: ${url}`);}else console.log(`Would create: ${epicTitle}`);
}else console.log(`Skipping existing: ${epicTitle}`);
for(const issue of issues){
 const title=`${issue.id} — ${issue.title}`;
 if(hasId(issue.id)){console.log(`Skipping existing: ${title}`);continue;}
 const body=`## User Story\nAs a developer, I want ${issue.title.toLowerCase()} so that Coffee Break has a maintainable, verifiable development foundation.\n\n## Metadata\n- Epic: ${issue.epic}\n- Priority: ${issue.priority}\n- Size: ${issue.size}\n- Dependencies: ${issue.dependencies.join(', ')||'None'}\n\n## Acceptance Criteria\n${issue.acceptance_criteria.map((ac,i)=>`- [ ] AC-${String(i+1).padStart(2,'0')}: ${ac}`).join('\n')}\n\n## Definition of Done\n- [ ] Acceptance criteria verified\n- [ ] Relevant tests and checks pass\n- [ ] Reviewer findings resolved\n- [ ] PR approved and merged`;
 if(apply){const url=gh(['issue','create','--repo',repo,'--title',title,'--body',body,'--label','type:user-story','--label','priority:P0','--label','epic:foundation']);console.log(`Created: ${url}`);remember(title,url);}
 else console.log(`Would create: ${title}`);
}

const ep2Title=`${ep2.epic.id} — ${ep2.epic.title}`;
const ep2Body=(storyLinks=[])=>`## Objective\n${ep2.epic.objective}\n\n## Approved Design\n${ep2.epic.design.map(item=>`- ${item}`).join('\n')}\n\n## Dependencies\n${ep2.epic.dependencies.map(id=>`- ${issueLink(id)}`).join('\n')}\n\n## Exit Criteria\n${checklist(ep2.epic.exit_criteria,'EC')}\n\n## Out of Scope\n${ep2.epic.out_of_scope.join(', ')}.\n\n## Stories\n${storyLinks.length?storyLinks.map(link=>`- ${link}`).join('\n'):'Story links are added after issue creation.'}`;
if(!findById(ep2.epic.id)){
 if(apply){const url=gh(['issue','create','--repo',repo,'--title',ep2Title,'--body',ep2Body(),'--label','epic:virtual-office']);remember(ep2Title,url);console.log(`Created epic: ${url}`);}else console.log(`Would create: ${ep2Title}`);
}else console.log(`Skipping existing: ${ep2Title}`);
for(const issue of ep2.stories){
 const title=`${issue.id} — ${issue.title}`;
 if(hasId(issue.id)){console.log(`Skipping existing: ${title}`);continue;}
 const dependencies=issue.dependencies.map(issueLink).join(', ')||'None';
 const body=`## User Story\n${issue.user_story}\n\n## Metadata\n- Epic: ${issueLink(issue.epic)}\n- Dependencies: ${dependencies}\n\n## Acceptance Criteria\n${checklist(issue.acceptance_criteria,'AC')}\n\n## Boundary\n${issue.boundary}\n\n## Definition of Done\n${definitionOfDone}`;
 if(apply){const url=gh(['issue','create','--repo',repo,'--title',title,'--body',body,'--label','type:user-story','--label','epic:virtual-office']);remember(title,url);console.log(`Created: ${url}`);}
 else console.log(`Would create: ${title}`);
}
if(apply){
 const epicIssue=findById(ep2.epic.id);
 const storyLinks=ep2.stories.map(story=>issueLink(story.id));
 gh(['issue','edit',String(epicIssue.number),'--repo',repo,'--body',ep2Body(storyLinks)]);
 console.log(`Updated epic links: ${epicIssue.url}`);
}
