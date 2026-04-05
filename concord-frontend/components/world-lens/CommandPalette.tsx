'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Navigation, Building2, Zap, Users, Settings,
  Eye, Brain, ArrowUp, ArrowDown, CornerDownLeft, X,
  Clock, Calculator, Command, Map, Hammer, Activity,
  Hash, Globe, Layers, Star, ChevronRight,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────── */

type CommandCategory =
  | 'navigation'
  | 'building'
  | 'simulation'
  | 'social'
  | 'search'
  | 'settings'
  | 'lens';

interface CommandResult {
  id: string;
  category: CommandCategory;
  icon: React.ReactNode;
  label: string;
  description: string;
  shortcut?: string;
  action: string;
}

interface PaletteContext {
  currentDistrict?: string;
  currentMode?: string;
  isBuilding?: boolean;
  nearPlayers?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (action: string, query: string) => void;
  context?: PaletteContext;
}

/* ── Constants ─────────────────────────────────────────────────── */

const panel = 'bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg';

const CATEGORY_META: Record<CommandCategory, { label: string; color: string; icon: React.ReactNode }> = {
  navigation: { label: 'Navigation', color: 'text-blue-400', icon: <Navigation className="w-3 h-3" /> },
  building:   { label: 'Building',   color: 'text-green-400', icon: <Building2 className="w-3 h-3" /> },
  simulation: { label: 'Simulation', color: 'text-orange-400', icon: <Activity className="w-3 h-3" /> },
  social:     { label: 'Social',     color: 'text-purple-400', icon: <Users className="w-3 h-3" /> },
  search:     { label: 'Search',     color: 'text-cyan-400', icon: <Search className="w-3 h-3" /> },
  settings:   { label: 'Settings',   color: 'text-gray-400', icon: <Settings className="w-3 h-3" /> },
  lens:       { label: 'Lens',       color: 'text-yellow-400', icon: <Eye className="w-3 h-3" /> },
};

