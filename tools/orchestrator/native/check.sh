#!/bin/sh
# Explicit developer-only invocation; never called by cb-flow or app startup.
set -eu
native_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
artifact_root="$native_root/../dist/native-b0-2a1"
compiler=/Library/Developer/CommandLineTools/usr/bin/swiftc
sdk=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk
mode=${1:-test}
case "$mode" in build|test|inspect) ;; *) echo 'Usage: sh native/check.sh build|test|inspect' >&2; exit 2;; esac
mkdir -p "$artifact_root/cache" "$artifact_root/tmp"
export TMPDIR="$artifact_root/tmp"
export CLANG_MODULE_CACHE_PATH="$artifact_root/cache"
if [ "$mode" != inspect ]; then
  # A narrow source audit, not a proof of native isolation. Model code must have
  # no VM/process/filesystem execution backend. Qualification aliases stay apart.
  if /usr/bin/grep -nE 'import Virtualization|VZVirtualMachine\(|Process\(|posix_spawn|fork\(|kill\(|FileManager|FileHandle\(|DispatchSource' "$native_root"/Sources/*.swift; then
    echo 'Forbidden executable capability in model source' >&2; exit 1
  fi
  # No package resolver, downloads, implicit SDK lookup or external dependencies.
  "$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" -typecheck "$native_root/Qualification/FrameworkDeclarations.swift"
  "$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" -emit-library -static -emit-module -module-name CoffeeBreakB0Scaffold "$native_root"/Sources/*.swift -o "$artifact_root/libCoffeeBreakB0Scaffold.a" -emit-module-path "$artifact_root/CoffeeBreakB0Scaffold.swiftmodule"
  "$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" "$native_root"/Sources/*.swift "$native_root/Tests/main.swift" -Xlinker -platform_version -Xlinker macos -Xlinker 26.0 -Xlinker 26.5 -o "$artifact_root/model-tests"
  /usr/bin/codesign --force --sign - --timestamp=none --entitlements "$native_root/TestEntitlements.plist" "$artifact_root/model-tests"
fi
if [ "$mode" = test ]; then "$artifact_root/model-tests"; fi
/usr/bin/shasum -a 256 "$artifact_root/model-tests" "$artifact_root/libCoffeeBreakB0Scaffold.a"
/usr/bin/codesign --display --verbose=4 --entitlements - --xml "$artifact_root/model-tests"
/Library/Developer/CommandLineTools/usr/bin/vtool -show-build "$artifact_root/model-tests"
