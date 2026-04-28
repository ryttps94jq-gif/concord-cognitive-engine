# Pattern 2: Duplicate Route Registrations

**Date:** 2026-04-28

## Summary

After previous fixes (8 duplicates removed in commit ca00bda), re-ran full route registration audit across server.js (2,752 total route registrations across all files).

---

## Analysis

Extracted all `app.get/post/put/delete/patch` registrations from server.js. Found 20 paths appearing 2+ times. After checking HTTP methods:

- All but 8 (already fixed) were **same path, different method** — valid REST design (GET+POST on same path, PUT+DELETE on same path, etc.)
- No new same-method-same-path duplicates found in server.js
- Route files in `server/routes/` use Express Router objects — router-level duplicates would only matter if the same router were mounted twice at the same prefix, which was already fixed (createSocialGroupRoutes double mount at /api/social removed in commit ca00bda)

---

## Conclusion

Pattern 2 is clean. No new duplicates found. Previous audit closed all duplicate registrations.
