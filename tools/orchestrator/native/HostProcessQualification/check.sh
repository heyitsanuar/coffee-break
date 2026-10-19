#!/bin/sh
# Explicit compilation and in-process fake tests only. No helper is built.
set -eu
module_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
artifact_root="$module_root/../../dist/native-gate-2b2a"
compiler=/Library/Developer/CommandLineTools/usr/bin/swiftc
sdk=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk
mode=${1:-test}
case "$mode" in build|test) ;; *) echo 'Usage: sh HostProcessQualification/check.sh build|test' >&2; exit 2;; esac
mkdir -p "$artifact_root/cache" "$artifact_root/tmp"
export TMPDIR="$artifact_root/tmp"
export CLANG_MODULE_CACHE_PATH="$artifact_root/cache"
# Regression tripwire only; source review is still required.
if /usr/bin/grep -nE 'import (Darwin|Virtualization)|posix_spawn|fork\(|exec[a-z]*\(|kill\(|waitpid\(|Process\(|FileManager|FileHandle|DispatchSource|URLSession|system\(|proc_signal' "$module_root"/Sources/*.swift "$module_root"/Tests/*.swift; then
  echo 'Real process or I/O primitive in fake-only module' >&2; exit 1
fi
"$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" -emit-library -static -emit-module -module-name CoffeeBreakNativeAdapterModel "$module_root"/Sources/*.swift -o "$artifact_root/libCoffeeBreakNativeAdapterModel.a" -emit-module-path "$artifact_root/CoffeeBreakNativeAdapterModel.swiftmodule"
"$compiler" -sdk "$sdk" -target arm64-apple-macosx26.0 -module-cache-path "$artifact_root/cache" "$module_root"/Sources/*.swift "$module_root/Tests/main.swift" -Xlinker -platform_version -Xlinker macos -Xlinker 26.0 -Xlinker 26.5 -o "$artifact_root/fake-tests"
if [ "$mode" = test ]; then "$artifact_root/fake-tests"; fi
/usr/bin/codesign --verify --strict "$artifact_root/fake-tests"
/Library/Developer/CommandLineTools/usr/bin/vtool -show-build "$artifact_root/fake-tests"
/usr/bin/shasum -a 256 "$artifact_root/fake-tests" "$artifact_root/libCoffeeBreakNativeAdapterModel.a"
