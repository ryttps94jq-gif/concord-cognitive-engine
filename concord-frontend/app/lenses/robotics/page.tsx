'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { useState } from 'react';
import { Bot, Cpu, Cog, Wifi, Plus, Trash2, Search, Layers, ChevronDown, Activity, Shield, Settings, Power } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type RobotStatus = 'idle' | 'running' | 'error' | 'maintenance' | 'offline';
type RobotType = 'arm' | 'mobile' | 'drone' | 'humanoid' | 'swarm' | 'custom';

interface RobotUnit {
  name: string;
  type: RobotType;
  status: RobotStatus;
  firmware: string;
  battery: number;
  uptime: number;
  sensors: string[];
  actuators: string[];
  lastCommand: string;
  errorCount: number;
}

interface TaskQueue {
  id: string;
  name: string;
  robot: string;
  priority: number;
  status: 'queued' | 'running' | 'complete' | 'failed';
  createdAt: string;
}

const STATUS_COLORS: Record<RobotStatus, string> = {
  idle: 'text-blue-400',
  running: 'text-green-400',
  error: 'text-red-400',
  maintenance: 'text-yellow-400',
  offline: 'text-gray-500',
};

const TYPE_ICONS: Record<RobotType, string> = {
  arm: 'Industrial Arm',
  mobile: 'Mobile Robot',
  drone: 'Aerial Drone',
  humanoid: 'Humanoid',
  swarm: 'Swarm Unit',
  custom: 'Custom',
};

