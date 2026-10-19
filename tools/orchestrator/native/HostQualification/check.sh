#!/bin/sh
# Explicit development check. Runs only the in-process fake test executable.
set -eu
qualification_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
native_root=$(CDPATH= cd -- "$qualification_root/.." && pwd -P)
artifact_root="$native_root/../dist/native-b0-2a2"
compiler=/Library/Developer/CommandLineTools/usr/bin/swiftc
sdk=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk
mode=${1:-test}
case "$mode" in build|test|inspect) ;; *) echo 'Usage: sh HostQualification/check.sh build|test|inspect' >&2; exit 2;; esac
mkdir -p "$artifact_root/cache" "$artifact_root/tmp"
export TMPDIR="$artifact_root/tmp"
export CLANG_MODULE_CACHE_PATH="$artifact_root/cache"
if [ "$mode" != inspect ]; then
  # A source tripwire, not enforcement proof or a substitute for code review.
  if /usr/bin/grep -nE 'import (Virtualization|Darwin)|posix_spawn|Process\(|fork\(|kill\(|FileManager|FileHandle|DispatchSource|URLSession|system\(' "$qualification_root"/Sources/*.swift "$qualification_root"/HelperMain/*.swift; then
    echo 'Real execution or I/O primitive in qualification model' >&2; exit 1
  fi
  # Reuse only unchanged B0.2A-1 canonical JSON/hash utilities and declarations.
  "$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" -emit-library -static -emit-module -module-name CoffeeBreakHostQualification "$native_root/Sources/Contracts.swift" "$qualification_root"/Sources/*.swift -o "$artifact_root/libCoffeeBreakHostQualification.a" -emit-module-path "$artifact_root/CoffeeBreakHostQualification.swiftmodule"
  "$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" "$native_root/Sources/Contracts.swift" "$qualification_root"/Sources/*.swift "$qualification_root/Tests/main.swift" -Xlinker -platform_version -Xlinker macos -Xlinker 26.0 -Xlinker 26.5 -o "$artifact_root/fake-tests"
  "$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" "$native_root/Sources/Contracts.swift" "$qualification_root"/Sources/*.swift "$qualification_root/HelperMain/main.swift" -Xlinker -platform_version -Xlinker macos -Xlinker 26.0 -Xlinker 26.5 -o "$artifact_root/compile-only-helper"
fi
if [ "$mode" = test ]; then "$artifact_root/fake-tests"; fi
# Never invoke compile-only-helper, regardless of mode or environment.
for artifact in fake-tests compile-only-helper; do
  /usr/bin/shasum -a 256 "$artifact_root/$artifact"
  /usr/bin/codesign --verify --strict "$artifact_root/$artifact"
  /usr/bin/codesign --display --verbose=4 --entitlements - --xml "$artifact_root/$artifact"
  /Library/Developer/CommandLineTools/usr/bin/vtool -show-build "$artifact_root/$artifact"
done
/usr/bin/shasum -a 256 "$artifact_root/libCoffeeBreakHostQualification.a"
