// Tests for ConnectionIndicator component

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ConnectionIndicator } from '../../surface/components/ConnectionIndicator';
import type { ConnectionState } from '../../utils/types';

// No react-native mock needed — the default Jest setup handles it

describe('ConnectionIndicator', () => {
  describe('online state', () => {
    it('renders the dot with green color', () => {
      const { toJSON } = render(<ConnectionIndicator state="online" />);
      const tree = toJSON();
      // Container view
      expect(tree).not.toBeNull();
      const container = tree as any;
      // The dot is the first child
      const dot = container.children[0];
      const bgColor = dot.props.style.find
        ? dot.props.style.find((s: any) => s.backgroundColor)?.backgroundColor
        : dot.props.style.backgroundColor;
      expect(bgColor).toBe('#00ff88');
    });

    it('renders "Online" label by default', () => {
      render(<ConnectionIndicator state="online" />);
      expect(screen.getByText('Online')).toBeTruthy();
    });

    it('renders label text with green color', () => {
      render(<ConnectionIndicator state="online" />);
      const label = screen.getByText('Online');
      const colorStyle = Array.isArray(label.props.style)
        ? label.props.style.find((s: any) => s.color)
        : label.props.style;
      expect(colorStyle.color).toBe('#00ff88');
    });
  });

  describe('mesh-only state', () => {
    it('renders the dot with amber color', () => {
      const { toJSON } = render(<ConnectionIndicator state="mesh-only" />);
      const tree = toJSON() as any;
      const dot = tree.children[0];
      const bgColor = dot.props.style.find
        ? dot.props.style.find((s: any) => s.backgroundColor)?.backgroundColor
        : dot.props.style.backgroundColor;
      expect(bgColor).toBe('#ffaa00');
    });

    it('renders "Mesh Only" label', () => {
      render(<ConnectionIndicator state="mesh-only" />);
      expect(screen.getByText('Mesh Only')).toBeTruthy();
    });

    it('renders label with amber color', () => {
      render(<ConnectionIndicator state="mesh-only" />);
      const label = screen.getByText('Mesh Only');
      const colorStyle = Array.isArray(label.props.style)
        ? label.props.style.find((s: any) => s.color)
        : label.props.style;
      expect(colorStyle.color).toBe('#ffaa00');
    });
  });

  describe('offline state', () => {
    it('renders the dot with red color', () => {
      const { toJSON } = render(<ConnectionIndicator state="offline" />);
      const tree = toJSON() as any;
      const dot = tree.children[0];
      const bgColor = dot.props.style.find
        ? dot.props.style.find((s: any) => s.backgroundColor)?.backgroundColor
        : dot.props.style.backgroundColor;
      expect(bgColor).toBe('#ff4444');
    });

    it('renders "Offline" label', () => {
      render(<ConnectionIndicator state="offline" />);
      expect(screen.getByText('Offline')).toBeTruthy();
    });

    it('renders label with red color', () => {
      render(<ConnectionIndicator state="offline" />);
      const label = screen.getByText('Offline');
      const colorStyle = Array.isArray(label.props.style)
        ? label.props.style.find((s: any) => s.color)
        : label.props.style;
      expect(colorStyle.color).toBe('#ff4444');
    });
  });

  describe('showLabel prop', () => {
    it('shows label when showLabel is true', () => {
      render(<ConnectionIndicator state="online" showLabel={true} />);
      expect(screen.getByText('Online')).toBeTruthy();
    });

    it('shows label by default (showLabel defaults to true)', () => {
      render(<ConnectionIndicator state="online" />);
      expect(screen.getByText('Online')).toBeTruthy();
    });

    it('hides label when showLabel is false', () => {
      render(<ConnectionIndicator state="online" showLabel={false} />);
      expect(screen.queryByText('Online')).toBeNull();
    });

    it('still renders the dot when showLabel is false', () => {
      const { toJSON } = render(<ConnectionIndicator state="online" showLabel={false} />);
      const tree = toJSON() as any;
      // Container should still have the dot child
      expect(tree.children).toHaveLength(1);
      const dot = tree.children[0];
      const bgColor = dot.props.style.find
        ? dot.props.style.find((s: any) => s.backgroundColor)?.backgroundColor
        : dot.props.style.backgroundColor;
      expect(bgColor).toBe('#00ff88');
    });
  });

  describe('all connection states render consistently', () => {
    const stateConfigs: Array<{ state: ConnectionState; color: string; label: string }> = [
      { state: 'online', color: '#00ff88', label: 'Online' },
      { state: 'mesh-only', color: '#ffaa00', label: 'Mesh Only' },
      { state: 'offline', color: '#ff4444', label: 'Offline' },
    ];

    it.each(stateConfigs)(
      'renders "$state" with color $color and label "$label"',
      ({ state, color, label }) => {
        render(<ConnectionIndicator state={state} />);
        const labelEl = screen.getByText(label);
        expect(labelEl).toBeTruthy();
        const colorStyle = Array.isArray(labelEl.props.style)
          ? labelEl.props.style.find((s: any) => s.color)
          : labelEl.props.style;
        expect(colorStyle.color).toBe(color);
      },
    );
  });

  describe('snapshot structure', () => {
    it('renders a container with row direction', () => {
      const { toJSON } = render(<ConnectionIndicator state="online" />);
      const tree = toJSON() as any;
      const containerStyle = Array.isArray(tree.props.style)
        ? tree.props.style
        : [tree.props.style];
      const hasRowDirection = containerStyle.some(
        (s: any) => s && s.flexDirection === 'row',
      );
      expect(hasRowDirection).toBe(true);
    });

    it('renders exactly two children when label is visible (dot + text)', () => {
      const { toJSON } = render(<ConnectionIndicator state="offline" />);
      const tree = toJSON() as any;
      expect(tree.children).toHaveLength(2);
    });

    it('renders exactly one child when label is hidden (dot only)', () => {
      const { toJSON } = render(<ConnectionIndicator state="offline" showLabel={false} />);
      const tree = toJSON() as any;
      expect(tree.children).toHaveLength(1);
    });
  });
});
