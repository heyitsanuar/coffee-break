import { canonical, demand, hash } from '../workflow/contracts.js';
import { content, CHECK_IDS, DESIGNER_LIMITS, encode, parseDecision, type AdmissionCheck, type DesignerAdmissionDecision, type JobInspection, type WorkflowBinding } from './contracts.js';
import { provenance } from './recipes.js';

export function denyAdmission(inspection: JobInspection, workflow: WorkflowBinding, requestId: string, evaluatedAt: string): DesignerAdmissionDecision {
  const evidence = [inspection.receipt.job];
  const check = (id: AdmissionCheck['id'], status: AdmissionCheck['status'], code: string): AdmissionCheck => ({ id, status, code, evidence: status === 'pass' && ['accepted-input', 'input-integrity'].includes(id) ? evidence : [] });
  const sameInput = canonical(workflow.acceptedInput) === canonical(inspection.receipt.workflow.acceptedInput);
  const checks: AdmissionCheck[] = [
    check('workflow', inspection.status === 'verified' && workflow.stage === 'designer_review' && workflow.status === 'ready' ? 'pass' : 'fail', inspection.status === 'verified' ? 'WORKFLOW_CHECKED' : 'PREPARATION_BINDING_STALE'),
    check('accepted-input', sameInput ? 'pass' : 'fail', sameInput ? 'ACCEPTED_INPUT_CHECKED' : 'ACCEPTED_INPUT_CHANGED'),
    check('input-integrity', 'pass', 'RETAINED_INPUT_VERIFIED'),
    check('input-freshness', 'unverified', 'INPUT_FRESHNESS_UNVERIFIED'),
    check('diagnostics', 'unverified', 'DIAGNOSTICS_MISSING'),
    check('cli-identity', 'unverified', 'CLI_IDENTITY_UNVERIFIED'),
    check('image-support', 'unverified', 'IMAGE_SUPPORT_UNVERIFIED'),
    check('filesystem-isolation', 'unverified', 'FILESYSTEM_ISOLATION_UNVERIFIED'),
    check('credential-isolation', 'unverified', 'CREDENTIAL_ISOLATION_UNVERIFIED'),
    check('network-isolation', 'unverified', 'NETWORK_ISOLATION_UNVERIFIED'),
    check('plugins-mcp', 'unverified', 'PLUGIN_MCP_ISOLATION_UNVERIFIED'),
    check('hooks', 'unverified', 'HOOK_RESTRICTIONS_UNVERIFIED'),
    check('delegation', 'unverified', 'DELEGATION_RESTRICTIONS_UNVERIFIED'),
    check('process-containment', 'unverified', 'PROCESS_CONTAINMENT_UNVERIFIED'),
    check('operator-invocation', 'pass', 'EXPLICIT_OPERATOR_COMMAND'),
    check('phase-a', 'unsupported', 'PHASE_A_EXECUTION_DISABLED'),
  ];
  demand(checks.length === CHECK_IDS.length);
  const preparationDigest = content(encode(inspection.receipt, DESIGNER_LIMITS.record)).digest;
  const requestDigest = hash({ kind: 'designer.admission', workflow, preparationId: inspection.receipt.requestId, preparationDigest, job: inspection.receipt.job }, DESIGNER_LIMITS.record);
  return parseDecision({ schemaVersion: 1, kind: 'designer-admission-decision', requestId, requestDigest, evaluatedAt, controller: provenance(), preparationId: inspection.receipt.requestId, preparationDigest, job: inspection.receipt.job, observedWorkflow: workflow, invocation: { origin: 'operator-command', command: 'designer.admission' }, checks, blockers: [...new Set(checks.filter(c => c.status !== 'pass').map(c => c.code))], phase: 'A', decision: 'deny', allowLaunch: false, authorization: 'none' });
}
