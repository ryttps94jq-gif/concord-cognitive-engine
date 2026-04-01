'use client';

import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Scale, Brain, MessageSquare, Shield, Gavel, BookOpen } from 'lucide-react';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { LensPageShell } from '@/components/lens/LensPageShell';

interface FrameworkData {
  name: string;
  desc: string;
  weight: number;
}

interface MoralDTUData {
  framework: string;
  position: string;
  weight: number;
}

const SEED_FRAMEWORKS: { title: string; data: { name: string; desc: string; weight: number } }[] = [];

const SEED_MORAL_DTUS: { title: string; data: { framework: string; position: string; weight: number } }[] = [];

type EthicsTab = 'frameworks' | 'dilemmas' | 'cases';

export default function EthicsLensPage() {
  const [activeTab, setActiveTab] = useState<EthicsTab>('frameworks');
  const [dilemma, setDilemma] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const { items: frameworkItems, isLoading: frameworksLoading, isError, error, refetch } = useLensData<FrameworkData>(
    'ethics',
    'framework',
    { seed: SEED_FRAMEWORKS }
  );

  const { items: moralDTUItems, isLoading: moralDTUsLoading, isError: isError2, error: error2, refetch: refetch2 } = useLensData<MoralDTUData>(
    'ethics',
    'moral-dtu',
    { seed: SEED_MORAL_DTUS }
  );

  const frameworks = frameworkItems.map((item) => ({
    id: item.id,
    name: item.title || item.data?.name || '',
    desc: item.data?.desc || '',
    weight: item.data?.weight ?? 0,
  }));

  const moralDTUs = moralDTUItems.map((item) => ({
    id: item.id,
    framework: item.data?.framework || '',
    position: item.data?.position || item.title || '',
    weight: item.data?.weight ?? 0,
  }));

  const handleAnalyzeDilemma = async () => {
    if (!dilemma.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const { data } = await apiHelpers.chat.ask(dilemma, 'ethics');
      const responseText =
        data?.answer || data?.response || data?.message || JSON.stringify(data);
      setAnalysisResult(responseText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setAnalysisResult(`Analysis failed: ${errorMessage}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <LensPageShell
      domain="ethics"
      title="Ethics Lens"
      description="Invariant simulator for moral philosophy queues"
      headerIcon={<span className="text-2xl">🧭</span>}
      isLoading={frameworksLoading || moralDTUsLoading}
      isError={isError || isError2}
      error={error || error2}
      onRetry={() => { refetch(); refetch2(); }}
    >
      {/* AI Actions */}
      <UniversalActions domain="ethics" artifactId={frameworkItems[0]?.id} compact />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {([
          { id: 'frameworks' as const, label: 'Frameworks', icon: Scale },
          { id: 'dilemmas' as const, label: 'Dilemmas', icon: Gavel },
          { id: 'cases' as const, label: 'Cases', icon: BookOpen },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-neon-purple/20 text-neon-purple border-b-2 border-neon-purple' : 'text-gray-400 hover:text-white'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Scale, label: 'Frameworks', value: frameworks.length, color: 'text-neon-purple' },
          { icon: Brain, label: 'Moral DTUs', value: moralDTUs.length, color: 'text-pink-400' },
          { icon: Heart, label: 'Coherence', value: '88%', color: 'text-neon-green' },
          { icon: Shield, label: 'Ethics Gate', value: 'Active', color: 'text-blue-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="lens-card"
          >
            <stat.icon className={`w-5 h-5 mb-2 ${stat.color}`} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-gray-400">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Ethical Framework Comparison */}
      {activeTab === 'frameworks' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Scale className="w-4 h-4 text-neon-purple" /> Framework Comparison
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { name: 'Utilitarian', color: 'border-green-500/30 bg-green-500/5', accent: 'text-green-400', principle: 'Greatest good for the greatest number', focus: 'Consequences & outcomes', strength: 'Quantifiable impact', weakness: 'Can justify harm to minorities' },
              { name: 'Deontological', color: 'border-blue-500/30 bg-blue-500/5', accent: 'text-blue-400', principle: 'Act according to moral rules & duties', focus: 'Rules & duties', strength: 'Protects individual rights', weakness: 'Rigid in edge cases' },
              { name: 'Virtue Ethics', color: 'border-purple-500/30 bg-purple-500/5', accent: 'text-purple-400', principle: 'Cultivate virtuous character traits', focus: 'Character & virtue', strength: 'Holistic moral development', weakness: 'Culturally relative' },
            ].map((fw, idx) => (
              <motion.div
                key={fw.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={`rounded-lg border p-3 space-y-2 ${fw.color}`}
              >
                <h4 className={`font-semibold text-sm ${fw.accent}`}>{fw.name}</h4>
                <p className="text-xs text-gray-400 italic">&ldquo;{fw.principle}&rdquo;</p>
                <div className="text-xs space-y-1">
                  <p className="text-gray-300"><span className="text-gray-500">Focus:</span> {fw.focus}</p>
                  <p className="text-green-400/80"><span className="text-gray-500">Strength:</span> {fw.strength}</p>
                  <p className="text-red-400/80"><span className="text-gray-500">Weakness:</span> {fw.weakness}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Dilemma Analyzer */}
      {(activeTab === 'dilemmas' || activeTab === 'cases') && (
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-neon-purple" />
          Moral Dilemma Analyzer
        </h2>
        <textarea
          value={dilemma}
          onChange={(e) => setDilemma(e.target.value)}
          placeholder="Describe an ethical dilemma for multi-framework analysis..."
          className="input-lattice w-full h-24 resize-none mb-4"
        />
        <button
          onClick={handleAnalyzeDilemma}
          disabled={analyzing || !dilemma}
          className="btn-neon purple w-full"
        >
          {analyzing ? 'Analyzing across frameworks...' : 'Analyze Dilemma'}
        </button>

        {analysisResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-lattice-deep rounded-lg border border-neon-purple/20">
            <h3 className="text-sm font-semibold text-neon-purple mb-2">Analysis Result</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{analysisResult}</p>
          </motion.div>
        )}
      </div>
      )}

      {/* Ethical Frameworks */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-neon-blue" />
          Active Frameworks
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {frameworks.map((fw) => (
            <div key={fw.id} className="lens-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{fw.name}</span>
                <span className="text-neon-cyan">{(fw.weight * 100).toFixed(0)}%</span>
              </div>
              <p className="text-sm text-gray-400 mb-2">{fw.desc}</p>
              <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
                <div className="h-full bg-neon-purple" style={{ width: `${fw.weight * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Moral DTUs */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-4 h-4 text-neon-pink" />
          Moral DTU Queue
        </h2>
        <div className="space-y-3">
          {moralDTUs.map((dtu) => (
            <div key={dtu.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
              <div>
                <p className="font-medium">{dtu.position}</p>
                <p className="text-xs text-gray-500">{dtu.framework}</p>
              </div>
              <span className="text-neon-green font-mono">{(dtu.weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </LensPageShell>
  );
}
