import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AgentDefinition, AgentExecution } from '../types';
import {
  Bot,
  Plus,
  Trash2,
  Copy,
  Edit3,
  Play,
  History,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  X,
} from 'lucide-react';
import * as api from '../api/client';

export const AgentsPage: React.FC = () => {
  const { agents, loadAgents, setEditingAgent, setView } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'built_in' | 'custom'>('all');
  const [testingAgent, setTestingAgent] = useState<AgentDefinition | null>(null);
  const [testPrompt, setTestPrompt] = useState('Inspect code safety and verify API contract.');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [historyAgent, setHistoryAgent] = useState<AgentDefinition | null>(null);
  const [historyItems, setHistoryItems] = useState<AgentExecution[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const filteredAgents = agents.filter((a) => {
    if (filter === 'all') return true;
    return a.agent_type === filter;
  });

  const handleToggle = async (agentId: string) => {
    try {
      await api.toggleAgent(agentId);
      await loadAgents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cannot toggle this agent.');
    }
  };

  const handleDuplicate = async (agentId: string) => {
    try {
      await api.duplicateAgent(agentId);
      await loadAgents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate agent.');
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('Delete this custom agent?')) return;
    try {
      await api.deleteAgent(agentId);
      await loadAgents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cannot delete this agent.');
    }
  };

  const handleRunTest = async () => {
    if (!testingAgent || isTesting) return;
    setIsTesting(true);
    try {
      const res = await api.testAgent(testingAgent.agent_id, testPrompt);
      setTestResult(res);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Agent test execution failed');
    } finally {
      setIsTesting(false);
    }
  };

  const openHistory = async (agent: AgentDefinition) => {
    setHistoryAgent(agent);
    setHistoryItems([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const response = await api.fetchAgentHistory(agent.agent_id);
      setHistoryItems(response.executions);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : 'Failed to load execution history',
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="p-5 sm:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-cream-border dark:border-charcoal-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Build · Agent Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Registered Agents
          </h1>
          <p className="text-xs sm:text-sm text-cream-muted dark:text-charcoal-muted mt-1">
            Inspect specialists, run isolated agent verification checks, or clone templates into
            custom agents.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingAgent(null);
            setView('builder');
          }}
          className="h-9 px-4 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/25 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Agent</span>
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2">
        {(['all', 'built_in', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`h-8 px-4 rounded-full text-xs font-semibold transition-colors ${
              filter === tab
                ? 'bg-coral text-white'
                : 'border border-cream-border dark:border-charcoal-border text-cream-muted dark:text-charcoal-muted hover:border-coral'
            }`}
          >
            {tab === 'all' ? 'All Agents' : tab === 'built_in' ? 'Built-in' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Editorial Directory Rows (No rigid boxed card grid!) */}
      <div className="divide-y divide-cream-border dark:divide-charcoal-border border-y border-cream-border dark:border-charcoal-border">
        {filteredAgents.map((agent) => {
          const isBuiltIn = agent.agent_type === 'built_in';
          const isSystemTemplate = agent.user_id === 'system';
          const isUserOwned = !isBuiltIn && !isSystemTemplate;

          return (
            <div
              key={agent.agent_id}
              className={`py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-opacity ${
                !agent.enabled ? 'opacity-60' : ''
              }`}
            >
              {/* Left Identity & Description */}
              <div className="flex items-start gap-3.5 max-w-2xl">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isBuiltIn ? 'bg-coral/15 text-coral' : 'bg-amberAccent/15 text-amberAccent'
                  }`}
                >
                  <Bot className="w-5 h-5" />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base tracking-tight">{agent.name}</h3>
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                        isBuiltIn
                          ? 'bg-cream-subtle dark:bg-charcoal-subtle text-cream-muted dark:text-charcoal-muted'
                          : isSystemTemplate
                            ? 'bg-coral/10 text-coral'
                            : 'bg-amberAccent/15 text-amberAccent'
                      }`}
                    >
                      {isBuiltIn ? 'Built-in' : isSystemTemplate ? 'Template' : 'Custom'}
                    </span>
                    <span className="text-[11px] font-mono text-cream-muted dark:text-charcoal-muted">
                      {agent.llm_config?.model || 'gemini-2.5-flash'}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-coral">{agent.role}</p>
                  <p className="text-xs text-cream-muted dark:text-charcoal-muted leading-relaxed">
                    {agent.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {agent.allowed_tools && agent.allowed_tools.length > 0 ? (
                      agent.allowed_tools.map((t) => (
                        <span
                          key={t}
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-mono border border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface"
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] italic text-cream-muted dark:text-charcoal-muted">
                        Reasoning only (no tools)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center justify-between lg:justify-end gap-4 pl-14 lg:pl-0 flex-shrink-0">
                {isUserOwned ? (
                  <button
                    type="button"
                    onClick={() => handleToggle(agent.agent_id)}
                    title={agent.enabled ? 'Click to disable' : 'Click to enable'}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {agent.enabled ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-statusSuccess" />
                        <span className="text-[11px] text-statusSuccess">Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-cream-muted" />
                        <span className="text-[11px] text-cream-muted">Disabled</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-statusSuccess">
                    {agent.enabled ? 'Active' : 'Disabled'}
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openHistory(agent)}
                    title="View execution history"
                    className="p-2 rounded-full border border-cream-border dark:border-charcoal-border hover:border-coral hover:text-coral transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>

                  {!['planner', 'critic'].includes(agent.agent_id) && (
                    <button
                      type="button"
                      onClick={() => {
                        setTestingAgent(agent);
                        setTestResult(null);
                      }}
                      title="Run isolated single-agent test"
                      className="p-2 rounded-full border border-cream-border dark:border-charcoal-border hover:border-amberAccent hover:text-amberAccent transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!isBuiltIn && (
                    <button
                      type="button"
                      onClick={() => handleDuplicate(agent.agent_id)}
                      title="Duplicate as custom agent"
                      className="p-2 rounded-full border border-cream-border dark:border-charcoal-border hover:border-coral hover:text-coral transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isUserOwned && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAgent(agent);
                          setView('builder');
                        }}
                        title="Edit custom agent"
                        className="p-2 rounded-full border border-cream-border dark:border-charcoal-border hover:border-coral hover:text-coral transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(agent.agent_id)}
                        title="Delete custom agent"
                        className="p-2 rounded-full border border-cream-border dark:border-charcoal-border hover:border-statusError hover:text-statusError transition-colors text-cream-muted"
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

      {/* History Modal */}
      {historyAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border bg-cream-surface border-cream-border dark:bg-charcoal-surface dark:border-charcoal-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream-border dark:border-charcoal-border">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-coral" />
                <h3 className="font-bold text-sm">Execution History: {historyAgent.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryAgent(null)}
                aria-label="Close history modal"
                className="p-1.5 rounded-full hover:bg-cream-subtle dark:hover:bg-charcoal-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {historyLoading && (
              <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                Loading executions…
              </p>
            )}
            {historyError && (
              <div className="pl-3 border-l-2 border-statusError text-statusError text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{historyError}</span>
              </div>
            )}
            {!historyLoading && !historyError && historyItems.length === 0 && (
              <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                No recorded executions for this agent yet.
              </p>
            )}

            {historyItems.length > 0 && (
              <div className="max-h-80 overflow-y-auto border-y border-cream-border dark:border-charcoal-border">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-[10px] uppercase tracking-wider text-cream-muted dark:text-charcoal-muted border-b border-cream-border dark:border-charcoal-border">
                    <tr>
                      <th className="py-2 pr-3">Goal</th>
                      <th className="py-2 px-3">Task</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Thoughts</th>
                      <th className="py-2 px-3">Tools</th>
                      <th className="py-2 pl-3">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-border dark:divide-charcoal-border">
                    {historyItems.map((item, index) => (
                      <tr key={`${item.run_id}-${item.task_id}-${index}`}>
                        <td className="py-2.5 pr-3 max-w-[16rem]">
                          <div className="font-semibold line-clamp-1">{item.goal}</div>
                          <div className="font-mono text-[9px] text-cream-muted dark:text-charcoal-muted">
                            {item.run_id}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{item.task_id ?? '—'}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.status === 'failed'
                                ? 'bg-statusError/10 text-statusError'
                                : 'bg-statusSuccess/10 text-statusSuccess'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{item.thoughts}</td>
                        <td className="py-2.5 px-3 font-mono">{item.tool_calls}</td>
                        <td className="py-2.5 pl-3 font-mono text-coral">
                          {item.critic_score != null ? `${item.critic_score}/10` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Agent Modal */}
      {testingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border bg-cream-surface border-cream-border dark:bg-charcoal-surface dark:border-charcoal-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream-border dark:border-charcoal-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-coral" />
                <h3 className="font-bold text-sm">Isolated Test: {testingAgent.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setTestingAgent(null)}
                aria-label="Close test modal"
                className="p-1.5 rounded-full hover:bg-cream-subtle dark:hover:bg-charcoal-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">Test Task Prompt</label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border text-xs bg-cream-bg dark:bg-charcoal-bg border-cream-border dark:border-charcoal-border"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunTest}
                disabled={isTesting}
                className="h-9 px-5 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white transition-colors disabled:opacity-50"
              >
                {isTesting ? 'Running Test…' : 'Run Isolated Test'}
              </button>
            </div>

            {testResult && (
              <div className="p-4 rounded-xl bg-cream-bg dark:bg-charcoal-bg border border-cream-border dark:border-charcoal-border space-y-2 max-h-60 overflow-y-auto">
                <span className="text-[10px] font-bold uppercase text-statusSuccess">
                  Test Output
                </span>
                <p className="text-xs leading-relaxed font-mono">{testResult.result?.summary}</p>
                <div className="text-[10px] font-mono text-cream-muted dark:text-charcoal-muted pt-2 border-t border-cream-border dark:border-charcoal-border">
                  Duration: {testResult.result?.execution_duration}s
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
