# ADR-050: Configurable deployment capacity

Status: accepted, 2026-10-19, following the maintainer's request to align capacity controls with the deployment guide. Supersedes the fixed provider ceilings in ADR-006.

## Decision

`MAX_STORAGE_BYTES` and `MAX_TOTAL_FACES` are the authoritative deployment ceilings. Both must be positive safe integers; invalid or absent values fail closed. The effective limit remains the lower of the deployment ceiling and the owner limit in D1. Null owner limits inherit the deployment ceiling.

Keep the checked-in production and preview defaults at 9.9 decimal GB and 39,000 faces. Remove the additional hardcoded 10 GB / 39,062-face clamps: those prevented a deliberately configured larger deployment from working, even on an appropriate provider plan.

## Consequences

Raising a binding is an explicit deployment change, not an admin control or an automatic plan upgrade. Operators must review provider capacity, account-wide usage and billing, then update each intended environment. Existing lower owner limits still apply and may need to be raised separately. No data migration, deletion or new dependency is needed. These controls do not guarantee free hosting or a measured performance target.

Validation covers defaults, capacity above the old clamps, invalid/unsafe bindings and owner limits below and above deployment ceilings.