export default function RoboticsLensPage() {
  useLensNav('robotics');

  const [activeTab, setActiveTab] = useState<'fleet' | 'tasks' | 'diagnostics'>('fleet');
  const [showFeatures, setShowFeatures] = useState(false);
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('robotics');

  const { items: robotItems, isLoading, isError, error, refetch, create, update, remove } = useLensData<Record<string, unknown>>('robotics', 'robot', { seed: [] });
  const { items: taskItems, create: createTask, remove: removeTask } = useLensData<Record<string, unknown>>('robotics', 'task', { seed: [] });
  const runAction = useRunArtifact('robotics');

  const robots = robotItems.map(i => ({ id: i.id, title: i.title, ...(i.data || {}) })) as unknown as (RobotUnit & { id: string; title: string })[];
  const tasks = taskItems.map(i => ({ id: i.id, title: i.title, ...(i.data || {}) })) as unknown as (TaskQueue & { id: string; title: string })[];

  const onlineCount = robots.filter(r => r.status !== 'offline').length;
  const errorCount = robots.filter(r => r.status === 'error').length;

  const [newRobot, setNewRobot] = useState({ name: '', type: 'arm' as RobotType });
  const [newTask, setNewTask] = useState({ name: '', robot: '', priority: '5' });

  const addRobot = () => {
    if (!newRobot.name.trim()) return;
    create({
      title: newRobot.name,
      data: {
        name: newRobot.name,
        type: newRobot.type,
        status: 'idle' as RobotStatus,
        firmware: '1.0.0',
        battery: 100,
        uptime: 0,
        sensors: [],
        actuators: [],
        lastCommand: '',
        errorCount: 0,
      },
    });
    setNewRobot({ name: '', type: 'arm' });
  };

  const addTask = () => {
    if (!newTask.name.trim()) return;
    createTask({
      title: newTask.name,
      data: { name: newTask.name, robot: newTask.robot, priority: parseInt(newTask.priority) || 5, status: 'queued', createdAt: new Date().toISOString() },
    });
    setNewTask({ name: '', robot: '', priority: '5' });
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
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-neon-cyan" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Robotics Lens</h1>
              <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
            </div>
            <p className="text-sm text-gray-400">Fleet management, task queues, and diagnostics</p>
          </div>
        </div>
      </header>

      <RealtimeDataPanel domain="robotics" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <UniversalActions domain="robotics" artifactId={undefined} compact />
      <DTUExportButton domain="robotics" data={{}} compact />

      {/* Fleet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-4 text-center">
          <Bot className="w-6 h-6 mx-auto text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{robots.length}</p>
          <p className="text-xs text-gray-400">Total Units</p>
        </div>
        <div className="panel p-4 text-center">
          <Power className="w-6 h-6 mx-auto text-green-400 mb-2" />
          <p className="text-2xl font-bold">{onlineCount}</p>
          <p className="text-xs text-gray-400">Online</p>
        </div>
        <div className="panel p-4 text-center">
          <Shield className="w-6 h-6 mx-auto text-red-400 mb-2" />
          <p className="text-2xl font-bold">{errorCount}</p>
          <p className="text-xs text-gray-400">Errors</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['fleet', 'tasks', 'diagnostics'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-neon-cyan/20 text-neon-cyan border-b-2 border-neon-cyan' : 'text-gray-400 hover:text-white'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'fleet' && (
        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="font-semibold mb-3">Register Robot</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input value={newRobot.name} onChange={e => setNewRobot({ ...newRobot, name: e.target.value })} placeholder="Robot name" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <select value={newRobot.type} onChange={e => setNewRobot({ ...newRobot, type: e.target.value as RobotType })} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm">
                {(Object.keys(TYPE_ICONS) as RobotType[]).map(t => <option key={t} value={t}>{TYPE_ICONS[t]}</option>)}
              </select>
              <button onClick={addRobot} className="px-4 py-2 bg-neon-cyan/20 text-neon-cyan rounded-lg text-sm hover:bg-neon-cyan/30">
                <Plus className="w-4 h-4 inline mr-1" /> Register
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {robots.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No robots registered yet.</p>
            ) : (
              robots.map(robot => (
                <div key={robot.id} className="panel p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-neon-cyan" />
                      <span className="font-medium">{robot.name || robot.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded bg-white/10 ${STATUS_COLORS[robot.status as RobotStatus] || 'text-gray-400'}`}>
                        {robot.status || 'idle'}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span>{TYPE_ICONS[robot.type as RobotType] || robot.type}</span>
                      <span>Battery: {robot.battery ?? 100}%</span>
                      <span>FW: {robot.firmware || '1.0.0'}</span>
                    </div>
                  </div>
                  <button onClick={() => remove(robot.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="font-semibold mb-3">Queue Task</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} placeholder="Task name" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <select value={newTask.robot} onChange={e => setNewTask({ ...newTask, robot: e.target.value })} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm">
                <option value="">Any robot</option>
                {robots.map(r => <option key={r.id} value={r.name || r.title}>{r.name || r.title}</option>)}
              </select>
              <input value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} placeholder="Priority (1-10)" type="number" min="1" max="10" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <button onClick={addTask} className="px-4 py-2 bg-neon-cyan/20 text-neon-cyan rounded-lg text-sm hover:bg-neon-cyan/30">
                <Plus className="w-4 h-4 inline mr-1" /> Queue
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No tasks queued.</p>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="panel p-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{task.name || task.title}</span>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                      {task.robot && <span>Robot: {task.robot}</span>}
                      <span>Priority: {task.priority}</span>
                      <span className={task.status === 'complete' ? 'text-green-400' : task.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}>{task.status}</span>
                    </div>
                  </div>
                  <button onClick={() => removeTask(task.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div className="panel p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-neon-cyan" /> Fleet Diagnostics</h3>
          {robots.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Register robots to see diagnostics.</p>
          ) : (
            <div className="space-y-3">
              {robots.map(robot => (
                <div key={robot.id} className="p-3 rounded-lg bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{robot.name || robot.title}</span>
                    <span className={`text-xs ${STATUS_COLORS[robot.status as RobotStatus] || 'text-gray-400'}`}>{robot.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Battery</span>
                      <div className="h-1.5 bg-white/5 rounded-full mt-1">
                        <div className={`h-full rounded-full ${(robot.battery ?? 100) > 20 ? 'bg-green-400' : 'bg-red-400'}`} style={{ width: `${robot.battery ?? 100}%` }} />
                      </div>
                    </div>
                    <div><span className="text-gray-500">Errors</span><p className="font-mono">{robot.errorCount || 0}</p></div>
                    <div><span className="text-gray-500">Sensors</span><p className="font-mono">{robot.sensors?.length || 0}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lens Features */}
      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> Lens Features & Capabilities</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="robotics" /></div>}
      </div>
    </div>
  );
}
