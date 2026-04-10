'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { Scale, Gavel, FileText, CheckCircle, XCircle, AlertTriangle, Plus, Layers, ChevronDown, BookOpen, Shield, Users, Clock, Copy, Globe, Calendar, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorState } from '@/components/common/EmptyState';
import { api } from '@/lib/api/client';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';
import { ConnectiveTissueBar } from '@/components/lens/ConnectiveTissueBar';
import { showToast } from '@/components/common/Toasts';

const JURISDICTIONS = ['US', 'EU', 'UK', 'CA', 'AU', 'INT'] as const;
type Jurisdiction = typeof JURISDICTIONS[number];

const JURISDICTION_COLORS: Record<Jurisdiction, string> = {
  US:  'bg-blue-400/15 border-blue-400/30 text-blue-400',
  EU:  'bg-indigo-400/15 border-indigo-400/30 text-indigo-400',
  UK:  'bg-purple-400/15 border-purple-400/30 text-purple-400',
  CA:  'bg-red-400/15 border-red-400/30 text-red-400',
  AU:  'bg-yellow-400/15 border-yellow-400/30 text-yellow-400',
  INT: 'bg-teal-400/15 border-teal-400/30 text-teal-400',
};

const CASE_STATUSES = ['open', 'in-review', 'hearing', 'closed'] as const;
type CaseStatus = typeof CASE_STATUSES[number];

const STATUS_COLORS: Record<CaseStatus, string> = {
  'open':      'bg-blue-400/15 border-blue-400/30 text-blue-400',
  'in-review': 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400',
  'hearing':   'bg-orange-400/15 border-orange-400/30 text-orange-400',
  'closed':    'bg-green-400/15 border-green-400/30 text-green-400',
};

