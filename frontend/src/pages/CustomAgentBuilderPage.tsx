import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AgentDefinition } from '../types';
import { Save, ArrowLeft, ShieldCheck } from 'lucide-react';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import * as api from '../api/client';

export const CustomAgentBuilderPage: React.FC = () => {
  const { editingAgent, setEditingAgent, setView, loadAgents } = useAppStore();

  const [name, setName] = useState(editingAgent?.name || '');
  const [description, setDescription] = useState(editingAgent?.description || '');
  const [role, setRole] = useState(editingAgent?.role || '');
  const [instructions, setInstructions] = useState(editingAgent?.instructions || '');
  const [model, setModel] = useState(editingAgent?.llm_config?.model || 'gemini-2.5-flash');
  const [models, setModels] = useState<string[]>([
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
  ]);
  const [temperature, setTemperature] = useState(editingAgent?.llm_config?.temperature ?? 0.2);
  const [allowedTools, setAllowedTools] = useState<string[]>(editingAgent?.allowed_tools || []);
  const [maxSteps, setMaxSteps] = useState(editingAgent?.execution_limits?.max_steps ?? 5);
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    editingAgent?.execution_limits?.timeout_seconds ?? 60,
  );
  const [outputSchemaText, setOutputSchemaText] = useState(
    JSON.stringify(
      editingAgent?.output_schema && Object.keys(editingAgent.output_schema).length > 0
        ? editingAgent.output_schema
        : {
            type: 'object',
            properties: { summary: { type: 'string' }, score: { type: 'number' } },
          },
      null,
      2,
    ),
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schemaPresets: { label: string; schema: Record<string, unknown> }[] = [
    {
      label: 'Summary + Score',
      schema: {
        type: 'object',
        properties: { summary: { type: 'string' }, score: { type: 'number' } },
      },
    },
    {
      label: 'Security Audit',
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          security_score: { type: 'number' },
          vulnerabilities: { type: 'array' },
        },
      },
    },
    {
      label: 'Verification Report',
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          claims: { type: 'array' },
          factual_accuracy: { type: 'number' },
        },
      },
    },
  ];

  useEffect(() => {
    api
      .fetchConfig()
      .then((config) => {
        if (config.allowed_models?.length) setModels(config.allowed_models);
      })
      .catch(() => {
        // Keep built-in fallback models if /config is unreachable
      });
  }, []);

  const parseOutputSchema = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(outputSchemaText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setSchemaError('Output schema must be a JSON object.');
        return null;
      }
      setSchemaError(null);
      return parsed as Record<string, unknown>;
    } catch (error) {
      setSchemaError(error instanceof Error ? error.message : 'Invalid JSON');
      return null;
    }
  };

  const availableToolsList = [
    {
      id: 'web_search',
      label: 'Web Search',
      desc: 'Search live documentation, articles, and reference sources (Tavily or DuckDuckGo).',
    },
    {
      id: 'python_sandbox',
      label: 'Python Sandbox',
      desc: 'Run Python code inside an isolated subprocess with plot extraction.',
    },
    {
      id: 'read_memory',
      label: 'Read Working Memory',
      desc: 'Read structured findings written earlier in the same run.',
    },
    {
      id: 'write_memory',
      label: 'Write Working Memory',
      desc: 'Save notes or results for downstream agents in the run.',
    },
  ];

  const handleToolToggle = (toolId: string) => {
    setAllowedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !instructions.trim() || isSubmitting) return;
    const parsedSchema = parseOutputSchema();
    if (!parsedSchema) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<AgentDefinition> = {
        name,
        description,
        role,
        instructions,
        llm_config: { model, temperature },
        allowed_tools: allowedTools,
        output_schema: parsedSchema,
        execution_limits: { max_steps: maxSteps, timeout_seconds: timeoutSeconds },
        enabled: true,
      };

      if (editingAgent) {
        await api.updateAgent(editingAgent.agent_id, payload);
      } else {
        await api.createAgent(payload);
      }

      setEditingAgent(null);
      await loadAgents();
      setView('agents');
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to save custom agent. Please verify all inputs.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-5 sm:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-cream-border dark:border-charcoal-border">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingAgent(null);
              setView('agents');
            }}
            aria-label="Back to Agent Workspace"
            className="h-9 w-9 rounded-full border border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface hover:border-coral flex items-center justify-center transition-colors mt-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
              Build · Custom Agent
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
              {editingAgent ? `Edit ${editingAgent.name}` : 'Compose a specialist agent'}
            </h1>
            <p className="text-xs text-cream-muted dark:text-charcoal-muted mt-0.5">
              Configure behavior in plain English — no backend code needed.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting || !name.trim() || !role.trim() || !instructions.trim()}
          className="h-9 px-5 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/25 transition-colors inline-flex items-center gap-2 disabled:opacity-50 self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Saving…' : 'Save Agent'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Clean Editorial Chapters (No stacked card boxes!) */}
        <div className="lg:col-span-8 divide-y divide-cream-border dark:divide-charcoal-border">
          {/* 01. Agent Identity */}
          <section className="pb-8 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="font-editorial italic text-3xl text-coral leading-none">01</span>
              <div>
                <h2 className="text-base font-bold">Agent Identity</h2>
                <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                  Give your agent a clear name and describe when the Planner should select it.
                </p>
              </div>
            </div>

            <div className="space-y-4 pl-0 sm:pl-9">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">
                  Agent Name
                  <InfoTooltip text="Displayed in the live execution graph, timeline, and agent workspace." />
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Security Reviewer"
                  required
                  minLength={2}
                  maxLength={60}
                  className="w-full h-10 px-3.5 rounded-xl border text-xs bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">
                  Description
                  <InfoTooltip text="The Planner reads this sentence to decide which tasks fit this agent." />
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Audits generated Python scripts and dependencies for security vulnerabilities."
                  rows={2}
                  required
                  minLength={5}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                />
              </div>
            </div>
          </section>

          {/* 02. Role & Instructions */}
          <section className="py-8 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="font-editorial italic text-3xl text-coral leading-none">02</span>
              <div>
                <h2 className="text-base font-bold">Role and Instructions</h2>
                <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                  A role sets domain expertise; instructions guide how the agent reasons and verifies
                  answers.
                </p>
              </div>
            </div>

            <div className="space-y-4 pl-0 sm:pl-9">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">
                  Role Title
                  <InfoTooltip text="Short specialization label, e.g., 'Cybersecurity & Code Audit Specialist'." />
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Code Security & Reliability Analyst"
                  required
                  minLength={3}
                  className="w-full h-10 px-3.5 rounded-xl border text-xs bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">
                  System Instructions
                  <InfoTooltip text="Standing rules sent on every invocation. Platform guardrails and tool restrictions cannot be overridden." />
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Inspect code or findings carefully, list concrete issues with severity ratings, and cite evidence from working memory."
                  rows={4}
                  required
                  minLength={10}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                />
              </div>
            </div>
          </section>

          {/* 03. Model Selection */}
          <section className="py-8 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="font-editorial italic text-3xl text-coral leading-none">03</span>
              <div>
                <h2 className="text-base font-bold">Model Selection</h2>
                <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                  Pick from the verified server allowlist and tune output determinism.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-0 sm:pl-9">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border text-xs bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border"
                >
                  {models.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {candidate === 'gemini-2.5-flash'
                        ? `${candidate} (recommended default)`
                        : candidate}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">
                  Temperature: <span className="font-mono text-coral">{temperature}</span>
                  <InfoTooltip text="0.0–0.2 yields deterministic, analytical results; higher values increase variation." />
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-coral mt-2.5 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-cream-muted dark:text-charcoal-muted">
                  <span>0.0 Focused</span>
                  <span>1.0 Creative</span>
                </div>
              </div>
            </div>
          </section>

          {/* 04. Tool Permissions */}
          <section className="py-8 space-y-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-baseline gap-3">
                <span className="font-editorial italic text-3xl text-coral leading-none">04</span>
                <div>
                  <h2 className="text-base font-bold">Tool Permissions</h2>
                  <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                    Choose which tools this agent may call. Permissions are enforced server-side.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-coral/10 text-coral inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Server-Enforced
              </span>
            </div>

            <div className="divide-y divide-cream-border dark:divide-charcoal-border pl-0 sm:pl-9">
              {availableToolsList.map((tool) => {
                const checked = allowedTools.includes(tool.id);
                return (
                  <label
                    key={tool.id}
                    className="py-3 cursor-pointer flex items-start gap-3 group"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToolToggle(tool.id)}
                      className="mt-1 accent-coral"
                    />
                    <div className="text-xs">
                      <span
                        className={`font-semibold transition-colors ${
                          checked ? 'text-coral' : 'group-hover:text-coral'
                        }`}
                      >
                        {tool.label}
                      </span>
                      <span className="ml-2 text-[10px] font-mono text-cream-muted dark:text-charcoal-muted">
                        ({tool.id})
                      </span>
                      <p className="text-[11px] text-cream-muted dark:text-charcoal-muted mt-0.5 leading-relaxed">
                        {tool.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 05. Expected Output */}
          <section className="py-8 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="font-editorial italic text-3xl text-coral leading-none">05</span>
              <div>
                <h2 className="text-base font-bold">
                  Expected Output
                  <InfoTooltip text="Responses are compiled into a Pydantic model from this JSON Schema." />
                </h2>
                <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                  Pick a schema preset or define custom JSON properties returned by this agent.
                </p>
              </div>
            </div>

            <div className="space-y-3 pl-0 sm:pl-9">
              <div className="flex flex-wrap gap-2">
                {schemaPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setOutputSchemaText(JSON.stringify(preset.schema, null, 2));
                      setSchemaError(null);
                    }}
                    className="px-3 py-1 rounded-full border text-xs font-medium border-cream-border dark:border-charcoal-border hover:border-coral hover:text-coral transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <textarea
                value={outputSchemaText}
                onChange={(event) => setOutputSchemaText(event.target.value)}
                onBlur={parseOutputSchema}
                rows={7}
                spellCheck={false}
                className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
              />
              {schemaError && (
                <p className="text-xs text-statusError font-mono">Schema error: {schemaError}</p>
              )}
            </div>
          </section>

          {/* 06. Execution Limits */}
          <section className="pt-8 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="font-editorial italic text-3xl text-coral leading-none">06</span>
              <div>
                <h2 className="text-base font-bold">Execution Limits</h2>
                <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                  Guardrail bounds keep single-agent tasks responsive and predictable.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-0 sm:pl-9">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">
                  Max Steps (1–20)
                  <InfoTooltip text="Maximum reasoning/tool iterations allowed for one task." />
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(parseInt(e.target.value, 10) || 5)}
                  className="w-full h-10 px-3.5 rounded-xl border text-xs font-mono bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold block">
                  Timeout Seconds (5–300)
                  <InfoTooltip text="Wall-clock timeout per task execution. Default 60s suits most tasks." />
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(parseInt(e.target.value, 10) || 60)}
                  className="w-full h-10 px-3.5 rounded-xl border text-xs font-mono bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: Single Anchored Spec Sheet */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 p-6 rounded-2xl border bg-cream-surface border-cream-border dark:bg-charcoal-surface dark:border-charcoal-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream-border dark:border-charcoal-border">
              <span className="text-xs font-bold uppercase tracking-wider text-coral">
                Agent Spec Sheet
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-coral/10 text-coral">
                Pydantic Validated
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
                  Name
                </span>
                <p className="font-bold mt-0.5">{name || 'Untitled Agent'}</p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
                  Role
                </span>
                <p className="font-semibold text-amberAccent mt-0.5">
                  {role || 'Not specified yet'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
                  Model & Temperature
                </span>
                <p className="font-mono text-[11px] mt-0.5">
                  {model} (t={temperature})
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
                  Tools
                </span>
                <p className="font-mono text-[11px] mt-0.5">
                  {allowedTools.length ? allowedTools.join(', ') : 'Reasoning only'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
                  Limits
                </span>
                <p className="font-mono text-[11px] mt-0.5">
                  {maxSteps} steps · {timeoutSeconds}s timeout
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
                  Output Fields
                </span>
                <p className="font-mono text-[11px] mt-0.5">
                  {(() => {
                    try {
                      const parsed = JSON.parse(outputSchemaText);
                      const keys = Object.keys(parsed?.properties ?? {});
                      return keys.length ? keys.join(', ') : 'summary (default)';
                    } catch {
                      return 'invalid JSON schema';
                    }
                  })()}
                </p>
              </div>

              <div className="pt-4 border-t border-cream-border dark:border-charcoal-border">
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !role.trim() || !instructions.trim()}
                  className="w-full h-10 rounded-full font-semibold text-xs bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/25 transition-colors disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving…'
                    : editingAgent
                      ? 'Update Agent'
                      : 'Deploy to Agent Workspace'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
