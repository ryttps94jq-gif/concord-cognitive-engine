'use client';

import React, { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandDef {
  name: string;
  description: string;
  usage: string;
}

interface OutputLine {
  id: number;
  type: 'input' | 'text' | 'table' | 'json' | 'progress' | 'error' | 'success' | 'link' | 'blank';
  content: string;
}

// ---------------------------------------------------------------------------
// Command Registry (20 commands)
// ---------------------------------------------------------------------------

const COMMANDS: CommandDef[] = [
  { name: 'login', description: 'Authenticate with Concord identity', usage: 'login <username>' },
  { name: 'world', description: 'Display or switch active world context', usage: 'world [name]' },
  { name: 'district', description: 'List, inspect, or create districts', usage: 'district [list|create|inspect <id>]' },
  { name: 'install', description: 'Install a DTU package from the registry', usage: 'install <package@version>' },
  { name: 'publish', description: 'Publish current DTU to the registry', usage: 'publish [--public|--private]' },
  { name: 'search', description: 'Search the DTU registry', usage: 'search <query> [--type <t>]' },
  { name: 'build', description: 'Compile and validate DTU source', usage: 'build [--release]' },
  { name: 'validate', description: 'Run structural and semantic validation', usage: 'validate [<dtu-id>]' },
  { name: 'status', description: 'Show current world and session status', usage: 'status' },
  { name: 'lens', description: 'Open or configure a World Lens view', usage: 'lens [open|config] <lens-name>' },
  { name: 'npc', description: 'Manage NPCs: spawn, list, or inspect', usage: 'npc [list|spawn|inspect <id>]' },
  { name: 'stress-test', description: 'Run environmental stress simulations', usage: 'stress-test <scenario> --magnitude <n>' },
  { name: 'export', description: 'Export DTU to fabrication format', usage: 'export <format> [--machine <profile>]' },
  { name: 'sensor', description: 'Manage and query IoT sensors', usage: 'sensor [list|read <id>|alert]' },
  { name: 'notarize', description: 'Anchor DTU hash to blockchain', usage: 'notarize [--chain <base|arbitrum|polygon>]' },
  { name: 'agent', description: 'Interact with Concord AI agents', usage: 'agent [list|invoke <name>] <prompt>' },
  { name: 'diff', description: 'Show DTU version differences', usage: 'diff <rev1> <rev2>' },
  { name: 'history', description: 'Show revision history for a DTU', usage: 'history [<dtu-id>]' },
  { name: 'cert', description: 'Manage certificates and trust anchors', usage: 'cert [list|issue|revoke]' },
  { name: 'help', description: 'Show available commands', usage: 'help [<command>]' },
];

// ---------------------------------------------------------------------------
// Seed Outputs
// ---------------------------------------------------------------------------

function buildHelpOutput(): OutputLine[] {
  const lines: OutputLine[] = [
    { id: 0, type: 'text', content: '' },
    { id: 1, type: 'text', content: '  Concord Shell v2.4.0 — Available Commands' },
    { id: 2, type: 'text', content: '  ─────────────────────────────────────────' },
    { id: 3, type: 'blank', content: '' },
  ];
  let id = 4;
  COMMANDS.forEach(cmd => {
    lines.push({
      id: id++,
      type: 'text',
      content: `  ${cmd.name.padEnd(16)} ${cmd.description}`,
    });
  });
  lines.push({ id: id++, type: 'blank', content: '' });
  lines.push({
    id: id++,
    type: 'text',
    content: '  Type "help <command>" for detailed usage.',
  });
  lines.push({ id: id++, type: 'blank', content: '' });
  return lines;
}

function buildStatusOutput(): OutputLine[] {
  return [
    { id: 0, type: 'blank', content: '' },
    { id: 1, type: 'success', content: '  Concord Status' },
    { id: 2, type: 'text', content: '  ──────────────' },
    { id: 3, type: 'blank', content: '' },
    { id: 4, type: 'text', content: '  World:          Arcadia Prime' },
    { id: 5, type: 'text', content: '  Districts:      14 loaded, 3 pending sync' },
    { id: 6, type: 'text', content: '  DTUs:           2,847 registered' },
    { id: 7, type: 'text', content: '  Active Users:   38 online' },
    { id: 8, type: 'text', content: '  NPCs:           126 spawned' },
    { id: 9, type: 'text', content: '  Sensors:        4 connected (1 offline)' },
    { id: 10, type: 'text', content: '  Notarizations:  217 confirmed on-chain' },
    { id: 11, type: 'text', content: '  Build:          v2.4.0-rc3 (stable)' },
    { id: 12, type: 'text', content: '  Uptime:         14d 7h 22m' },
    { id: 13, type: 'blank', content: '' },
    { id: 14, type: 'json', content: JSON.stringify({ latency: '12ms', memoryMB: 384, cpuPct: 22.1 }, null, 2) },
    { id: 15, type: 'blank', content: '' },
  ];
}

function buildSearchOutput(): OutputLine[] {
  return [
    { id: 0, type: 'blank', content: '' },
    { id: 1, type: 'text', content: '  Search results for "beam":' },
    { id: 2, type: 'blank', content: '' },
    { id: 3, type: 'table', content: '  #   Package                  Version   Downloads   Author' },
    { id: 4, type: 'table', content: '  ─── ──────────────────────── ───────── ─────────── ──────────────' },
    { id: 5, type: 'table', content: '  1   @struct/steel-beam        3.1.0     12,480      structworks' },
    { id: 6, type: 'table', content: '  2   @arch/glulam-beam         1.7.2      4,210      timberlab' },
    { id: 7, type: 'table', content: '  3   @mech/laser-beam-assy     0.9.1        891      photon-eng' },
    { id: 8, type: 'blank', content: '' },
    { id: 9, type: 'text', content: '  3 results found. Use "install <package>" to add.' },
    { id: 10, type: 'blank', content: '' },
  ];
}

function buildUnknownOutput(cmd: string): OutputLine[] {
  return [
    { id: 0, type: 'error', content: `  Unknown command: "${cmd}". Type "help" for available commands.` },
  ];
}

function buildCommandHelpOutput(cmd: CommandDef): OutputLine[] {
  return [
    { id: 0, type: 'blank', content: '' },
    { id: 1, type: 'success', content: `  ${cmd.name}` },
    { id: 2, type: 'text', content: `  ${cmd.description}` },
    { id: 3, type: 'blank', content: '' },
    { id: 4, type: 'text', content: `  Usage: ${cmd.usage}` },
    { id: 5, type: 'blank', content: '' },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const panel = 'bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg';

function formatOutputLine(line: OutputLine) {
  switch (line.type) {
    case 'input':
      return <span className="text-green-400">{line.content}</span>;
    case 'error':
      return <span className="text-red-400">{line.content}</span>;
    case 'success':
      return <span className="text-green-400 font-bold">{line.content}</span>;
    case 'table':
      return <span className="text-cyan-300">{line.content}</span>;
    case 'json':
      return (
        <span className="text-yellow-300/80">
          {line.content.split('\n').map((l, i) => (
            <span key={i}>
              {'  '}{l}
              {'\n'}
            </span>
          ))}
        </span>
      );
    case 'progress':
      return <span className="text-cyan-400">{line.content}</span>;
    case 'link':
      return (
        <span className="text-blue-400 underline cursor-pointer hover:text-blue-300">
          {line.content}
        </span>
      );
    case 'blank':
      return <span>{'\u00A0'}</span>;
    default:
      return <span className="text-white/70">{line.content}</span>;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConcordTerminal() {
  const [outputLines, setOutputLines] = useState<OutputLine[]>(() => {
    // Boot message
    return [
      { id: 0, type: 'success', content: '  Concord Shell v2.4.0' },
      { id: 1, type: 'text', content: '  Connected to Arcadia Prime. Type "help" to get started.' },
      { id: 2, type: 'blank', content: '' },
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTabComplete, setShowTabComplete] = useState(false);
  const [nextId, setNextId] = useState(100);

  // Tab completion candidates
  const tabCandidates = useMemo(() => {
    if (!inputValue.trim()) return [];
    const lower = inputValue.toLowerCase().trim();
    return COMMANDS.filter(c => c.name.startsWith(lower)).map(c => c.name);
  }, [inputValue]);

  // Process command
  const executeCommand = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    let id = nextId;
    const newLines: OutputLine[] = [
      { id: id++, type: 'input', content: `> concord ${trimmed}` },
    ];

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (cmd === 'help' && !args) {
      newLines.push(...buildHelpOutput().map(l => ({ ...l, id: id++ })));
    } else if (cmd === 'help' && args) {
      const found = COMMANDS.find(c => c.name === args.toLowerCase());
      if (found) {
        newLines.push(...buildCommandHelpOutput(found).map(l => ({ ...l, id: id++ })));
      } else {
        newLines.push({ id: id++, type: 'error', content: `  No help for unknown command "${args}".` });
      }
    } else if (cmd === 'status') {
      newLines.push(...buildStatusOutput().map(l => ({ ...l, id: id++ })));
    } else if (cmd === 'search' && args.toLowerCase().includes('beam')) {
      newLines.push(...buildSearchOutput().map(l => ({ ...l, id: id++ })));
    } else if (cmd === 'search') {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'text', content: `  Searching registry for "${args}"...` },
        { id: id++, type: 'text', content: '  0 results found.' },
        { id: id++, type: 'blank', content: '' },
      );
    } else if (cmd === 'clear') {
      setOutputLines([]);
      setNextId(id);
      setCommandHistory(prev => [...prev, trimmed]);
      setHistoryIndex(-1);
      setInputValue('');
      return;
    } else if (cmd === 'world') {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'text', content: '  Active World: Arcadia Prime' },
        { id: id++, type: 'text', content: '  Region:       Northern Hemisphere' },
        { id: id++, type: 'text', content: '  Scale:        1:1000' },
        { id: id++, type: 'text', content: '  Created:      2026-01-15' },
        { id: id++, type: 'blank', content: '' },
      );
    } else if (cmd === 'district' && (!args || args === 'list')) {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'table', content: '  ID              Name                 Status      DTUs' },
        { id: id++, type: 'table', content: '  ─────────────── ──────────────────── ─────────── ─────' },
        { id: id++, type: 'table', content: '  dist-001        Downtown Core        active      312' },
        { id: id++, type: 'table', content: '  dist-002        Harbor Quarter       active      187' },
        { id: id++, type: 'table', content: '  dist-003        University Campus    syncing      94' },
        { id: id++, type: 'table', content: '  dist-007        Skyline Heights      active      421' },
        { id: id++, type: 'blank', content: '' },
      );
    } else if (cmd === 'build') {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'progress', content: '  [████████████████████] 100%  Compiled 24 DTUs' },
        { id: id++, type: 'success', content: '  Build succeeded. 0 errors, 2 warnings.' },
        { id: id++, type: 'text', content: '  Warnings:' },
        { id: id++, type: 'text', content: '    - dtu-facade-panel-19: unused material slot "glass_alt"' },
        { id: id++, type: 'text', content: '    - dtu-pipe-west-12: deprecated joint type "ball_v1"' },
        { id: id++, type: 'blank', content: '' },
      );
    } else if (cmd === 'validate') {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'progress', content: '  [████████████████████] 100%  Validation complete' },
        { id: id++, type: 'success', content: '  All checks passed.' },
        { id: id++, type: 'text', content: '  Structural:  OK' },
        { id: id++, type: 'text', content: '  Semantic:    OK' },
        { id: id++, type: 'text', content: '  References:  OK (14 external DTUs resolved)' },
        { id: id++, type: 'blank', content: '' },
      );
    } else if (cmd === 'login') {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'success', content: `  Authenticated as ${args || 'anonymous'}.` },
        { id: id++, type: 'text', content: '  Session expires in 24h.' },
        { id: id++, type: 'blank', content: '' },
      );
    } else if (cmd === 'history') {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'table', content: '  Rev   Author          Date                 Message' },
        { id: id++, type: 'table', content: '  ───── ─────────────── ──────────────────── ─────────────────────────────' },
        { id: id++, type: 'table', content: '  r14   alice           2026-04-04 18:22     Adjusted facade panel angles' },
        { id: id++, type: 'table', content: '  r13   bob             2026-04-03 10:05     Reinforced bridge span joints' },
        { id: id++, type: 'table', content: '  r12   alice           2026-04-01 22:41     Initial tower geometry' },
        { id: id++, type: 'blank', content: '' },
      );
    } else if (cmd === 'sensor' && (!args || args === 'list')) {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'table', content: '  ID              Name                      Status    Anomalies' },
        { id: id++, type: 'table', content: '  ─────────────── ───────────────────────── ───────── ─────────' },
        { id: id++, type: 'table', content: '  dev-ws-alpha    Weather Station Alpha     online    0' },
        { id: id++, type: 'table', content: '  dev-struct-b7   Structural Monitor B7     warning   3' },
        { id: id++, type: 'table', content: '  dev-energy-g3   Energy Meter Grid-3       online    1' },
        { id: id++, type: 'table', content: '  dev-water-w12   Water Flow Sensor W-12    offline   5' },
        { id: id++, type: 'blank', content: '' },
      );
    } else if (COMMANDS.some(c => c.name === cmd)) {
      newLines.push(
        { id: id++, type: 'blank', content: '' },
        { id: id++, type: 'text', content: `  [${cmd}] executed successfully.` },
        { id: id++, type: 'blank', content: '' },
      );
    } else {
      newLines.push(...buildUnknownOutput(cmd).map(l => ({ ...l, id: id++ })));
    }

    setOutputLines(prev => [...prev, ...newLines]);
    setNextId(id);
    setCommandHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInputValue('');
    setShowTabComplete(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(inputValue);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (tabCandidates.length === 1) {
        setInputValue(tabCandidates[0] + ' ');
        setShowTabComplete(false);
      } else if (tabCandidates.length > 1) {
        setShowTabComplete(true);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        setInputValue(commandHistory[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIdx = historyIndex + 1;
        if (newIdx >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue('');
        } else {
          setHistoryIndex(newIdx);
          setInputValue(commandHistory[newIdx]);
        }
      }
    } else {
      setShowTabComplete(false);
    }
  };

  const clearTerminal = () => {
    setOutputLines([]);
  };

  // History navigation buttons (for environments without keyboard)
  const navigateHistory = (direction: 'up' | 'down') => {
    if (direction === 'up' && commandHistory.length > 0) {
      const newIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIdx);
      setInputValue(commandHistory[newIdx]);
    } else if (direction === 'down') {
      if (historyIndex >= 0) {
        const newIdx = historyIndex + 1;
        if (newIdx >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue('');
        } else {
          setHistoryIndex(newIdx);
          setInputValue(commandHistory[newIdx]);
        }
      }
    }
  };

  return (
    <div
      className={`${isFullscreen ? 'fixed inset-0 z-50' : ''} ${panel} flex flex-col text-white ${
        isFullscreen ? 'rounded-none' : 'max-w-3xl'
      }`}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs font-mono text-white/40 ml-2">concord-shell</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearTerminal}
            className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Output area */}
      <div
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed bg-black min-h-[300px] max-h-[500px]"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
      >
        {outputLines.map(line => (
          <div key={line.id} className="whitespace-pre-wrap">
            {formatOutputLine(line)}
          </div>
        ))}

        {/* Tab completion popup */}
        {showTabComplete && tabCandidates.length > 1 && (
          <div className="mt-1 p-2 rounded bg-white/5 border border-white/10 inline-block">
            <div className="text-[11px] text-white/30 mb-1">Tab completions:</div>
            <div className="flex flex-wrap gap-2">
              {tabCandidates.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    setInputValue(c + ' ');
                    setShowTabComplete(false);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-mono"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2">
          {/* History navigation buttons */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => navigateHistory('up')}
              className="text-[10px] px-1 leading-none text-white/30 hover:text-white/60"
              title="Previous command"
            >
              ▲
            </button>
            <button
              onClick={() => navigateHistory('down')}
              className="text-[10px] px-1 leading-none text-white/30 hover:text-white/60"
              title="Next command"
            >
              ▼
            </button>
          </div>

          <span className="text-green-400 font-mono text-sm whitespace-nowrap">
            {'>'} concord
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="type a command..."
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-white placeholder:text-white/20 caret-green-400"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* Command history display */}
        {commandHistory.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-white/20">History:</span>
            {commandHistory.slice(-5).map((cmd, i) => (
              <button
                key={i}
                onClick={() => setInputValue(cmd)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/30 hover:text-white/60 transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
