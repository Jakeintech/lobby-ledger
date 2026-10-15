# ADR 0002: Apps read Gold only

Status: accepted

## Context

The Raw Vault is optimized for loading and audit, not for reading. A screen that walks hubs, links and satellites would duplicate business rules (what counts as "active", which amendment wins) in TypeScript, and every app would drift.

## Decision

The AppKit app queries only `gold.*` objects: `experience_search`, `fact_filing`, `bridge_registrant_client_lobbyist`, `pit_engagement` and the dimensions. Business rules live in Gold SQL (`sat_engagement_computed`, `fact_filing`). Silver is granted to the pipeline, not to apps.

## Consequences

- Rules change in one place and every consumer sees the change.
- Gold is a contract; renaming a Gold column is a breaking change for the app's generated types.
- Gold must carry what the app needs, so some denormalization (the wide `experience_search` view) is deliberate.
