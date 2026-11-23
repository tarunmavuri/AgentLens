import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AgentDefinition } from '../../types';
import { Bot, Clock, Wrench, Shield, Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface AgentInspectorProps {
  agent: AgentDefinition | null;
  onClose: () => void;
}

export const AgentInspector: React.FC<AgentInspectorProps> = ({ agent, onClose }) => {
  const { events } = useAppStore();

  if (!agent) {
    return (
      <div className="p-6 text-center dark:text-charcoal-muted text-cream-muted text-xs space-y-2">
        <Bot className="w-8 h-8 mx-auto opacity-30" />
        <p>Select any agent node in the Live Graph to inspect details, tool permissions, and activity.</p>
      </div>
    );
  }

  // Filter events related to this agent
  const agentEvents = events.filter(e => e.agent_id === agent.agent_id);
  const toolCalls = agentEvents.filter(e => e.type === 'tool_call');
  const thoughts = agentEvents.filter(e => e.type === 'thought');
  const latestCritique = events.find(e => e.type === 'critique');

  return (
    <div className="h-full flex flex-col justify-between overflow-y-auto p-5 space-y-6">
      
      {/* Top Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b dark:border-charcoal-border border-cream-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-coral/10 text-coral flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{agent.name}</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-coral">{agent.role}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
            Specialization & Description
          </span>
          <p className="text-xs dark:text-charcoal-text text-cream-text leading-relaxed">
            {agent.description}
          </p>
        </div>

        {/* Model & Config */}
        <div className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="dark:text-charcoal-muted text-cream-muted">Configured Model:</span>
            <span className="font-mono font-bold">{agent.llm_config?.model || 'gemini-2.5-flash'}</span>
          </div>
          <div className="flex justify-between">
            <span className="dark:text-charcoal-muted text-cream-muted">Temperature:</span>
            <span className="font-mono">{agent.llm_config?.temperature ?? 0.2}</span>
          </div>
          <div className="flex justify-between">
            <span className="dark:text-charcoal-muted text-cream-muted">Max Steps:</span>
            <span className="font-mono">{agent.execution_limits?.max_steps ?? 5}</span>
          </div>
        </div>

        {/* Allowed Tools */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
            Allowed Tool Registry Permissions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {agent.allowed_tools && agent.allowed_tools.length > 0 ? (
              agent.allowed_tools.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg"
                >
                  {t}
                </span>
              ))
            ) : (
              <span className="text-xs italic text-neutral-400">Pure Internal Reasoning (No External Tools)</span>
            )}
          </div>
        </div>

        {/* Live Metrics for this Agent */}
        <div className="space-y-2 pt-2 border-t dark:border-charcoal-border border-cream-border">
          <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
            Run Activity Telemetry
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg">
              <span className="text-[10px] dark:text-charcoal-muted text-cream-muted block">ReAct Thoughts</span>
              <span className="font-bold text-sm">{thoughts.length}</span>
            </div>
            <div className="p-2.5 rounded-lg border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg">
              <span className="text-[10px] dark:text-charcoal-muted text-cream-muted block">Tool Invocations</span>
              <span className="font-bold text-sm">{toolCalls.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Instructions Preview */}
      <div className="space-y-1 pt-4 border-t dark:border-charcoal-border border-cream-border">
        <span className="text-[10px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
          System Instructions Excerpt
        </span>
        <div className="p-2.5 rounded-lg dark:bg-charcoal-bg bg-cream-bg font-mono text-[10px] max-h-32 overflow-y-auto leading-relaxed">
          {agent.instructions}
        </div>
      </div>

    </div>
  );
};

