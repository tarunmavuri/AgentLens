import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AgentDefinition } from '../types';
import { 
  Bot, 
  Plus, 
  Trash2, 
  Copy, 
  Edit3, 
  Play, 
  Wrench, 
  ShieldCheck, 
  Search, 
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles
} from 'lucide-react';
import * as api from '../api/client';

export const AgentsPage: React.FC = () => {
  const { agents, loadAgents, setEditingAgent, setView } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'built_in' | 'custom'>('all');
  const [testingAgent, setTestingAgent] = useState<AgentDefinition | null>(null);
  const [testPrompt, setTestPrompt] = useState('Inspect code safety and verify API contract.');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const filteredAgents = agents.filter(a => {
    if (filter === 'all') return true;
    return a.agent_type === filter;
  });

  const handleToggle = async (agentId: string) => {
    try {
      await api.toggleAgent(agentId);
      await loadAgents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (agentId: string) => {
    try {
      await api.duplicateAgent(agentId);
      await loadAgents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this custom agent?')) return;
    try {
      await api.deleteAgent(agentId);
      await loadAgents();
    } catch (err) {
      console.error(err);
      alert('Cannot delete this agent.');
    }
  };

  const handleRunTest = async () => {
    if (!testingAgent || isTesting) return;
    setIsTesting(true);
    try {
      const res = await api.testAgent(testingAgent.agent_id, testPrompt);
      setTestResult(res);
    } catch (err) {
      console.error(err);
      alert('Agent test execution failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b dark:border-charcoal-border border-cream-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
            Agent Registry & Ecosystem
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Agent Workspace
          </h1>
          <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
            Manage built-in specialists and dynamically registered custom AI agents.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingAgent(null);
            setView('builder');
          }}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider 
            bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all hover:scale-[1.02] flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Custom Agent</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2">
        {(['all', 'built_in', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              filter === tab
                ? 'bg-coral text-white shadow-sm'
                : 'dark:bg-charcoal-surface dark:text-charcoal-muted bg-cream-surface text-cream-muted border dark:border-charcoal-border border-cream-border'
            }`}
          >
            {tab === 'all' ? 'All Agents' : tab === 'built_in' ? 'Built-in Agents' : 'Custom Agents'}
          </button>
        ))}
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => {
          const isBuiltIn = agent.agent_type === 'built_in';
          return (
            <div
              key={agent.agent_id}
              className={`p-6 rounded-2xl border transition-all duration-200 flex flex-col justify-between
                dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border shadow-sm ${
                  !agent.enabled ? 'opacity-60' : 'hover:-translate-y-1'
                }`}
            >
              <div className="space-y-4">
                {/* Card Top */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isBuiltIn ? 'bg-coral/10 text-coral' : 'bg-purple-500/10 text-purple-500'
                    }`}>
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight">{agent.name}</h3>
                      <p className="text-[11px] font-semibold text-coral tracking-wide">{agent.role}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isBuiltIn ? 'dark:bg-charcoal-bg bg-cream-bg text-neutral-400' : 'bg-purple-500/10 text-purple-500'
                  }`}>
                    {agent.agent_type}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs dark:text-charcoal-muted text-cream-muted leading-relaxed line-clamp-3">
                  {agent.description}
                </p>

                {/* Model and Tools */}
                <div className="space-y-2 pt-2 border-t dark:border-charcoal-border border-cream-border">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="dark:text-charcoal-muted text-cream-muted font-medium">Model:</span>
                    <span className="font-mono font-semibold">{agent.llm_config?.model || 'gemini-2.5-flash'}</span>
                  </div>

                  <div className="text-[11px]">
                    <span className="dark:text-charcoal-muted text-cream-muted font-medium block mb-1">Allowed Tools:</span>
                    <div className="flex flex-wrap gap-1">
                      {agent.allowed_tools && agent.allowed_tools.length > 0 ? (
                        agent.allowed_tools.map((t) => (
                          <span 
                            key={t}
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono dark:bg-charcoal-bg bg-cream-bg border dark:border-charcoal-border border-cream-border"
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] italic text-neutral-400">None (Pure Reasoning)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-5 mt-4 border-t dark:border-charcoal-border border-cream-border flex items-center justify-between">
                <button
                  onClick={() => handleToggle(agent.agent_id)}
                  title={agent.enabled ? 'Click to disable' : 'Click to enable'}
                  className="flex items-center space-x-1 text-xs font-semibold"
                >
                  {agent.enabled ? (
                    <>
                      <ToggleRight className="w-5 h-5 text-emerald-500" />
                      <span className="text-[11px] text-emerald-500">Enabled</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5 text-neutral-400" />
                      <span className="text-[11px] text-neutral-400">Disabled</span>
                    </>
                  )}
                </button>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => {
                      setTestingAgent(agent);
                      setTestResult(null);
                    }}
                    title="Test Agent Independently"
                    className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  {!isBuiltIn && (
                    <>
                      <button
                        onClick={() => {
                          setEditingAgent(agent);
                          setView('builder');
                        }}
                        title="Edit Agent"
                        className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDuplicate(agent.agent_id)}
                        title="Duplicate Agent"
                        className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border hover:text-coral transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(agent.agent_id)}
                        title="Delete Agent"
                        className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border hover:text-red-500 transition-colors text-neutral-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Test Agent Modal */}
      {testingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b dark:border-charcoal-border border-cream-border">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-coral" />
                <h3 className="font-bold text-base">Test Agent: {testingAgent.name}</h3>
              </div>
              <button onClick={() => setTestingAgent(null)} className="text-neutral-400 hover:text-neutral-200">✕</button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider">Test Instruction Prompt</label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border text-xs dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleRunTest}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-coral hover:bg-coral-hover text-white transition-all disabled:opacity-50"
              >
                {isTesting ? 'Executing...' : 'Run Independent Test'}
              </button>
            </div>

            {testResult && (
              <div className="p-4 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg space-y-2 max-h-60 overflow-y-auto">
                <span className="text-[10px] font-bold uppercase text-emerald-500">Test Execution Output:</span>
                <p className="text-xs leading-relaxed font-mono">
                  {testResult.result?.summary}
                </p>
                <div className="text-[10px] font-mono dark:text-charcoal-muted text-cream-muted pt-2 border-t dark:border-charcoal-border border-cream-border">
                  Execution Duration: {testResult.result?.execution_duration}s
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

