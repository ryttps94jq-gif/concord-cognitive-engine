# Task 6.4: Contributor Onboarding Documentation

**Date:** 2026-04-28
**Files created:**
- `docs/contributing/CONTRIBUTING.md`

## Summary

Created contributor guide covering development setup, branch/commit conventions, the two highest-friction contribution patterns (adding a lens page, adding a server route), the auth pattern requirement, running tests, and CI gates. The auth pattern section is intentionally prominent because auth bypass via req.body.userId is the most common quality gap introduced by AI-generated code in this codebase.