const ALL_COMMANDS: CommandResult[] = [
  // Navigation
  { id: 'nav-forge',     category: 'navigation', icon: <Map className="w-4 h-4" />,      label: 'Go to the Forge',            description: 'Navigate to the Forge district',      shortcut: 'G F',  action: 'navigate:forge' },
  { id: 'nav-plaza',     category: 'navigation', icon: <Map className="w-4 h-4" />,      label: 'Go to Central Plaza',        description: 'Navigate to Central Plaza',            shortcut: 'G P',  action: 'navigate:plaza' },
  { id: 'nav-district',  category: 'navigation', icon: <Globe className="w-4 h-4" />,    label: 'Go to district...',          description: 'Navigate to a specific district',      action: 'navigate:district' },
  { id: 'nav-home',      category: 'navigation', icon: <Navigation className="w-4 h-4" />, label: 'Go home',                 description: 'Teleport to your home plot',            shortcut: 'G H',  action: 'navigate:home' },
  { id: 'nav-bookmark',  category: 'navigation', icon: <Star className="w-4 h-4" />,     label: 'Go to bookmark...',          description: 'Navigate to a saved location',          action: 'navigate:bookmark' },

  // Building
  { id: 'build-new',     category: 'building',   icon: <Hammer className="w-4 h-4" />,   label: 'New building',               description: 'Start building from scratch',           shortcut: 'B N',  action: 'build:new' },
  { id: 'build-template',category: 'building',   icon: <Layers className="w-4 h-4" />,   label: 'From template...',           description: 'Start from a building template',        action: 'build:template' },
  { id: 'build-find',    category: 'building',   icon: <Search className="w-4 h-4" />,   label: 'Find beams...',              description: 'Search structural members by criteria', action: 'build:find-beams' },
  { id: 'build-dtu',     category: 'building',   icon: <Hash className="w-4 h-4" />,     label: 'Show my DTUs',               description: 'List all your design type units',       shortcut: 'D L',  action: 'build:my-dtus' },
  { id: 'build-validate',category: 'building',   icon: <Zap className="w-4 h-4" />,      label: 'Validate current DTU',       description: 'Run validation on active DTU',          shortcut: 'D V',  action: 'build:validate' },

  // Simulation
  { id: 'sim-earthquake',category: 'simulation', icon: <Activity className="w-4 h-4" />, label: 'Earthquake simulation',      description: 'Run seismic stress test',               shortcut: 'S E',  action: 'sim:earthquake' },
  { id: 'sim-wind',      category: 'simulation', icon: <Activity className="w-4 h-4" />, label: 'Wind load test',             description: 'Simulate wind forces',                  action: 'sim:wind' },
  { id: 'sim-fire',      category: 'simulation', icon: <Activity className="w-4 h-4" />, label: 'Fire spread simulation',     description: 'Model fire behavior',                   action: 'sim:fire' },
  { id: 'sim-stress',    category: 'simulation', icon: <Activity className="w-4 h-4" />, label: 'Structural stress test',     description: 'Full structural analysis',               shortcut: 'S S',  action: 'sim:stress' },

  // Social
  { id: 'soc-invite',    category: 'social',     icon: <Users className="w-4 h-4" />,    label: 'Invite player...',           description: 'Invite someone to collaborate',          action: 'social:invite' },
  { id: 'soc-share',     category: 'social',     icon: <Users className="w-4 h-4" />,    label: 'Share DTU...',               description: 'Share your DTU with someone',            action: 'social:share' },
  { id: 'soc-firm',      category: 'social',     icon: <Building2 className="w-4 h-4" />,label: 'Firm dashboard',             description: 'Open your firm management panel',        shortcut: 'F D',  action: 'social:firm' },

  // Search
  { id: 'search-global', category: 'search',     icon: <Search className="w-4 h-4" />,   label: 'Search everything...',       description: 'Search across all entities',             shortcut: '/',    action: 'search:global' },
  { id: 'search-players',category: 'search',     icon: <Users className="w-4 h-4" />,    label: 'Find player...',             description: 'Search for a player by name',            action: 'search:players' },
  { id: 'search-builds', category: 'search',     icon: <Building2 className="w-4 h-4" />,label: 'Find buildings...',           description: 'Search buildings and structures',       action: 'search:buildings' },

  // Settings
  { id: 'set-graphics',  category: 'settings',   icon: <Settings className="w-4 h-4" />, label: 'Graphics settings',          description: 'Adjust visual quality and performance', action: 'settings:graphics' },
  { id: 'set-audio',     category: 'settings',   icon: <Settings className="w-4 h-4" />, label: 'Audio settings',             description: 'Configure sound and voice',              action: 'settings:audio' },
  { id: 'set-controls',  category: 'settings',   icon: <Settings className="w-4 h-4" />, label: 'Key bindings',               description: 'Customize keyboard controls',            shortcut: 'K B',  action: 'settings:controls' },

  // Lens
  { id: 'lens-struct',   category: 'lens',       icon: <Eye className="w-4 h-4" />,      label: 'Structural lens',            description: 'View structural stress overlays',        shortcut: 'L S',  action: 'lens:structural' },
  { id: 'lens-thermal',  category: 'lens',       icon: <Eye className="w-4 h-4" />,      label: 'Thermal lens',               description: 'View heat distribution overlays',        shortcut: 'L T',  action: 'lens:thermal' },
  { id: 'lens-collab',   category: 'lens',       icon: <Eye className="w-4 h-4" />,      label: 'Collaboration lens',         description: 'See who built what',                     shortcut: 'L C',  action: 'lens:collaboration' },
];

/* ── Fuzzy match ──────────────────────────────────────────────── */

function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

/* ── Quick math ───────────────────────────────────────────────── */

function tryMath(input: string): string | null {
  if (!/^[\d\s+\-*/().%^]+$/.test(input.trim())) return null;
  try {
    const sanitized = input.replace(/\^/g, '**');
    const result = new Function(`"use strict"; return (${sanitized})`)();
    if (typeof result === 'number' && isFinite(result)) {
      return String(Math.round(result * 1e6) / 1e6);
    }
  } catch {
    /* not valid math */
  }
  return null;
}

/* ── Main Component ────────────────────────────────────────────── */

