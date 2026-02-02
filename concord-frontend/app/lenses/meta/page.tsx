'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Wand2, Layout, Code, Eye, Palette, Settings } from 'lucide-react';

interface LensTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  components: string[];
}

export default function MetaLensPage() {
  useLensNav('meta');
  const [lensName, setLensName] = useState('');
  const [lensDescription, setLensDescription] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);

  const templates: LensTemplate[] = [
    { id: 't-data', name: 'Data Viewer', description: 'Display and filter DTU data', category: 'display', components: ['DataGrid', 'FilterBar', 'Pagination'] },
    { id: 't-viz', name: 'Visualization', description: 'Charts and graphs', category: 'display', components: ['Graph', 'Legend', 'Controls'] },
    { id: 't-form', name: 'Form Builder', description: 'Input and submission', category: 'input', components: ['Form', 'Validation', 'Submit'] },
    { id: 't-dash', name: 'Dashboard', description: 'Metrics overview', category: 'display', components: ['MetricCards', 'Charts', 'Activity'] },
  ];

  const componentLibrary = [
    { id: 'c-grid', name: 'DataGrid', icon: Layout },
    { id: 'c-chart', name: 'Chart', icon: Eye },
    { id: 'c-form', name: 'Form', icon: Settings },
    { id: 'c-code', name: 'CodeView', icon: Code },
    { id: 'c-theme', name: 'ThemePicker', icon: Palette },
  ];

  const toggleComponent = (id: string) => {
    setSelectedComponents((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🔨</span>
        <div>
          <h1 className="text-xl font-bold">Meta Lens</h1>
          <p className="text-sm text-gray-400">
            Builder for custom lenses - extend the lensbuilder/forge
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Wand2 className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{templates.length}</p>
          <p className="text-sm text-gray-400">Templates</p>
        </div>
        <div className="lens-card">
          <Layout className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{componentLibrary.length}</p>
          <p className="text-sm text-gray-400">Components</p>
        </div>
        <div className="lens-card">
          <Code className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">50+</p>
          <p className="text-sm text-gray-400">Existing Lenses</p>
        </div>
        <div className="lens-card">
          <Eye className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">Live</p>
          <p className="text-sm text-gray-400">Preview</p>
        </div>
      </div>

      {/* Lens Builder */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-neon-purple" />
          Create New Lens
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Lens Name</label>
            <input
              type="text"
              value={lensName}
              onChange={(e) => setLensName(e.target.value)}
              placeholder="My Custom Lens"
              className="input-lattice w-full"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Description</label>
            <input
              type="text"
              value={lensDescription}
              onChange={(e) => setLensDescription(e.target.value)}
              placeholder="What does this lens do?"
              className="input-lattice w-full"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm text-gray-400 block mb-2">Select Components</label>
          <div className="flex flex-wrap gap-2">
            {componentLibrary.map((comp) => {
              const Icon = comp.icon;
              const selected = selectedComponents.includes(comp.id);
              return (
                <button
                  key={comp.id}
                  onClick={() => toggleComponent(comp.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    selected
                      ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                      : 'bg-lattice-surface text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {comp.name}
                </button>
              );
            })}
          </div>
        </div>

        <button
          disabled={!lensName || selectedComponents.length === 0}
          className="btn-neon purple w-full"
        >
          <Code className="w-4 h-4 mr-2 inline" />
          Generate Lens Code
        </button>
      </div>

      {/* Templates */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Layout className="w-4 h-4 text-neon-blue" />
          Starter Templates
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                setLensName(template.name);
                setLensDescription(template.description);
              }}
              className="lens-card text-left hover:border-neon-cyan"
            >
              <p className="font-semibold mb-1">{template.name}</p>
              <p className="text-xs text-gray-400 mb-2">{template.description}</p>
              <div className="flex flex-wrap gap-1">
                {template.components.map((c) => (
                  <span key={c} className="text-xs px-1.5 py-0.5 bg-lattice-surface rounded">
                    {c}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
