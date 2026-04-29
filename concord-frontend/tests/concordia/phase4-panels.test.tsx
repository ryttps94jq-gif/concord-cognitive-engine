/**
 * Phase 4 Panel Unit Tests
 *
 * Verifies that each Phase 4 panel renders its core UI in the expected initial state.
 * All fetch calls are mocked so these run without a running server.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/dynamic — return a simple passthrough so dynamic imports resolve
vi.mock('next/dynamic', () => ({
  default: (fn: () => Promise<{ default: React.ComponentType }>) => {
    const Component = React.lazy(fn);
    return (props: Record<string, unknown>) =>
      React.createElement(React.Suspense, { fallback: null }, React.createElement(Component, props));
  },
}));

// Mock fetch globally
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ entries: [], jobs: [], matches: [], inQueue: false, queueSize: 0, position: null }),
  }));
});

// ── LeaderboardPanel ────────────────────────────────────────────────────────

describe('LeaderboardPanel', () => {
  it('renders all 4 category tabs', async () => {
    const { LeaderboardPanel } = await import('@/components/concordia/world/LeaderboardPanel');
    render(<LeaderboardPanel />);
    expect(screen.getByText('Sparks')).toBeTruthy();
    expect(screen.getByText('Skills')).toBeTruthy();
    expect(screen.getByText('Crafts')).toBeTruthy();
    expect(screen.getByText('Nemesis')).toBeTruthy();
  });

  it('renders empty state when entries are empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    }));
    const { LeaderboardPanel } = await import('@/components/concordia/world/LeaderboardPanel');
    render(<LeaderboardPanel />);
    // No crash with empty entries
    expect(screen.getByText('Sparks')).toBeTruthy();
  });
});

// ── ArenaPanel ───────────────────────────────────────────────────────────────

describe('ArenaPanel', () => {
  it('renders the queue join button', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ inQueue: false, queueSize: 0, position: null }),
    }));
    const { ArenaPanel } = await import('@/components/concordia/world/ArenaPanel');
    render(<ArenaPanel playerId="test-player" />);
    expect(screen.getByText(/enter arena queue/i)).toBeTruthy();
  });
});

// ── JobsBoardPanel ───────────────────────────────────────────────────────────

describe('JobsBoardPanel', () => {
  it('renders the Available tab by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [] }),
    }));
    const { JobsBoardPanel } = await import('@/components/concordia/world/JobsBoardPanel');
    render(<JobsBoardPanel playerId="test-player" />);
    expect(screen.getByText('Available')).toBeTruthy();
  });
});

// ── WorldEventsPanel ─────────────────────────────────────────────────────────

describe('WorldEventsPanel', () => {
  it('renders the Active tab', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    }));
    const { WorldEventsPanel } = await import('@/components/concordia/world/WorldEventsPanel');
    render(<WorldEventsPanel worldId="concordia-hub" />);
    expect(screen.getByText('active')).toBeTruthy();
  });
});

// ── LensPortalMarker ─────────────────────────────────────────────────────────

describe('LensPortalMarker', () => {
  const basePortal = {
    id: 'p1',
    lens_id: 'studio',
    label: 'Music Studio',
    description: 'Create music',
    district: 'creative',
    x: 5,
    y: 5,
    building_type: 'studio',
    required_skill_level: 0,
    accessible: false,
  };

  it('renders locked state when accessible=false', async () => {
    const { LensPortalMarker } = await import('@/components/concordia/world/LensPortalMarker');
    render(
      <LensPortalMarker
        portal={basePortal}
        isNearby={false}
        onEnter={() => {}}
      />,
    );
    expect(screen.getByText('Music Studio')).toBeTruthy();
    // Lock icon should be present (the portal is locked)
    expect(screen.getByText(/skill/i)).toBeTruthy();
  });

  it('renders accessible portal with icon', async () => {
    const { LensPortalMarker } = await import('@/components/concordia/world/LensPortalMarker');
    render(
      <LensPortalMarker
        portal={{ ...basePortal, accessible: true }}
        isNearby={false}
        onEnter={() => {}}
      />,
    );
    expect(screen.getByText('Music Studio')).toBeTruthy();
  });

  it('shows Press E prompt when nearby and accessible', async () => {
    const { LensPortalMarker } = await import('@/components/concordia/world/LensPortalMarker');
    render(
      <LensPortalMarker
        portal={{ ...basePortal, accessible: true }}
        isNearby={true}
        onEnter={() => {}}
      />,
    );
    expect(screen.getByText(/press e to enter/i)).toBeTruthy();
  });
});
