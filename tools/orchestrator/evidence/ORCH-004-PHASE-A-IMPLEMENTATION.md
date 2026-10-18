# ORCH-004 Phase A — implementation evidence

Status: implemented locally, pending independent review, Planner evaluation and
PO acceptance. ORCH-004 is not complete. No commit, push or PR is authorized.

## Baseline and approved boundary

- Branch: `codex/orch-004-phase-a-preparation`.
- Baseline/HEAD: `9c4d18c1a92b526a8f948da86cb029b5471bce8f`.
- Remote main and issue #103 OPEN verified read-only before implementation.
- Original ORCH-003 checkout was clean and source-tree equivalent to the baseline.
- Fetched integrated main and created the expressly authorized working branch.
- No application, design-reference, dependency, journal-v1, workflow-event,
  reducer, report-validation, ORCH-001-policy or native-probe changes.

## Implemented behavior and Planner conditions

A. The production recipe catalog is empty. The only recipe is constructed inside
controlled test fixtures and injected through a trusted in-process test harness.
There is no CLI/environment route for installing a recipe. The existing
`PILOT_INPUTS_REQUIRED` implementation is unchanged, including rejection before
recipe resolution and independent rejection in preparation. No production input,
US-037 exception, approval or handoff was fabricated.

B. The synthetic catalog explicitly enumerates compact and desktop PNG paths,
digests and logical destinations. Original bytes and existing reference-manifest
verification are reused. Missing, changed, unsupported and unsafe requirements
fail; extra available images do not silently expand the attachment list. PNG
header/dimension checks establish neither full decoding nor vision capability.

C. Portable job identity includes bundle, projection, recipe, template, prompt,
schema and policy identities. Separate receipts bind run/revision/journal/input.
Cross-run copies, changed journal heads at the same revision, stale revisions,
changed accepted inputs and conflicting request reuse are rejected or classified
historical/stale. Same request/content/binding is idempotent and preserves the
original receipt. Admission is separate, revalidates retained closure/current
binding, and always denies without advancing workflow.

## Contracts and trust boundaries

Strict versioned contracts reject unknown fields, invalid identities, noncanonical
saved preparation bytes, order/duplicate errors and enabled execution descriptors.
Native prerequisite check statuses cannot be forged as passes in Phase A's saved
decision contract. Admission has no successful variant. All decision paths retain
`decision=deny`, `allowLaunch=false`, `authorization=none` and the Phase A blocker.
No imported report, environment setting or help metadata becomes enforcement.

A fixed trusted template renders a canonical data index, not executable issue or
import text. Original source/import bytes remain separate retained blobs. Logical
projection creates no execution mount. Full freshness stays unverified; working
files are explicitly not checked. The current CLI binary is not re-probed or
admitted. Its observed mismatch with the unchanged ORCH-001 pin remains unresolved.

## Storage, crash and quota evidence

Uses existing writer lease, private file checks, intent barriers and immutable
publication. Dependencies precede projection/job, then closure/binding are checked,
then the preparation receipt is published last and verified before acknowledgement.
Denied admission is a separate immutable artifact. No progress events are added.

Fault tests cover before/after writes, before publication, rename before directory
sync, and completed publication before acknowledgement. Failures preserve evidence
and never acknowledge success. Explicit retry/inspection verifies closure, does
not adopt unrooted manifests and never deletes or repairs evidence. Quotas include
all new types, failed temporaries and orphans; entry-count exhaustion includes
zero-byte objects. Competing publishers are excluded by the existing lease.

The first complete suite exposed four cold-process fixture failures because its
explicit scratch-runtime module list omitted the new Designer directory. The
helper now includes those modules; assertions and recovery behavior were not
weakened. The affected existing 38 tests subsequently passed. This is the only
additional existing test-helper change.

## Necessary contract refinements

- Controller source SHA is explicitly null: no build-source attestation exists.
  Job baseline SHA is not used as fabricated controller provenance.
- Working-file comparison is explicitly not-checked in this offline increment;
  no source/Git/GitHub subprocess refresh is introduced.
- Verification returns complete verified/stale objects or throws a bounded
  operational error. The CLI serializes blocked errors; it does not return
  fabricated partial manifests/receipts.
- Admission requires a healthy initialized run and genuine retained preparation.
  Corrupt/unavailable storage produces an operational error rather than a fake
  persisted denial with an invented workflow binding.
- Synthetic catalog injection is a trusted test dependency, never a CLI feature.

## AC traceability

| AC | Phase A assessment | Remaining requirement |
|---|---|---|
| 01 | Partial: explicit commands, binding/integrity checks, denial | No attempt start; current preflight/freshness and execution deferred |
| 02 | Execution-dependent; expected exact pin retained | CLI argv/stdin/effective settings and process adapter deferred |
| 03 | Partial: job and receipt provenance implemented | Actual attempt/session binding deferred |
| 04 | Partial: original PNG selection/hash/retention verified | Actual image attachment/vision support deferred |
| 05 | Native qualification unverified | Independently authorized enforced boundary proof required |
| 06 | Native qualification unverified | Plugin/MCP/hooks/delegation/credential restrictions remain blockers |
| 07 | Execution-dependent | No sessions created |
| 08 | Execution-dependent | No event/stderr/final collection |
| 09 | Execution-dependent | No successful-attempt path or report production |
| 10 | Execution-dependent | No execution process lifecycle; artifact crash handling tested |
| 11 | Execution-dependent | No usage or hard token/spend guarantee |
| 12 | Partial: versioned prompt/schema preserve required distinctions | No actual Designer report or native/runtime observations |
| 13 | Partial: retained closure and preparation drift/binding verified | Around-execution integrity deferred |
| 14 | Implemented within Phase A | No execution, implementation, approvals, mutations or product integration |
| 15 | Partial: deterministic preparation/admission/storage tests | Process streams/sessions/native/live execution deferred |

