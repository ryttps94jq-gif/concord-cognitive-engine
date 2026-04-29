---
name: royalty-cascade
description: Understand and work with Concord's perpetual royalty attribution system
when_to_use: Creating DTUs, processing purchases, debugging attribution, working with economy
loads: eager
category: core
---

# Royalty Cascade

Every DTU that gets used in Concord's AI responses generates royalties for its creator — and for every DTU in its lineage chain, forever.

## How it works

1. User purchases or interacts with a DTU
2. Platform takes 30% (Concord royalty)
3. 70% goes to the creator
4. Creator's portion cascades: 21% of their earnings go to DTUs they cited
5. Each generation receives half the previous (21% → 10.5% → 5.25%...) with a 0.05% floor
6. Chain continues up to 50 generations — never reaches zero

## Key functions

```js
// Calculate rate for a given generation
const rate = calculateGenerationalRate(generation, initialRate = 0.21);

// Register a citation (activates the cascade)
await registerCitation(db, {
  childId,      // the new DTU
  parentId,     // the DTU being cited
  creatorId,    // creator of the child
  parentCreatorId,  // creator of the parent
});
```

## What counts as a citation

- Direct quotes or excerpts
- Building on concepts from a prior DTU
- Remixing or extending existing work
- Using a DTU as a reference source

## Philosophy

The royalty cascade is what makes Concord's substrate self-sustaining. When you create quality DTUs, you earn from every future use — and so does everyone whose work yours builds on.
