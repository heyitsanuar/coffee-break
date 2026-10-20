#!/bin/sh
# Only compiles/runs in-process fake tests. No native workload helper exists.
set -eu
model_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
artifact_root="$model_root/../../dist/native-d1a"
compiler=/Library/Developer/CommandLineTools/usr/bin/swiftc
sdk=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk
mode=${1:-test}
case "$mode" in build|test|mutations) ;; *) echo 'Usage: check.sh build|test|mutations' >&2; exit 2;; esac
mkdir -p "$artifact_root/cache" "$artifact_root/tmp"
export TMPDIR="$artifact_root/tmp"
export CLANG_MODULE_CACHE_PATH="$artifact_root/cache"
# Architecture tripwire, not sandbox enforcement.
if /usr/bin/grep -nE 'import (Darwin|Virtualization)|task_terminate|proc_signal|posix_spawn|fork\(|exec[a-z]*\(|kill\(|waitpid\(|Process\(|FileManager|FileHandle|DispatchSource|URLSession|system\(' "$model_root"/Sources/*.swift "$model_root"/Tests/*.swift; then
  echo 'Operative process, VM or I/O primitive in simulation module' >&2; exit 1
fi
"$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" -emit-library -static -emit-module -module-name CoffeeBreakVMLifecycleModel "$model_root"/Sources/*.swift -o "$artifact_root/libCoffeeBreakVMLifecycleModel.a" -emit-module-path "$artifact_root/CoffeeBreakVMLifecycleModel.swiftmodule"
"$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" "$model_root"/Sources/*.swift "$model_root"/Tests/Fixtures.swift "$model_root"/Tests/main.swift -Xlinker -platform_version -Xlinker macos -Xlinker 26.0 -Xlinker 26.5 -o "$artifact_root/fake-tests"
if [ "$mode" != build ]; then "$artifact_root/fake-tests"; fi
/usr/bin/codesign --verify --strict "$artifact_root/fake-tests"
/Library/Developer/CommandLineTools/usr/bin/vtool -show-build "$artifact_root/fake-tests"
/usr/bin/shasum -a 256 "$artifact_root/fake-tests" "$artifact_root/libCoffeeBreakVMLifecycleModel.a"
if [ "$mode" = mutations ]; then
python3 - "$model_root" "$artifact_root" "$compiler" "$sdk" <<'PY'
import pathlib
import shutil
import subprocess
import sys
import tempfile

root, artifacts, compiler, sdk = sys.argv[1:]
root, artifacts = pathlib.Path(root), pathlib.Path(artifacts)
original_bytes = {p: p.read_bytes() for directory in [root / "Sources", root / "Tests"] for p in directory.glob("*.swift")}
def check_originals():
    if any(p.read_bytes() != data for p, data in original_bytes.items()):
        sys.exit("Original Swift bytes changed during mutation run; results invalid")

mutations = [
    ("M1", "S09", "Lifecycle.swift", "case .ownerExit: owner.exitRef = ref;",
     "case .ownerExit: ledger.entries[3].status = .satisfied; ledger.entries[3].evidenceRefs = [ref]; owner.exitRef = ref;"),
    ("M2", "T04", "Lifecycle.swift", "if lastTick >= cleanupBy && !ledger.complete { fail(.incompleteCleanup) }",
     "if lastTick >= cleanupBy && !ledger.complete { fail(.incompleteCleanup); quarantine = nil; ledger.reservationHeld = false }"),
    ("M3", "S17", "Lifecycle.swift", "if quarantine?.state == .active { throw VMError.quarantined } // M3",
     "if quarantine?.state == .active { return } // M3"),
    ("M4", "S14", "Authority.swift", "func authenticate(_ observation: VMQualifiedObservation, recovery: Bool) throws {",
     "func authenticate(_ observation: VMQualifiedObservation, recovery: Bool) throws { return"),
    ("M5", "T02", "Lifecycle.swift", "try settle(reason: .controllerLost) // M5: never renew immutable deadlines",
     "try settle(reason: .controllerLost); cleanupBy = try VMWire.add(binding.deadlines.cleanupBy, 10_000)"),
    ("M6", "R04", "Lifecycle.swift", "pending = alreadyPending",
     "pending = alreadyPending; if !acknowledged { brokerOpen = true }"),
    ("M7", "I01", "Evidence.swift", "if interruption == .beforeBytes { throw VMError.interrupted }",
     "receipt = try VMWire.document(proposed); if interruption == .beforeBytes { throw VMError.interrupted }"),
    ("M8", "A02", "Reconciliation.swift", "guard !used else { throw VMError.replay } // M8: permission consumption is one-shot",
     "// M8 mutant: previously consumed permission is accepted again"),
    ("M9", "S10", "Lifecycle.swift", "case .vmStop: owner.stopCallbackRef = ref;",
     "case .vmStop: ledger.entries[5].status = .satisfied; ledger.entries[5].evidenceRefs = [ref]; owner.stopCallbackRef = ref;"),
    ("M10", "Q01", "Lifecycle.swift", "if reason == .quota { try? log.append(.quota, tick: lastTick, critical: true) }",
     "if reason == .quota { for i in ledger.entries.indices { ledger.entries[i].status = .satisfied }; try? log.append(.quota, tick: lastTick, critical: true) }"),
    ("M11", "S08", "Lifecycle.swift", "if t >= binding.deadlines.executionBy { // M11: inclusive expiry",
     "if t > binding.deadlines.executionBy { // M11 mutant: exact deadline still accepted"),
    ("M12", "AC01 AC02 AC16", "Contracts.swift", "static let productionIntegration = false",
     "static let productionIntegration = true"),
    ("M13", "F1-A", "Lifecycle.swift", "recoveryObservations.append(record)",
     "return // M13 mutant: qualified negative evidence is discarded"),
    ("M14", "F2-C", "Ledger.swift", "func requireUnexposed(_ claim: VMObligation) throws {",
     "func requireUnexposed(_ claim: VMObligation) throws { return"),
    ("M15", "F2-E", "Ledger.swift", "func validateCredit(_ fact: VMFact) throws {",
     "func validateCredit(_ fact: VMFact) throws { return"),
    ("M16", "R1-A", "Lifecycle.swift", "if quarantine?.state == .cleared { // R1: safety ingestion survives historical clearance.",
     "if false { // M16 mutant: skip post-clearance dispute ingestion"),
    ("M17", "R1-B", "Lifecycle.swift", "registry.quarantine(binding.hostScopeId, caseId: caseId) // R1: restore the new case's admission hold.",
     "// M17 mutant: no host admission hold for the reopened dispute"),
    ("M18", "R2-A", "Authority.swift", "let exposure = try registeredExposure(fact) // R2: registration must already exist at qualification.",
     'let exposure = VMExposureRegistration(resourceId: fact.resourceId, reference: fact.exposureReference ?? "", tick: fact.tick) // M18 mutant: mint before registered exposure'),
    ("M19", "R2-B", "Authority.swift", "guard let exposure = exposures[fact.claim] else { throw VMError.evidence }",
     'let exposure = exposures[fact.claim] ?? VMExposureRegistration(resourceId: fact.resourceId, reference: fact.exposureReference ?? "", tick: fact.tick)'),
]

for name, selected, file, original, replacement in mutations:
    check_originals()
    control = subprocess.run([str(artifacts / "fake-tests"), selected], capture_output=True, text=True, timeout=30)
    if control.returncode or "PASS " + selected not in control.stdout:
        sys.exit(f"{name}: unmodified focused control failed\n{control.stdout}\n{control.stderr}")
    with tempfile.TemporaryDirectory(prefix=f"{name}-", dir=artifacts / "tmp") as directory:
        copy = pathlib.Path(directory)
        shutil.copytree(root / "Sources", copy / "Sources")
        shutil.copytree(root / "Tests", copy / "Tests")
        target = copy / "Sources" / file
        source = target.read_text()
        if source.count(original) != 1:
            sys.exit(f"{name}: mutation target is not unique; no result credited")
        target.write_text(source.replace(original, replacement))
        binary = copy / "fake-tests"
        command = [compiler, "-sdk", sdk, "-target", "arm64-apple-macosx26.0", "-module-cache-path", str(artifacts / "cache")]
        command += [str(p) for p in sorted((copy / "Sources").glob("*.swift"))]
        command += [str(copy / "Tests/Fixtures.swift"), str(copy / "Tests/main.swift"), "-o", str(binary)]
        built = subprocess.run(command, capture_output=True, text=True, timeout=180)
        if built.returncode:
            sys.exit(f"{name}: compile failure is NOT a detected mutation\n{built.stderr}")
        result = subprocess.run([str(binary), selected], capture_output=True, text=True, timeout=30)
        (artifacts / f"r1r2-{name}.log").write_text(control.stdout + "\nMUTANT\n" + result.stdout + result.stderr)
        if result.returncode != 1 or "FAIL " + selected not in result.stdout or "assertion(" not in result.stdout:
            sys.exit(f"{name}: mutant survived or failed without a relevant assertion\n{result.stdout}\n{result.stderr}")
        print(f"{name} DETECTED: focused control PASS; compiled mutant failed assertion ({selected})", flush=True)
check_originals()
print(f"{len(mutations)}/{len(mutations)} mutations detected; disposable Swift copies removed; original sources unchanged", flush=True)
PY
fi
