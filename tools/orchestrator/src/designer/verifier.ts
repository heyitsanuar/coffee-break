import { demand } from '../workflow/contracts.js';
import { WorkflowStore } from '../workflow/store.js';
import type { DesignerJobVerifier } from './contracts.js';

// This adapter exposes verification, not arbitrary workflow mutation or execution.
export function designerVerifier(store: WorkflowStore): DesignerJobVerifier {
  return {
    inspect: request => store.inspectDesigner(request.runId, request.preparationId),
    evaluateAdmission: async request => {
      const result = await store.designerAdmission(request.runId, request.expectedRevision, request.preparationId, request.requestId);
      demand(result.admission && result.exitCode === 3, result.storage.code); return result.admission;
    },
  };
}
