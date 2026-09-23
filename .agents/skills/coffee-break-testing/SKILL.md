---
name: coffee-break-testing
description: When designing or running tests or changing critical logic.
---
# Coffee Break Testing

## Purpose

Choose and apply proportionate validation for critical logic, contracts, UI behavior, and low-risk changes.

## Procedure

1. Use test-first development for critical domain logic, event contracts, state transitions, and runtime validation where applicable.
2. For React or Phaser UI, add or run focused automated checks incrementally and verify applicable visual behavior, window reflow, and accessibility.
3. For documentation or configuration changes, validate the affected content and run repository checks proportionate to regression risk.
4. Avoid redundant mocks, tests that merely repeat implementation details, and arbitrary coverage targets.

## Expected output

Report each validation command or visual check and its exact result, distinguish regressions from evidenced pre-existing failures, disclose checks not executed, and identify remaining test risks.