// Days until deadline countdown
function deadlineDays(deadlineStr: string): number | null {
  if (!deadlineStr) return null;
  const diff = new Date(deadlineStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function LawLensPage() {
  useLensNav('law');
  const [testProposal, setTestProposal] = useState('');
  const [gateResult, setGateResult] = useState<{ passed: boolean; reasons: string[] } | null>(null);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseJurisdiction, setNewCaseJurisdiction] = useState<Jurisdiction>('US');
  const [newCaseDeadline, setNewCaseDeadline] = useState('');
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState(true);
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('law');

  // Lens artifact persistence layer
  const { isLoading, isError: isError, error: error, refetch: refetch, items: caseItems, create: createCase } = useLensData('law', 'case', { noSeed: true });

  const legalFrameworks = [
    { id: 'gdpr', name: 'GDPR', status: 'compliant', description: 'EU data protection' },
    { id: 'ccpa', name: 'CCPA', status: 'compliant', description: 'California privacy' },
    { id: 'ai-act', name: 'EU AI Act', status: 'review', description: 'AI regulations' },
    { id: 'dmca', name: 'DMCA', status: 'compliant', description: 'Copyright law' },
  ];

  const handleCreateCase = () => {
    if (!newCaseTitle.trim()) return;
    createCase({
      title: newCaseTitle,
      data: {
        jurisdiction: newCaseJurisdiction,
        frameworks: ['GDPR', 'CCPA', 'DMCA'],
        deadline: newCaseDeadline || null,
        timeline: [
          { label: 'Filed', date: new Date().toISOString(), done: true },
          { label: 'Review', date: '', done: false },
          { label: 'Hearing', date: '', done: false },
          { label: 'Ruling', date: '', done: false },
        ],
      },
      meta: { status: 'open' },
    });
    setNewCaseTitle('');
    setNewCaseDeadline('');
  };

  const handleGateCheck = () => {
    const lower = testProposal.toLowerCase();
    const violations: string[] = [];

    if (lower.includes('personal data') && lower.includes('sell')) {
      violations.push('GDPR Art. 6: Unlawful processing');
    }
    if (lower.includes('copyright') && lower.includes('bypass')) {
      violations.push('DMCA §1201: Circumvention');
    }
    if (lower.includes('discriminat')) {
      violations.push('EU AI Act: Prohibited practice');
    }

    setGateResult({
      passed: violations.length === 0,
      reasons: violations.length > 0 ? violations : ['No legal violations detected'],
    });
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div data-lens-theme="law" className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">⚖️</span>
        <div>
          <h1 className="text-xl font-bold">Law Lens</h1>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          <p className="text-sm text-gray-400">
            Legality gate playground for compliance testing
          </p>
        </div>
      </header>

      <RealtimeDataPanel domain="law" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <UniversalActions domain="law" artifactId={null} compact />
      <DTUExportButton domain="law" data={{}} compact />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Scale className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{legalFrameworks.length}</p>
          <p className="text-sm text-gray-400">Frameworks</p>
        </div>
        <div className="lens-card">
          <CheckCircle className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{legalFrameworks.filter((f) => f.status === 'compliant').length}</p>
          <p className="text-sm text-gray-400">Compliant</p>
        </div>
        <div className="lens-card">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mb-2" />
          <p className="text-2xl font-bold">{legalFrameworks.filter((f) => f.status === 'review').length}</p>
          <p className="text-sm text-gray-400">Under Review</p>
        </div>
        <div className="lens-card">
          <Gavel className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">Active</p>
          <p className="text-sm text-gray-400">Gate Status</p>
        </div>
      </div>

      {/* Legality Gate Tester */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Gavel className="w-4 h-4 text-neon-purple" />
          Legality Gate Tester
        </h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={testProposal}
            onChange={(e) => setTestProposal(e.target.value)}
            placeholder="Describe a proposed action..."
            className="input-lattice flex-1"
          />
          <button onClick={handleGateCheck} className="btn-neon purple">
            Check Gate
          </button>
        </div>
        {gateResult && (
          <div className={`p-4 rounded-lg ${gateResult.passed ? 'bg-neon-green/20' : 'bg-neon-pink/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              {gateResult.passed ? (
                <CheckCircle className="w-5 h-5 text-neon-green" />
              ) : (
                <XCircle className="w-5 h-5 text-neon-pink" />
              )}
              <span className={gateResult.passed ? 'text-neon-green' : 'text-neon-pink'}>
                {gateResult.passed ? 'GATE PASSED' : 'GATE BLOCKED'}
              </span>
            </div>
            <ul className="text-sm space-y-1">
              {gateResult.reasons.map((r, i) => (
                <li key={i} className="text-gray-300">• {r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Case Files */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-neon-cyan" />
          Case Files
        </h2>

        {/* Status filter */}
        <div className="flex items-center gap-2 mb-4">
          {CASE_STATUSES.map(s => (
            <button key={s} onClick={() => setExpandedCase(null)} className={`text-[10px] px-2 py-1 rounded border font-medium ${STATUS_COLORS[s] || 'bg-gray-500/15 border-gray-500/30 text-gray-400'}`}>{s}</button>
          ))}
        </div>

        {/* New case form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
          <input
            type="text"
            value={newCaseTitle}
            onChange={(e) => setNewCaseTitle(e.target.value)}
            placeholder="Case title..."
            className="input-lattice md:col-span-2"
          />
          <select
            value={newCaseJurisdiction}
            onChange={e => setNewCaseJurisdiction(e.target.value as Jurisdiction)}
            className="input-lattice"
          >
            {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={newCaseDeadline}
              onChange={e => setNewCaseDeadline(e.target.value)}
              className="input-lattice flex-1 text-xs"
              title="Filing deadline"
            />
            <button onClick={handleCreateCase} className="btn-neon purple px-3">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {caseItems.length === 0 ? (
            <p className="text-center py-4 text-gray-500 text-sm">No case files yet</p>
          ) : (
            caseItems.map((item) => {
              const jurisdiction = (item.data as Record<string, unknown>)?.jurisdiction as Jurisdiction || 'US';
              const deadline = (item.data as Record<string, unknown>)?.deadline as string | null;
              const timeline = ((item.data as Record<string, unknown>)?.timeline as { label: string; date: string; done: boolean }[]) || [];
              const status = (item.meta?.status as CaseStatus) || 'open';
              const daysLeft = deadline ? deadlineDays(deadline) : null;
              const isExpanded = expandedCase === item.id;

              return (
                <motion.div key={item.id} layout className="lens-card overflow-hidden p-0">
                  {/* Case header */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedCase(isExpanded ? null : item.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <ChevronRight className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <p className="font-medium text-sm">{item.title}</p>
                      {/* Jurisdiction badge */}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-1 ${JURISDICTION_COLORS[jurisdiction] || JURISDICTION_COLORS.US}`}>
                        <Globe className="w-2.5 h-2.5" />
                        {jurisdiction}
                      </span>
                      {/* Status badge */}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_COLORS[status] || STATUS_COLORS.open}`}>
                        {status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Deadline countdown */}
                      {daysLeft !== null && (
                        <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                          daysLeft <= 3
                            ? 'bg-red-400/15 border-red-400/30 text-red-400'
                            : daysLeft <= 14
                            ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                            : 'bg-gray-600/20 border-gray-600/30 text-gray-400'
                        }`}>
                          <Calendar className="w-2.5 h-2.5" />
                          {daysLeft > 0 ? `${daysLeft}d` : daysLeft === 0 ? 'Today' : 'Overdue'}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Expanded: timeline */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/10 px-4 py-3 overflow-hidden"
                      >
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Case Timeline</p>
                        <div className="flex items-start gap-0">
                          {(timeline.length > 0 ? timeline : [
                            { label: 'Filed', done: true },
                            { label: 'Review', done: false },
                            { label: 'Hearing', done: false },
                            { label: 'Ruling', done: false },
                          ]).map((step, idx, arr) => (
                            <div key={step.label} className="flex-1 flex flex-col items-center">
                              <div className="flex items-center w-full">
                                {/* Line before */}
                                {idx > 0 && (
                                  <div className={`flex-1 h-0.5 ${step.done ? 'bg-neon-purple' : 'bg-white/10'}`} />
                                )}
                                {/* Node */}
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                                  step.done
                                    ? 'bg-neon-purple border-neon-purple'
                                    : idx === arr.findIndex(s => !s.done)
                                    ? 'bg-yellow-400/20 border-yellow-400'
                                    : 'bg-black/40 border-white/20'
                                }`}>
                                  {step.done ? (
                                    <CheckCircle className="w-3 h-3 text-white" />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-white/20" />
                                  )}
                                </div>
                                {/* Line after */}
                                {idx < arr.length - 1 && (
                                  <div className={`flex-1 h-0.5 ${arr[idx + 1]?.done ? 'bg-neon-purple' : 'bg-white/10'}`} />
                                )}
                              </div>
                              <p className={`text-[10px] mt-1.5 text-center ${step.done ? 'text-neon-purple' : 'text-gray-500'}`}>
                                {step.label}
                              </p>
                            </div>
                          ))}
                        </div>
                        {deadline && (
                          <div className={`mt-3 p-2 rounded-lg flex items-center gap-2 text-xs ${
                            (daysLeft ?? 99) <= 3
                              ? 'bg-red-400/10 border border-red-400/20 text-red-400'
                              : 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-400'
                          }`}>
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Filing deadline: {new Date(deadline).toLocaleDateString()}
                              {daysLeft !== null && (
                                <span className="font-semibold ml-1">
                                  ({daysLeft > 0 ? `${daysLeft} days remaining` : daysLeft === 0 ? 'Due today' : 'OVERDUE'})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Frameworks */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-neon-blue" />
          Legal Frameworks
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {legalFrameworks.map((fw) => (
            <div key={fw.id} className="lens-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{fw.name}</span>
                <span className={`w-2 h-2 rounded-full ${
                  fw.status === 'compliant' ? 'bg-neon-green' : 'bg-yellow-500'
                }`} />
              </div>
              <p className="text-xs text-gray-400">{fw.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Builder - Clause Library */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-neon-purple" />
          Contract Builder - Clause Library
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Browse and compose contracts from pre-approved clause templates. All clauses are validated against active legal frameworks.
        </p>

        {/* Clause Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {/* Data Protection Clauses */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-cyan/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-neon-cyan/10 rounded-lg">
                <Shield className="w-5 h-5 text-neon-cyan" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Data Protection</h3>
                <span className="text-[10px] text-gray-500">12 clauses available</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neon-green/20 text-neon-green">GDPR</span>
            </div>
            <div className="space-y-2">
              {['Data Processing Agreement', 'Sub-Processor Notification', 'Data Breach Response'].map((clause) => (
                <div key={clause} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <span className="text-xs text-gray-300">{clause}</span>
                  <button onClick={() => { api.post('/api/lens/run', { domain: 'law', action: 'add-clause', category: 'data-protection', clause }).then(() => showToast('success', `Added "${clause}" to contract`)).catch(() => showToast('error', `Failed to add "${clause}"`)); }} className="text-[10px] text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Intellectual Property Clauses */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-purple/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-neon-purple/10 rounded-lg">
                <Scale className="w-5 h-5 text-neon-purple" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Intellectual Property</h3>
                <span className="text-[10px] text-gray-500">8 clauses available</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neon-purple/20 text-neon-purple">DMCA</span>
            </div>
            <div className="space-y-2">
              {['IP Assignment', 'License Grant', 'Non-Compete Restriction'].map((clause) => (
                <div key={clause} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <span className="text-xs text-gray-300">{clause}</span>
                  <button onClick={() => { api.post('/api/lens/run', { domain: 'law', action: 'add-clause', category: 'intellectual-property', clause }).then(() => showToast('success', `Added "${clause}" to contract`)).catch(() => showToast('error', `Failed to add "${clause}"`)); }} className="text-[10px] text-neon-purple hover:text-neon-purple/80 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Liability Clauses */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-green/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-neon-green/10 rounded-lg">
                <Users className="w-5 h-5 text-neon-green" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Liability & Indemnity</h3>
                <span className="text-[10px] text-gray-500">6 clauses available</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neon-green/20 text-neon-green">Standard</span>
            </div>
            <div className="space-y-2">
              {['Limitation of Liability', 'Indemnification', 'Force Majeure'].map((clause) => (
                <div key={clause} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <span className="text-xs text-gray-300">{clause}</span>
                  <button onClick={() => { api.post('/api/lens/run', { domain: 'law', action: 'add-clause', category: 'liability', clause }).then(() => showToast('success', `Added "${clause}" to contract`)).catch(() => showToast('error', `Failed to add "${clause}"`)); }} className="text-[10px] text-neon-green hover:text-neon-green/80 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Termination Clauses */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-yellow-500/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Termination & Renewal</h3>
                <span className="text-[10px] text-gray-500">5 clauses available</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500">Standard</span>
            </div>
            <div className="space-y-2">
              {['Termination for Cause', 'Auto-Renewal Terms', 'Survival Provisions'].map((clause) => (
                <div key={clause} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <span className="text-xs text-gray-300">{clause}</span>
                  <button onClick={() => { api.post('/api/lens/run', { domain: 'law', action: 'add-clause', category: 'termination', clause }).then(() => showToast('success', `Added "${clause}" to contract`)).catch(() => showToast('error', `Failed to add "${clause}"`)); }} className="text-[10px] text-yellow-500 hover:text-yellow-500/80 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Document Category Color Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-500">Document categories:</span>
          {[
            { label: 'Data Protection', color: 'text-neon-cyan', dot: 'bg-neon-cyan' },
            { label: 'Intellectual Property', color: 'text-neon-purple', dot: 'bg-neon-purple' },
            { label: 'Liability', color: 'text-neon-green', dot: 'bg-neon-green' },
            { label: 'Termination', color: 'text-yellow-400', dot: 'bg-yellow-400' },
          ].map(cat => (
            <span key={cat.label} className="flex items-center gap-1 text-xs text-gray-400">
              <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
              {cat.label}
            </span>
          ))}
        </div>

        {/* Contract Assembly Status */}
        <div className="bg-black/40 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Contract Assembly</span>
            <span className="text-xs text-gray-500">0 clauses selected</span>
          </div>
          <div className="flex items-center justify-center py-6 border border-dashed border-white/10 rounded-lg">
            <p className="text-sm text-gray-500">Add clauses from the library above to start building your contract</p>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { api.post('/api/lens/run', { domain: 'law', action: 'preview-contract' }).then(() => showToast('success', 'Contract preview generated')).catch(() => showToast('error', 'Add clauses before previewing')); }} className="flex-1 py-2 rounded-lg text-xs bg-neon-purple/10 border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/20 transition-colors disabled:opacity-50" disabled>
              Preview Contract
            </button>
            <button onClick={() => { api.post('/api/lens/run', { domain: 'law', action: 'generate-document' }).then(() => showToast('success', 'Document generation started')).catch(() => showToast('error', 'Add clauses before generating')); }} className="flex-1 py-2 rounded-lg text-xs bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 transition-colors disabled:opacity-50" disabled>
              Generate Document
            </button>
          </div>
        </div>
      </div>

      <ConnectiveTissueBar lensId="ext_law" />

      {/* Lens Features */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-white transition-colors bg-white/[0.02] hover:bg-white/[0.04] rounded-lg"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Lens Features & Capabilities
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && (
          <div className="px-4 pb-4">
            <LensFeaturePanel lensId="ext_law" />
          </div>
        )}
      </div>
    </div>
  );
}
