# Task 6.2: Architecture Documentation

**Date:** 2026-04-28  
**Files created:**
- `docs/architecture/overview.md`
- `docs/architecture/adr/ADR-001-lens-page-shell.md`
- `docs/architecture/adr/ADR-002-auth-pattern.md`
- `docs/architecture/adr/ADR-003-server-modularity.md`

## Summary

Created a system architecture overview and three Architecture Decision Records (ADRs) covering the three most impactful structural decisions made in this codebase:

1. LensPageShell adoption — eliminates 50-70 lines of boilerplate per lens page
2. Auth pattern — req.user.id not req.body.userId for actor identity on mutation routes
3. Server modularity — incremental extraction of server.js namespaces to route files

ADRs use the Nygard format (Status / Context / Decision / Consequences) and are intended as living documents — update Status when a decision is superseded.
