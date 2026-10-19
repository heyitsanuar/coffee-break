import Foundation

// Compile-only, fail-closed entrypoint. No argv/environment/stdin authorization
// path exists. Gate 2B needs a separately reviewed private transport bootstrap.
exit(QualificationHelperEntry.unavailableTransportExitCode)
