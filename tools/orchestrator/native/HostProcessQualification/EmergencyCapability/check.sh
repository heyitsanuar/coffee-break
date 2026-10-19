#!/bin/sh
# Builds and runs only in-process simulation tests; no helper executable exists.
set -eu
model_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
artifact_root="$model_root/../../../dist/native-gate-2b2c"
compiler=/Library/Developer/CommandLineTools/usr/bin/swiftc
sdk=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk
mode=${1:-test}
case "$mode" in build|test) ;; *) echo 'Usage: EmergencyCapability/check.sh build|test' >&2; exit 2;; esac
mkdir -p "$artifact_root/cache" "$artifact_root/tmp"
export TMPDIR="$artifact_root/tmp"
export CLANG_MODULE_CACHE_PATH="$artifact_root/cache"
# Tripwire only, never a security boundary.
if /usr/bin/grep -nE 'import (Darwin|Virtualization)|task_terminate|proc_signal|posix_spawn|fork\(|exec[a-z]*\(|kill\(|waitpid\(|Process\(|FileManager|FileHandle|DispatchSource|URLSession|system\(' "$model_root"/*.swift "$model_root"/Tests/*.swift; then
  echo 'Native execution or I/O primitive in simulation model' >&2; exit 1
fi
"$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" -emit-library -static -emit-module -module-name CoffeeBreakEmergencyCapabilityModel "$model_root"/*.swift -o "$artifact_root/libCoffeeBreakEmergencyCapabilityModel.a" -emit-module-path "$artifact_root/CoffeeBreakEmergencyCapabilityModel.swiftmodule"
"$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" "$model_root"/*.swift "$model_root/Tests/main.swift" -Xlinker -platform_version -Xlinker macos -Xlinker 26.0 -Xlinker 26.5 -o "$artifact_root/fake-tests"
if [ "$mode" = test ]; then "$artifact_root/fake-tests"; fi
/usr/bin/codesign --verify --strict "$artifact_root/fake-tests"
/Library/Developer/CommandLineTools/usr/bin/vtool -show-build "$artifact_root/fake-tests"
/usr/bin/shasum -a 256 "$artifact_root/fake-tests" "$artifact_root/libCoffeeBreakEmergencyCapabilityModel.a"