## Preserved limitations

- No native enforcement PASS. Historical `sandbox_apply` evidence is unchanged.
- Plugin/MCP isolation remains unverified; diagnostic readiness policy unchanged.
- ORCH-002 AC-06 remains PARTIAL. No helper, boot relaxation or lock stealing.
- Cooperative filesystem threat model, TOCTOU/ABA, same-user and power-loss limits.
- Abrupt termination may leave conservatively blocked locks and immutable orphans.
- Inspection checks current controller policy conservatively; no automatic migration.
- No production recipe, authoritative pilot inputs, Phase B or ORCH-005 behavior.
- No agent, model inference, autonomous reviewer or `codex exec` was run.

## Validation

Executed against the final implementation:

| Check | Result |
|---|---|
| Focused Designer tests | PASS: 60 tests / 6 files |
| Complete orchestrator tests | PASS: 272 tests / 27 files |
| Root `npm run typecheck` | PASS, exit 0 |
| Root `npm run lint` | PASS, exit 0; two pre-existing generated desktop-output unused-disable warnings |
| Root `npm run build` | PASS, exit 0 |
| Built CLI synthetic preparation/inspection/admission | PASS: exits 0/0/3, decision deny, allowLaunch false; fixed assets resolved |
| `git diff --check` plus new-file no-index whitespace checks | PASS |

An earlier duplicate workspace suite was run concurrently with the full root suite
and build, causing one five-second cross-run test timeout. No deadline or assertion
was relaxed. The root suite's orchestrator portion passed then, and the standalone
complete workspace rerun subsequently passed all 272 tests. Required test execution
uses existing controlled subprocess fixtures; the Designer command tests mock all
process-launch functions to throw and assert zero calls. No agent/inference ran.

Final root `npm test`: exit 1. Importer tests 54/54 passed; desktop tests
266 passed and 23 failed across five files; contracts 1/1 passed; orchestrator
272/272 passed. The same previously reproduced restricted-host desktop failures
recurred: 22 `listen EPERM ... 127.0.0.1` cases and one pending-listen test whose
boundPort remained undefined. No application code changed, no tests were weakened,
and no new baseline comparison or permission expansion was performed. This is not
a passing full local suite. Raw local logs are in
`/tmp/coffee-break-orch004-root-verified.log` and
`/tmp/coffee-break-orch004-workspace-verified.log`; they are not publication files.

Final source/build verification used the fixed packaged assets and a disposable
synthetic test harness; prepare/inspect/admission returned 0/0/3. No model or
native security probe was involved.


## Exact changed-file inventory

6 modified tracked files; 17 new, unstaged files. All are under tools/orchestrator/. Generated dist/ and desktop out/ remain ignored.

### Modified

- `tools/orchestrator/README.md`
- `tools/orchestrator/src/cli.ts`
- `tools/orchestrator/src/inputs/artifacts.ts`
- `tools/orchestrator/src/workflow/paths.ts`
- `tools/orchestrator/src/workflow/store.ts`
- `tools/orchestrator/test/workflow/process-fixtures.ts`
### New

- `tools/orchestrator/evidence/ORCH-004-PHASE-A-IMPLEMENTATION.md`
- `tools/orchestrator/schemas/designer-report-v1.schema.json`
- `tools/orchestrator/src/designer/admission.ts`
- `tools/orchestrator/src/designer/artifacts.ts`
- `tools/orchestrator/src/designer/cli.ts`
- `tools/orchestrator/src/designer/contracts.ts`
- `tools/orchestrator/src/designer/prepare.ts`
- `tools/orchestrator/src/designer/recipes.ts`
- `tools/orchestrator/src/designer/verifier.ts`
- `tools/orchestrator/templates/designer-v1.txt`
- `tools/orchestrator/test/designer/admission.test.ts`
- `tools/orchestrator/test/designer/artifacts.test.ts`
- `tools/orchestrator/test/designer/cli.test.ts`
- `tools/orchestrator/test/designer/contracts.test.ts`
- `tools/orchestrator/test/designer/fixtures.ts`
- `tools/orchestrator/test/designer/paths.test.ts`
- `tools/orchestrator/test/designer/prepare.test.ts`

## Final repository and publication status

Final read-only GitHub checks confirm #103 OPEN and #99 OPEN. No GitHub mutation
was made. Working branch remains `codex/orch-004-phase-a-preparation`, HEAD remains
`9c4d18c1a92b526a8f948da86cb029b5471bce8f`. There are six modified tracked files and
17 new untracked files, all in the documented tooling scope; the index is empty.
Generated outputs are ignored. No commit, push, PR, merge, agent, inference,
production approval or handoff occurred. Stop for independent Reviewer assessment,
Planner evaluation and the Product Owner's next explicit authorization.
