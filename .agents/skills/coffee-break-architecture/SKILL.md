---
name: coffee-break-architecture
description: When changing module boundaries, event contracts, or integration architecture.
---
# Coffee Break Architecture

## Purpose

Preserve Coffee Break's approved local-first module boundaries, event contracts, and integration architecture.

## Procedure

1. Read `docs/architecture/README.md` as the source of truth.
2. Identify the affected modules, dependency direction, trust boundaries, and contracts.
3. Propose the smallest necessary change and keep provider-specific logic outside React and Phaser.
4. Flag any change to an approved boundary or architectural decision for explicit approval before implementation.

## Expected output

Report the affected boundaries, the minimal proposed change, compatibility risks, required safeguards, and any decision that would change the approved architecture.
