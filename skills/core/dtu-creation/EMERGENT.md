---
name: dtu-creation
description: Create well-formed DTUs with required fields, lineage, and royalty wiring
when_to_use: User is creating new content that should become persistent substrate
loads: eager
category: core
---

# Creating DTUs

DTUs (Dynamic Text Units) are Concord's substrate — the knowledge atoms that power everything. Creating them well means the platform remembers, attributes, and compensates correctly.

## Required fields

Every DTU needs: `title`, `content`, `contentType`, `creatorId`, `tier`.

```js
const dtu = createDTU(db, {
  creatorId: userId,
  title: "Clear, searchable title",
  content: "The actual knowledge content",
  contentType: "text",  // or: code, image, audio, video, document
  tags: ["relevant", "tags"],
  tier: "REGULAR",  // REGULAR | MEGA | HYPER | SHADOW
});
```

## Tier selection

- `REGULAR` — standalone contribution
- `MEGA` — synthesis of 5+ related REGULARs
- `HYPER` — synthesis of 3+ MEGAs
- `SHADOW` — emergent-created, pending council promotion

## Lineage

Always record lineage when a DTU builds on prior work:

```js
// After creation, register citations
for (const parentId of sourceIds) {
  registerCitation(db, { childId: dtu.id, parentId, creatorId: userId, ... });
}
```

This activates the royalty cascade — contributors are credited automatically.

## Quality checklist

- [ ] Title is specific and searchable (not "New DTU")
- [ ] Content is complete and self-contained
- [ ] Tags are accurate (used for substrate retrieval)
- [ ] Lineage is recorded if built on existing DTUs
- [ ] Tier matches actual scope (don't over-tier)
