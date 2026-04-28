# ADR-001: LensPageShell Adoption

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-28 |
| **Deciders** | Quality Sprint Team |

---

## Context

The Concord frontend contains 176+ lens pages under `concord-frontend/app/lenses/`. Each lens page historically copy-pasted the same 50–70 lines of boilerplate:

```tsx
// Repeated in every lens page — pre-LensPageShell
const { isLoading, isError, dtus } = useLensDTUs(domain);
const { isLive } = useRealtimeLens(domain);
useLensNav(domain);

return (
  <div>
    <header>
      <h1>{title}</h1>
      <LiveIndicator active={isLive} />
      <DTUExportButton domain={domain} />
    </header>
    <RealtimeDataPanel domain={domain} features={features} />
    {isLoading && <Spinner />}
    {isError && <ErrorBanner />}
    {/* lens-specific content */}
  </div>
);
```

Static analysis with `jscpd` measured **11.97% code duplication** across the frontend — a significant portion attributable to this repeated pattern.

The duplication caused two categories of problems:

1. **Consistency drift** — New lens pages added by contributors (including AI-generated code) routinely omitted `LiveIndicator`, used the wrong header DOM structure, or wired `useLensNav` incorrectly.
2. **Cross-cutting changes are O(n)** — Adding a new header action (e.g., a share button or `data-testid` attribute) required modifying all 176+ files.

---

## Decision

Introduce a `LensPageShell` component in `concord-frontend/components/LensPageShell.tsx` that encapsulates all boilerplate. Each lens page becomes:

```tsx
// Post-migration lens page
export default function FinanceLensPage() {
  const { dtus, isLoading, isError } = useLensDTUs('finance');

  return (
    <LensPageShell
      domain="finance"
      title="Finance"
      headerIcon={<FinanceIcon />}
      isLoading={isLoading}
      isError={isError}
    >
      {/* lens-specific content only */}
    </LensPageShell>
  );
}
```

`LensPageShell` internally calls `useLensNav`, `useRealtimeLens`, and renders the standard header with `LiveIndicator`, `DTUExportButton`, and `RealtimeDataPanel`. It also renders `data-testid="lens-shell"` on the root element.

---

## Consequences

### Positive

- **Single source of truth for lens chrome.** Adding a new cross-lens feature (e.g., a breadcrumb, a new header button, accessibility attributes) requires changing one file instead of 176.
- **Reliable smoke-test targeting.** All lens pages render `[data-testid="lens-shell"]`, allowing a single Playwright selector to assert correct shell rendering across the full lens suite.
- **Lower onboarding friction.** A contributor adding a new lens follows a five-line pattern with no subtle wiring to get wrong.
- **Measurable duplication reduction.** jscpd duplication percentage drops as pages are migrated.

### Negative

- **Non-standard layouts require shell extension.** A lens page that needs an unusual header structure (e.g., a split header, a map canvas that fills the viewport) cannot simply override the shell locally — it must either extend `LensPageShell` via props/slots or request a shell variant. This is an acceptable trade-off given that the vast majority of lenses use the standard layout.

---

## Migration

| Milestone | Detail |
|-----------|--------|
| Component introduced | Quality sprint 2026-04-28 |
| Pages migrated | 28 pages migrated in quality sprint 2026-04-28 |
| Remaining pages | Follow the same pattern; migrate incrementally |

The migration is **non-breaking**: un-migrated pages continue to function with their existing boilerplate. There is no flag day.

### Migration checklist per page

1. Import `LensPageShell`.
2. Remove `useLensNav`, `useRealtimeLens` calls (shell handles them).
3. Remove the `<header>` block including `LiveIndicator`, `DTUExportButton`, `RealtimeDataPanel`.
4. Wrap lens-specific JSX in `<LensPageShell domain="..." title="..." headerIcon={...} isLoading={...} isError={...}>`.
5. Run `npm test` and the Playwright smoke suite.
