'use client';

import { useState, useCallback } from 'react';
import { Upload, FileJson, Database, Check, AlertTriangle, Loader2, FileText, Archive, RefreshCw } from 'lucide-react';

interface ImportJob {
  id: string;
  filename: string;
  type: 'dtus' | 'personas' | 'memories' | 'config' | 'full_backup';
  status: 'pending' | 'validating' | 'importing' | 'completed' | 'failed';
  progress: number;
  records_total: number;
  records_imported: number;
  records_skipped: number;
  records_failed: number;
  errors: string[];
  started_at: string;
  completed_at?: string;
}

interface ValidationResult {
  valid: boolean;
  type: string;
  record_count: number;
  warnings: string[];
  errors: string[];
  schema_version: string;
  compatible: boolean;
}

export default function ImportLens() {
  const [importJobs, setImportJobs] = useState<ImportJob[]>([
    {
      id: 'imp-001',
      filename: 'dtus_backup_2025-01-15.json',
      type: 'dtus',
      status: 'completed',
      progress: 100,
      records_total: 1250,
      records_imported: 1248,
      records_skipped: 2,
      records_failed: 0,
      errors: [],
      started_at: '2025-01-15T10:30:00Z',
      completed_at: '2025-01-15T10:32:45Z'
    },
    {
      id: 'imp-002',
      filename: 'personas_export.json',
      type: 'personas',
      status: 'importing',
      progress: 67,
      records_total: 45,
      records_imported: 30,
      records_skipped: 0,
      records_failed: 0,
      errors: [],
      started_at: '2025-01-16T14:00:00Z'
    }
  ]);

  const [dragActive, setDragActive] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace' | 'skip_existing'>('merge');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      // Simulate validation
      setValidationResult({
        valid: true,
        type: 'dtus',
        record_count: 500,
        warnings: ['2 records have deprecated schema fields'],
        errors: [],
        schema_version: '2.1.0',
        compatible: true
      });
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Simulate validation
      setValidationResult({
        valid: true,
        type: 'dtus',
        record_count: 500,
        warnings: ['2 records have deprecated schema fields'],
        errors: [],
        schema_version: '2.1.0',
        compatible: true
      });
    }
  };

  const startImport = () => {
    if (!selectedFile || !validationResult) return;

    const newJob: ImportJob = {
      id: `imp-${Date.now()}`,
      filename: selectedFile.name,
      type: validationResult.type as ImportJob['type'],
      status: 'importing',
      progress: 0,
      records_total: validationResult.record_count,
      records_imported: 0,
      records_skipped: 0,
      records_failed: 0,
      errors: [],
      started_at: new Date().toISOString()
    };

    setImportJobs(prev => [newJob, ...prev]);
    setSelectedFile(null);
    setValidationResult(null);
  };

  const getStatusColor = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return 'text-neon-green';
      case 'failed': return 'text-red-400';
      case 'importing': return 'text-neon-blue';
      case 'validating': return 'text-yellow-400';
      default: return 'text-void-400';
    }
  };

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return <Check className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      case 'importing':
      case 'validating':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      default: return <FileJson className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: ImportJob['type']) => {
    switch (type) {
      case 'dtus': return <FileText className="w-4 h-4" />;
      case 'full_backup': return <Archive className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  return (
    <div className="lens-container">
      <div className="lens-header">
        <div className="flex items-center gap-3">
          <Upload className="w-8 h-8 text-neon-blue" />
          <div>
            <h1 className="text-2xl font-bold text-white">Import Lens</h1>
            <p className="text-void-400">Restore data from backups and external sources</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <div className="lens-card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-neon-blue" />
            Upload Data
          </h2>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-neon-blue bg-neon-blue/10'
                : 'border-void-600 hover:border-void-500'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-neon-blue' : 'text-void-500'}`} />
            <p className="text-void-300 mb-2">
              Drag and drop your export file here
            </p>
            <p className="text-void-500 text-sm mb-4">
              Supports .json, .jsonl, .zip formats
            </p>
            <label className="btn-secondary cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept=".json,.jsonl,.zip"
                onChange={handleFileSelect}
              />
              Browse Files
            </label>
          </div>

          {/* Validation Result */}
          {validationResult && selectedFile && (
            <div className="mt-4 p-4 bg-void-800 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-neon-blue" />
                  <span className="text-white font-medium">{selectedFile.name}</span>
                </div>
                {validationResult.valid ? (
                  <span className="text-neon-green text-sm flex items-center gap-1">
                    <Check className="w-4 h-4" /> Valid
                  </span>
                ) : (
                  <span className="text-red-400 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Invalid
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-void-400">Type:</span>
                  <span className="text-white ml-2 capitalize">{validationResult.type}</span>
                </div>
                <div>
                  <span className="text-void-400">Records:</span>
                  <span className="text-white ml-2">{validationResult.record_count.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-void-400">Schema:</span>
                  <span className="text-white ml-2">v{validationResult.schema_version}</span>
                </div>
                <div>
                  <span className="text-void-400">Compatible:</span>
                  <span className={`ml-2 ${validationResult.compatible ? 'text-neon-green' : 'text-red-400'}`}>
                    {validationResult.compatible ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {validationResult.warnings.length > 0 && (
                <div className="mb-4">
                  <p className="text-yellow-400 text-sm mb-1">Warnings:</p>
                  {validationResult.warnings.map((warning, i) => (
                    <p key={i} className="text-void-400 text-sm">• {warning}</p>
                  ))}
                </div>
              )}

              {/* Import Mode */}
              <div className="mb-4">
                <label className="text-void-400 text-sm block mb-2">Import Mode:</label>
                <div className="flex gap-2">
                  {(['merge', 'replace', 'skip_existing'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setImportMode(mode)}
                      className={`px-3 py-1 rounded text-sm capitalize ${
                        importMode === mode
                          ? 'bg-neon-blue text-white'
                          : 'bg-void-700 text-void-300 hover:bg-void-600'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startImport}
                disabled={!validationResult.valid}
                className="btn-primary w-full"
              >
                Start Import
              </button>
            </div>
          )}
        </div>

        {/* Import Options */}
        <div className="lens-card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-neon-purple" />
            Quick Import
          </h2>

          <div className="space-y-3">
            <button className="w-full p-4 bg-void-800 rounded-lg hover:bg-void-700 transition-colors text-left">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-8 h-8 text-neon-blue" />
                <div>
                  <p className="text-white font-medium">Restore from Backup</p>
                  <p className="text-void-400 text-sm">Load from automatic backup point</p>
                </div>
              </div>
            </button>

            <button className="w-full p-4 bg-void-800 rounded-lg hover:bg-void-700 transition-colors text-left">
              <div className="flex items-center gap-3">
                <Archive className="w-8 h-8 text-neon-purple" />
                <div>
                  <p className="text-white font-medium">Full System Restore</p>
                  <p className="text-void-400 text-sm">Restore entire system from archive</p>
                </div>
              </div>
            </button>

            <button className="w-full p-4 bg-void-800 rounded-lg hover:bg-void-700 transition-colors text-left">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-neon-green" />
                <div>
                  <p className="text-white font-medium">Import Template</p>
                  <p className="text-void-400 text-sm">Load preconfigured templates</p>
                </div>
              </div>
            </button>
          </div>

          {/* Supported Formats */}
          <div className="mt-6 p-4 bg-void-800 rounded-lg">
            <h3 className="text-white font-medium mb-3">Supported Data Types</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> DTUs
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Personas
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Memories
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Config
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Simulations
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Full Backup
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import History */}
      <div className="lens-card mt-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileJson className="w-5 h-5 text-neon-green" />
          Import History
        </h2>

        <div className="space-y-3">
          {importJobs.map(job => (
            <div key={job.id} className="p-4 bg-void-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getTypeIcon(job.type)}
                  <div>
                    <p className="text-white font-medium">{job.filename}</p>
                    <p className="text-void-400 text-sm capitalize">{job.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 ${getStatusColor(job.status)}`}>
                  {getStatusIcon(job.status)}
                  <span className="capitalize">{job.status}</span>
                </div>
              </div>

              {/* Progress Bar */}
              {(job.status === 'importing' || job.status === 'validating') && (
                <div className="mb-2">
                  <div className="h-2 bg-void-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon-blue transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <p className="text-void-400 text-sm mt-1">{job.progress}% complete</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 text-sm mt-2">
                <div>
                  <span className="text-void-400">Total:</span>
                  <span className="text-white ml-2">{job.records_total.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-void-400">Imported:</span>
                  <span className="text-neon-green ml-2">{job.records_imported.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-void-400">Skipped:</span>
                  <span className="text-yellow-400 ml-2">{job.records_skipped}</span>
                </div>
                <div>
                  <span className="text-void-400">Failed:</span>
                  <span className="text-red-400 ml-2">{job.records_failed}</span>
                </div>
              </div>

              {job.errors.length > 0 && (
                <div className="mt-2 p-2 bg-red-900/20 rounded text-red-400 text-sm">
                  {job.errors.map((error, i) => (
                    <p key={i}>• {error}</p>
                  ))}
                </div>
              )}

              <p className="text-void-500 text-xs mt-2">
                Started: {new Date(job.started_at).toLocaleString()}
                {job.completed_at && ` • Completed: ${new Date(job.completed_at).toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
