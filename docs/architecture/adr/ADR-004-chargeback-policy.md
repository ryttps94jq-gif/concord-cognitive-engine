# ADR-004: Chargeback Reserve Policy

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-28 |
| **Deciders** | Economy Squad |

---

## Context

Stripe can issue chargebacks (disputes) on behalf of cardholders. When a chargeback is accepted, the disputed amount is clawed back from the platform. The question is who bears that loss: the platform, the creator/seller who received the distribution, or some blended approach.

In a marketplace where creators receive royalty cascade distributions at the moment of sale, reversing those distributions is technically complex, economically disruptive, and harmful to creator trust. Creators who received a royalty payout three months ago cannot be expected to return funds because a buyer later disputed the charge.

The platform also collects a fee on every transaction. Part of that fee revenue can be earmarked as a self-insurance reserve to cover chargeback losses without burdening creators.

---

## Decision

**Platform reserves cover chargebacks. Cascade recipients keep their distributions.**

### Reserve structure

Three reserve buckets are maintained in `reserves_balance` (SQLite, integer cents):

| Reserve | Purpose |
|---------|---------|
| `chargebackReserve` | Covers accepted Stripe disputes |
| `operatingReserve` | Ongoing platform operating costs |
| `treasuryReserve` | Long-term treasury / future use |

### Fee allocation

On every marketplace purchase (and other platform fee-generating events), the platform fee is split:

- **Building phase** (chargebackReserve < 6-month target): 25% → `chargebackReserve`, 75% → `operatingReserve`
- **Maintenance phase** (chargebackReserve ≥ 6-month target): 5% → `chargebackReserve`, 95% → `operatingReserve`

The 6-month target is computed as the total chargeback spend over the last 180 days (floored at a $10,000 seed target until sufficient history accumulates).

All amounts are stored as **integer cents** in SQLite. No floating-point arithmetic is persisted.

### Chargeback handling (`charge.dispute.created`)

When Stripe sends a `charge.dispute.created` webhook event:

1. Look up the originating purchase by `stripe_payment_intent_id` (or `metadata_json` LIKE fallback).
2. If no purchase is found, log an audit entry and take no further action.
3. Attempt to debit `chargebackReserve` for the dispute amount.
4. If the reserve is sufficient:
   - Debit the reserve.
   - Mark the purchase `status = 'charged_back'`.
   - Log an audit entry (`chargeback_covered_by_reserve`).
5. If the reserve is insufficient:
   - Log an audit entry (`chargeback_manual_review_required`) to alert the operations team.
   - Do **not** reverse creator distributions.

### Creator protection invariant

Creators never have distributions clawed back due to a chargeback. The platform absorbs the loss via the reserve. If the reserve is exhausted, the dispute is flagged for manual resolution — not automatically recovered from creator wallets.

---

## Consequences

### Positive

- **Creator trust**: Creators can rely on received payments. Retroactive clawbacks would undermine the value of the marketplace entirely.
- **Predictable reserve growth**: Systematic 25% fee allocation builds the reserve automatically without manual intervention.
- **Auditable**: Every reserve movement — allocation, payout, balance — is recorded in `reserves_ledger` with a source transaction ID.
- **Health monitoring**: `GET /api/admin/reserves/health` exposes sufficiency-days and status (`healthy` / `low` / `critical`) so operations teams can act before the reserve is exhausted.
- **User transparency**: `GET /api/wallet/protection-status` communicates the protection guarantee to users.

### Negative

- **Platform bears the loss**: In high-dispute periods the reserve may be depleted before the 6-month target is rebuilt, requiring manual review of disputes.
- **25% allocation reduces operating revenue**: During the building phase, only 75% of fee revenue reaches the operating reserve. This is acceptable given platform fee rates but should be monitored.
- **Seed target is a heuristic**: The $10,000 seed target is arbitrary before chargeback history accumulates. The target auto-adjusts after 180 days of real data.

---

## Alternatives Considered

### A: Clawback creator distributions

Reverse royalty payouts on chargeback. Rejected because:
- Technically complex — reversals cascade through potentially many royalty recipients.
- Economically harmful — creators cannot reasonably anticipate or absorb retroactive reversals.
- Destroys creator trust in the platform's payment reliability.

### B: Stripe Chargeback Protection (Stripe Radar)

Pay Stripe's Chargeback Protection fee (~0.4% per transaction) to have Stripe absorb dispute losses. Rejected because:
- Adds a third-party dependency on a Stripe add-on product.
- Costs money even in periods of low chargeback activity.
- Does not give the platform control over reserve sizing or dispute review policy.

### C: No reserve — manual case-by-case handling

Treat every chargeback as a one-off manual event. Rejected because:
- Does not scale as transaction volume grows.
- Leaves operations without a systematic funding source to cover losses.
- Creates unpredictable P&L impact.

---

## Implementation

| File | Role |
|------|------|
| `server/economy/reserves.js` | Reserve schema, `allocateFromFee`, `payChargeback`, `getReserveBalance`, `getReserveHealth` |
| `server/economy/chargeback-handler.js` | `handleChargeback`, `flagChargebackForManualReview` |
| `server/economy/stripe.js` | Wires `charge.dispute.created` → `handleChargeback` |
| `server/economy/routes.js` | Calls `initReservesSchema`, `allocateFromFee` after marketplace purchases; exposes health and protection-status endpoints |
| `server/tests/economy/chargeback-policy.test.js` | Unit tests for the above |

---

## Related

- [ADR-001: Lens Page Shell](ADR-001-lens-page-shell.md)
- [ADR-002: Auth Pattern](ADR-002-auth-pattern.md)
- [ADR-003: Server Modularity](ADR-003-server-modularity.md)
- `server/economy/fees.js` — fee rates and platform account IDs
- `server/economy/royalty-cascade.js` — cascade distribution logic (protected by this policy)
