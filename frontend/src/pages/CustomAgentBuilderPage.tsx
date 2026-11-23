import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AgentDefinition } from '../types';
import { 
  Bot, 
  Sparkles, 
  Save, 
  Play, 
  ArrowLeft, 
  ShieldCheck, 
  Wrench, 
  Cpu, 
  Clock, 
  FileCode,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import * as api from '../api/client';

export const CustomAgentBuilderPage: React.FC = () => {
  const { editingAgent, setEditingAgent, setView, loadAgents } = useAppStore();

  const [name, setName] = useState(editingAgent?.name || '');
  const [description, setDescription] = useState(editingAgent?.description || '');
  const [role, setRole] = useState(editingAgent?.role || '');
  const [instructions, setInstructions] = useState(editingAgent?.instructions || '');
  const [model, setModel] = useState(editingAgent?.llm_config?.model || 'gemini-2.5-flash');
  const [temperature, setTemperature] = useState(editingAgent?.llm_config?.temperature ?? 0.2);
  const [allowedTools, setAllowedTools] = useState<string[]>(editingAgent?.allowed_tools || []);
  const [maxSteps, setMaxSteps] = useState(editingAgent?.execution_limits?.max_steps ?? 5);
  const [timeoutSeconds, setTimeoutSeconds] = useState(editingAgent?.execution_limits?.timeout_seconds ?? 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const availableToolsList = [
    { id: 'web_search', label: 'Web Search', desc: 'Allows agent to search technical papers, literature and live documentation' },
    { id: 'python_sandbox', label: 'Python Sandbox', desc: 'Executes Python code in an isolated subprocess with automatic matplotlib plot extraction' },
    { id: 'read_memory', label: 'Read Memory', desc: 'Read shared key-value context written by other agents in this run' },
    { id: 'write_memory', label: 'Write Memory', desc: 'Persist findings, code or schemas into run-scoped working memory' },
  ];

  const handleToolToggle = (toolId: string) => {
    setAllowedTools(prev => 
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !instructions.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<AgentDefinition> = {
        name,
        description,
        role,
        instructions,
        llm_config: { model, temperature },
        allowed_tools: allowedTools,
        output_schema: { type: 'object', properties: { summary: { type: 'string' }, score: { type: 'number' } } },
        execution_limits: { max_steps: maxSteps, timeout_seconds: timeoutSeconds },
        enabled: true
      };

      if (editingAgent) {
        await api.updateAgent(editingAgent.agent_id, payload);
      } else {
        await api.createAgent(payload);
      }

      await loadAgents();
      setView('agents');
    } catch (err) {
      console.error(err);
      alert('Failed to save custom agent. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b dark:border-charcoal-border border-cream-border">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setView('agents')}
            className="p-2 rounded-xl border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
              No-Code Agent Architecture
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {editingAgent ? `Edit Agent: ${editingAgent.name}` : 'Custom Agent Builder'}
            </h1>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSubmitting || !name.trim()}
          className="px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider 
            bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all hover:scale-[1.02] flex items-center space-x-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Saving...' : 'Save Agent'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form: Sections 1-6 */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SECTION 1: IDENTITY */}
          <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
              <Bot className="w-4 h-4" />
              <span>Section 1: Agent Identity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Agent Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g., Security Reviewer"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border focus:outline-none focus:ring-1 focus:ring-coral"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Specialized Role</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="E.g., Code Security & Sandbox Auditor"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border focus:outline-none focus:ring-1 focus:ring-coral"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explains what this agent does to the Planner so it can be assigned to tasks automatically..."
                rows={2}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border text-xs dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border focus:outline-none focus:ring-1 focus:ring-coral"
              />
            </div>
          </div>

          {/* SECTION 2: SYSTEM INSTRUCTIONS */}
          <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
              <FileCode className="w-4 h-4" />
              <span>Section 2: System Instructions</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Instruction Prompt</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Analyze code for vulnerabilities, unsafe subprocess operations, and unhandled exceptions..."
                rows={5}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border focus:outline-none focus:ring-1 focus:ring-coral"
              />
              <p className="text-[11px] dark:text-charcoal-muted text-cream-muted">
                Be specific about guidelines, criteria, and expected reasoning depth.
              </p>
            </div>
          </div>

          {/* SECTION 3: MODEL CONFIGURATION */}
          <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
              <Cpu className="w-4 h-4" />
              <span>Section 3: Model Configuration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Model Provider</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast, Recommended)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (High Throughput)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Temperature: {temperature}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-coral mt-2"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: TOOL PERMISSIONS */}
          <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
              <Wrench className="w-4 h-4" />
              <span>Section 4: Tool Permissions (Backend Enforced)</span>
            </div>

            <div className="space-y-2">
              {availableToolsList.map((t) => {
                const checked = allowedTools.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => handleToolToggle(t.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      checked
                        ? 'border-coral dark:bg-coral/5 bg-coral/5'
                        : 'dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-bg hover:bg-cream-bg'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 accent-coral"
                    />
                    <div>
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">{t.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 5: EXECUTION LIMITS */}
          <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
              <Clock className="w-4 h-4" />
              <span>Section 5: Execution Limits & Guardrails</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Max Step Budget</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(parseInt(e.target.value) || 5)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Timeout (Seconds)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(parseInt(e.target.value) || 60)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs dark:bg-charcoal-bg bg-cream-bg dark:border-charcoal-border border-cream-border"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Pane: Live Configuration Preview */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-24 p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b dark:border-charcoal-border border-cream-border">
              <span className="text-xs font-bold uppercase tracking-wider text-coral">
                Configuration Preview
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-coral/10 text-coral">
                Pydantic Validated
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">Name:</span>
                <p className="font-bold">{name || 'Untitled Agent'}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">Role:</span>
                <p className="font-semibold text-coral">{role || 'Unspecified Role'}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">Tools:</span>
                <p className="font-mono text-[11px]">{allowedTools.length ? allowedTools.join(', ') : 'None'}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">Limits:</span>
                <p className="font-mono text-[11px]">{maxSteps} steps · {timeoutSeconds}s timeout</p>
              </div>

              <div className="pt-4 border-t dark:border-charcoal-border border-cream-border">
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Deploy to Registry'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </form>

    </div>
  );
};

