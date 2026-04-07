'use client';

import React, { useState } from 'react';
import { LensProvider, useLensContext } from './LensProvider';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UniversalLensLayoutProps {
  domain: string;
  title: string;
  icon?: React.ReactNode;
  sidebar?: React.ReactNode;
  contextPanel?: React.ReactNode;
  statusBar?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  layout?: 'default' | 'split' | 'full' | 'minimal';
  searchable?: boolean;
  onSearch?: (query: string) => void;
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

function Breadcrumbs({ domain, title }: { domain: string; title: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-white/50">
      <span className="hover:text-white/80 cursor-pointer">Home</span>
      <span>/</span>
      <span className="hover:text-white/80 cursor-pointer capitalize">{domain}</span>
      <span>/</span>
      <span className="text-white/90 font-medium">{title}</span>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Search bar
// ---------------------------------------------------------------------------

function SearchBar({ onSearch }: { onSearch?: (query: string) => void }) {
  const [query, setQuery] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(query);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="w-64 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/25 focus:ring-1 focus:ring-white/25 transition"
      />
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner layout (has access to LensContext)
// ---------------------------------------------------------------------------

function LayoutInner({
  title,
  icon,
  sidebar,
  contextPanel,
  statusBar,
  actions,
  children,
  layout = 'default',
  searchable = false,
  onSearch,
}: Omit<UniversalLensLayoutProps, 'domain'>) {
  const { domain } = useLensContext();

  const showSidebar = layout === 'default' || layout === 'split';
  const showContext = layout === 'default' || layout === 'split';
  const showStatus = layout !== 'minimal';

  return (
    <div className="flex h-full min-h-screen flex-col bg-black text-white">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-3">
          {icon && <span className="text-xl">{icon}</span>}
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            <Breadcrumbs domain={domain} title={title} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {searchable && <SearchBar onSearch={onSearch} />}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>

      {/* ---- Body ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        {showSidebar && sidebar && (
          <aside className="w-60 shrink-0 overflow-y-auto border-r border-white/10 bg-white/[0.02] p-4">
            {sidebar}
          </aside>
        )}

        {/* Main content */}
        <main
          className={`flex-1 overflow-y-auto p-6 ${
            layout === 'full' ? 'max-w-none' : 'max-w-7xl mx-auto w-full'
          }`}
        >
          {children}
        </main>

        {/* Right context panel */}
        {showContext && contextPanel && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-white/[0.02] p-4">
            {contextPanel}
          </aside>
        )}
      </div>

      {/* ---- Status / bottom bar ---- */}
      {showStatus && statusBar && (
        <footer className="border-t border-white/10 bg-white/[0.02] px-6 py-2 text-sm text-white/60">
          {statusBar}
        </footer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component — wraps inner layout with LensProvider
// ---------------------------------------------------------------------------

export function UniversalLensLayout(props: UniversalLensLayoutProps) {
  const { domain, ...rest } = props;

  return (
    <LensProvider domain={domain}>
      <LayoutInner {...rest} />
    </LensProvider>
  );
}

export default UniversalLensLayout;