export default function CommandPalette({
  open,
  onClose,
  onExecute,
  context,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const parseTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* Focus input when opened */
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  /* Global keyboard shortcut Ctrl+K / Cmd+K */
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) {
          /* parent controls open state — just prevent default */
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [open]);

  /* NLP parsing indicator debounce */
  useEffect(() => {
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    if (query.length > 3) {
      setIsParsing(true);
      parseTimerRef.current = setTimeout(() => setIsParsing(false), 600);
    } else {
      setIsParsing(false);
    }
    return () => {
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    };
  }, [query]);

  /* Filter and score commands */
  const filteredResults = useMemo(() => {
    if (!query.trim()) return [];
    return ALL_COMMANDS
      .map(cmd => ({
        ...cmd,
        score: Math.max(
          fuzzyMatch(query, cmd.label),
          fuzzyMatch(query, cmd.description),
          fuzzyMatch(query, cmd.category),
        ),
      }))
      .filter(cmd => cmd.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query]);

  /* Group by category */
  const grouped = useMemo(() => {
    const groups: Record<string, CommandResult[]> = {};
    for (const r of filteredResults) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return groups;
  }, [filteredResults]);

  /* Flat list for keyboard navigation */
  const flatResults = useMemo(() => {
    const flat: CommandResult[] = [];
    for (const cat of Object.keys(grouped)) {
      flat.push(...grouped[cat]);
    }
    return flat;
  }, [grouped]);

  const mathResult = useMemo(() => tryMath(query), [query]);

  /* Keyboard navigation */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = flatResults.length + (mathResult ? 1 : 0);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % Math.max(totalItems, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (mathResult && selectedIndex === 0 && flatResults.length === 0) {
          /* math result — just copy or display */
          return;
        }
        const cmd = flatResults[selectedIndex];
        if (cmd) {
          execute(cmd.action);
        } else if (query.trim()) {
          execute(`nlp:${query.trim()}`);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [flatResults, selectedIndex, mathResult, query, onClose],
  );

  const execute = (action: string) => {
    setRecentCommands(prev => [action, ...prev.filter(a => a !== action)].slice(0, 8));
    onExecute(action, query);
    onClose();
  };

  /* Scroll selected item into view */
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  /* Reset index when results change */
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const showRecent = !query.trim() && recentCommands.length > 0;
  const showEmpty = query.trim() && flatResults.length === 0 && !mathResult;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className={`${panel} relative w-full max-w-2xl overflow-hidden shadow-2xl shadow-black/50`}>
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="w-5 h-5 text-white/40 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search, or calculation..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {isParsing && (
            <Brain className="w-4 h-4 text-yellow-400 animate-spin shrink-0" />
          )}
          <div className="flex items-center gap-1 text-[10px] text-white/30 shrink-0">
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">esc</kbd>
          </div>
        </div>

        {/* Results area */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {/* Math result */}
          {mathResult && (
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <div className="flex-1">
                  <p className="text-xs text-white/40">Quick Math</p>
                  <p className="text-lg text-emerald-400 font-mono font-medium">{mathResult}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recent commands (when empty) */}
          {showRecent && (
            <div className="px-2 py-2">
              <p className="px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wider">
                Recent Commands
              </p>
              {recentCommands.map((action, i) => {
                const cmd = ALL_COMMANDS.find(c => c.action === action);
                return (
                  <button
                    key={action}
                    onClick={() => execute(action)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      i === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-white/30" />
                    <span className="text-sm text-white/60">
                      {cmd?.label ?? action}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* No input, no recent */}
          {!query.trim() && recentCommands.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Command className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/30">
                Type anything: &quot;go to the forge&quot;, &quot;find beams rated seismic 7&quot;, &quot;earthquake 6.5&quot;
              </p>
              <p className="text-[10px] text-white/20 mt-1">
                Navigation, building, simulation, social, and more
              </p>
            </div>
          )}

          {/* Grouped results */}
          {Object.entries(grouped).map(([cat, results]) => {
            const meta = CATEGORY_META[cat as CommandCategory];
            return (
              <div key={cat} className="px-2 py-1">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className={meta.color}>{meta.icon}</span>
                  <span className={`text-[10px] uppercase tracking-wider ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                {results.map(result => {
                  const globalIdx = flatResults.indexOf(result);
                  const isSelected = globalIdx === selectedIndex;
                  return (
                    <button
                      key={result.id}
                      data-index={globalIdx}
                      onClick={() => execute(result.action)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className={`${meta.color} shrink-0`}>{result.icon}</span>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-sm ${isSelected ? 'text-white' : 'text-white/70'}`}>
                          {result.label}
                        </p>
                        <p className="text-[10px] text-white/35 truncate">{result.description}</p>
                      </div>
                      {result.shortcut && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {result.shortcut.split(' ').map((key, ki) => (
                            <kbd
                              key={ki}
                              className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      )}
                      {isSelected && (
                        <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* NLP fallback when no exact matches */}
          {showEmpty && (
            <div className="px-4 py-6 text-center">
              <Brain className={`w-6 h-6 mx-auto mb-2 ${isParsing ? 'text-yellow-400 animate-spin' : 'text-white/20'}`} />
              <p className="text-sm text-white/40">
                {isParsing ? 'Parsing natural language...' : 'Press Enter to execute as natural language command'}
              </p>
              <p className="text-[10px] text-white/25 mt-1 font-mono">&quot;{query}&quot;</p>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-white/25">
          <span className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
            <ArrowDown className="w-3 h-3" />
            navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />
            execute
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white/5 rounded">esc</kbd>
            close
          </span>
          {context?.currentDistrict && (
            <span className="ml-auto text-white/20">
              Context: {context.currentDistrict}
              {context.isBuilding ? ' (building)' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
