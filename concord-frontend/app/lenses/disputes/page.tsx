'use client';

/**
 * Dispute Resolution Center — /lenses/disputes
 *
 * View and manage purchase disputes. Buyers can file disputes,
 * sellers can respond, admins can resolve.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileText,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Scale,
  Ban,
  DollarSign,
  Plus,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface Dispute {
  id: string;
  type: string;
  transactionId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  buyerStatement: string;
  sellerStatement: string | null;
  evidence: string[];
  status: 'open' | 'seller_response' | 'escalated' | 'resolved';
  resolution: 'refund' | 'no_refund' | 'partial_refund' | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Open', color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  seller_response: { label: 'Seller Responded', color: 'text-blue-400 bg-blue-400/10', icon: MessageSquare },
  escalated: { label: 'Escalated', color: 'text-orange-400 bg-orange-400/10', icon: AlertTriangle },
  resolved: { label: 'Resolved', color: 'text-green-400 bg-green-400/10', icon: CheckCircle2 },
};

const DISPUTE_TYPES = [
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'unauthorized_purchase', label: 'Unauthorized purchase' },
  { value: 'non_delivery', label: 'Non-delivery' },
  { value: 'other', label: 'Other' },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function DisputesPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-disputes'],
    queryFn: () => api.get('/api/disputes/my').then(r => r.data),
  });

  const disputes: Dispute[] = data?.disputes || [];

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Scale className="w-7 h-7 text-blue-400" />
              Dispute Resolution
            </h1>
            <p className="text-gray-400 mt-1">
              Manage purchase disputes and resolutions
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Report Problem
          </button>
        </div>

        {/* Create Form Modal */}
        <AnimatePresence>
          {showCreateForm && (
            <CreateDisputeForm
              onClose={() => setShowCreateForm(false)}
              onSuccess={() => {
                setShowCreateForm(false);
                queryClient.invalidateQueries({ queryKey: ['my-disputes'] });
              }}
            />
          )}
        </AnimatePresence>

        {/* Disputes List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No disputes</p>
            <p className="text-sm mt-1">
              If you have a problem with a purchase, click &quot;Report Problem&quot; above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map(dispute => (
              <DisputeCard
                key={dispute.id}
                dispute={dispute}
                expanded={expandedId === dispute.id}
                onToggle={() => setExpandedId(expandedId === dispute.id ? null : dispute.id)}
                onUpdate={() => queryClient.invalidateQueries({ queryKey: ['my-disputes'] })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dispute Card ─────────────────────────────────────────────────────────────

function DisputeCard({
  dispute,
  expanded,
  onToggle,
  onUpdate,
}: {
  dispute: Dispute;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: () => void;
}) {
  const statusConfig = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.open;
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      layout
      className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={cn('p-2 rounded-lg', statusConfig.color)}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-white font-medium">
              {DISPUTE_TYPES.find(t => t.value === dispute.type)?.label || dispute.type}
            </p>
            <p className="text-gray-500 text-sm">
              {dispute.amount} CC &middot; {new Date(dispute.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('text-xs px-2 py-1 rounded-full', statusConfig.color)}>
            {statusConfig.label}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-800"
          >
            <div className="px-6 py-4 space-y-4">
              {/* Buyer Statement */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your Statement</p>
                <p className="text-gray-300 text-sm">{dispute.buyerStatement}</p>
              </div>

              {/* Seller Response */}
              {dispute.sellerStatement && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Seller Response</p>
                  <p className="text-gray-300 text-sm">{dispute.sellerStatement}</p>
                </div>
              )}

              {/* Resolution */}
              {dispute.resolution && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Resolution</p>
                  <p className="text-white font-medium">
                    {dispute.resolution === 'refund' && 'Full Refund'}
                    {dispute.resolution === 'no_refund' && 'No Refund — Case Closed'}
                    {dispute.resolution === 'partial_refund' && 'Partial Refund'}
                  </p>
                  {dispute.resolvedAt && (
                    <p className="text-gray-500 text-xs mt-1">
                      Resolved {new Date(dispute.resolvedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Escalate Button */}
              {dispute.status === 'open' && (
                <EscalateButton disputeId={dispute.id} onSuccess={onUpdate} />
              )}

              {/* Evidence */}
              {dispute.evidence?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Evidence</p>
                  <div className="flex gap-2 flex-wrap">
                    {dispute.evidence.map((eid, idx) => (
                      <span key={idx} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                        {eid}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Create Dispute Form ──────────────────────────────────────────────────────

function CreateDisputeForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState('not_as_described');
  const [transactionId, setTransactionId] = useState('');
  const [statement, setStatement] = useState('');

  const mutation = useMutation({
    mutationFn: (data: { transactionId: string; type: string; statement: string }) =>
      api.post('/api/disputes/create', data).then(r => r.data),
    onSuccess: () => onSuccess(),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg mx-4"
      >
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          Report a Problem
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Transaction ID</label>
            <input
              type="text"
              value={transactionId}
              onChange={e => setTransactionId(e.target.value)}
              placeholder="tx_..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Issue Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              {DISPUTE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Describe the problem</label>
            <textarea
              value={statement}
              onChange={e => setStatement(e.target.value)}
              rows={4}
              placeholder="What went wrong?"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {mutation.isError && (
            <p className="text-red-400 text-sm flex items-center gap-1">
              <XCircle className="w-4 h-4" />
              {(mutation.error as Error)?.message || 'Failed to submit dispute'}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate({ transactionId, type, statement })}
              disabled={!transactionId || !statement || mutation.isPending}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit Dispute
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Escalate Button ──────────────────────────────────────────────────────────

function EscalateButton({
  disputeId,
  onSuccess,
}: {
  disputeId: string;
  onSuccess: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/api/disputes/${disputeId}/escalate`).then(r => r.data),
    onSuccess: () => onSuccess(),
  });

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
    >
      {mutation.isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      Escalate to Admin
    </button>
  );
}
