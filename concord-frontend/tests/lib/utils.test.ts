import { describe, it, expect } from 'vitest';
import {
  cn,
  formatRelativeTime,
  formatNumber,
  truncate,
  generateId,
  deepClone,
  isEmpty,
  groupBy,
  pick,
  omit,
  parseJSON,
  getByPath,
  setByPath,
  hexToRgb,
  rgbToHex,
  getContrastColor,
  formatBytes,
  pluralize,
  capitalize,
  slugify
} from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('handles empty call', () => {
    expect(cn()).toBe('');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for recent dates', () => {
    expect(formatRelativeTime(new Date())).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });
});

describe('formatNumber', () => {
  it('returns raw number below 1000', () => {
    expect(formatNumber(42)).toBe('42');
  });

  it('formats thousands as K', () => {
    expect(formatNumber(1500)).toBe('1.5K');
  });

  it('formats millions as M', () => {
    expect(formatNumber(2500000)).toBe('2.5M');
  });

  it('formats billions as B', () => {
    expect(formatNumber(1000000000)).toBe('1.0B');
  });
});

describe('truncate', () => {
  it('returns text unchanged if shorter than limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });
});

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('deepClone', () => {
  it('creates a deep copy', () => {
    const obj = { a: { b: 1 } };
    const clone = deepClone(obj);
    clone.a.b = 2;
    expect(obj.a.b).toBe(1);
  });
});

describe('isEmpty', () => {
  it('returns true for empty object', () => {
    expect(isEmpty({})).toBe(true);
  });

  it('returns false for non-empty object', () => {
    expect(isEmpty({ a: 1 })).toBe(false);
  });
});

describe('groupBy', () => {
  it('groups items by key', () => {
    const items = [
      { type: 'a', v: 1 },
      { type: 'b', v: 2 },
      { type: 'a', v: 3 }
    ];
    const grouped = groupBy(items, 'type');
    expect(grouped['a']).toHaveLength(2);
    expect(grouped['b']).toHaveLength(1);
  });
});

describe('pick and omit', () => {
  it('pick selects specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('omit removes specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
  });
});

describe('parseJSON', () => {
  it('parses valid JSON', () => {
    expect(parseJSON('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('returns fallback for invalid JSON', () => {
    expect(parseJSON('not json', { default: true })).toEqual({ default: true });
  });
});

describe('getByPath and setByPath', () => {
  it('gets nested value', () => {
    expect(getByPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing path', () => {
    expect(getByPath({ a: 1 }, 'b.c')).toBeUndefined();
  });

  it('sets nested value', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'a.b.c', 42);
    expect(getByPath(obj, 'a.b.c')).toBe(42);
  });
});

describe('color utilities', () => {
  it('converts hex to rgb', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('converts rgb to hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
  });

  it('returns null for invalid hex', () => {
    expect(hexToRgb('invalid')).toBeNull();
  });

  it('returns white text on dark bg', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
  });

  it('returns black text on light bg', () => {
    expect(getContrastColor('#ffffff')).toBe('#000000');
  });
});

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('formats KB', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats MB', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});

describe('string utilities', () => {
  it('pluralize adds s by default', () => {
    expect(pluralize(0, 'cat')).toBe('cats');
    expect(pluralize(1, 'cat')).toBe('cat');
    expect(pluralize(2, 'cat')).toBe('cats');
  });

  it('pluralize uses custom plural', () => {
    expect(pluralize(2, 'person', 'people')).toBe('people');
  });

  it('capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('slugify produces URL-safe strings', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
  });
});
