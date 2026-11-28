import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AgentDefinition, TaskDefinition } from '../../types';
import { Bot, X, ChevronDown, ChevronRight } from 'lucide-react';

interface AgentInspectorProps {
  agent: AgentDefinition | null;
  assignedTask?: TaskDefinition | null;
  onClose?: () => void;
}

export const AgentInspector: React.FC<AgentInspectorProps> = ({
  agent,
  assignedTask,
  onClose,
}) => {
  const { events } = useAppStore();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-cream-muted dark:text-charcoal-muted text-xs space-y-2">
        <div className="w-10 h-10 rounded-full bg-coral/10 text-coral flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <p className="font-semibold text-cream-text dark:text-charcoal-text">
          Click an agent node
        </p>
        <p className="leading-relaxed max-w-[230px]">
          Select any agent on the live graph to inspect its assigned task, permitted tools, and live
          activity.
        </p>
      </div>
    );
  }

  const agentEvents = events.filter((e) => e.agent_id === agent.agent_id);
  const toolCalls = agentEvents.filter((e) => e.type === 'tool_call');
  const thoughts = agentEvents.filter((e) => e.type === 'thought');
  const latestThought = thoughts[thoughts.length - 1];
  const agentCritiques = events.filter(
    (e) => e.type === 'critique' && assignedTask && e.task_id === assignedTask.id,
  );
  const latestCritique = agentCritiques[agentCritiques.length - 1];

  return (
    <div className="h-full flex flex-col overflow-y-auto p-5 divide-y divide-cream-border dark:divide-charcoal-border">
      {/* Header */}
      <div className="pb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-coral/15 text-coral flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate">{agent.name}</h3>
            <p className="text-[11px] font-medium text-coral truncate">{agent.role}</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Clear selected agent"
            className="p-1 rounded-full text-cream-muted hover:text-cream-text hover:bg-cream-subtle dark:hover:bg-charcoal-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Assigned Task */}
      {assignedTask && (
        <div className="py-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-coral">
            Assigned Task · {assignedTask.id}
          </span>
          <p className="text-xs font-semibold">{assignedTask.title}</p>
          <p className="text-[11px] text-cream-muted dark:text-charcoal-muted leading-relaxed">
            {assignedTask.success_criteria}
          </p>
        </div>
      )}

      {/* Role Summary */}
      <div className="py-3.5 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
          Responsibility
        </span>
        <p className="text-xs leading-relaxed">{agent.description}</p>
      </div>

      {/* Inline Stat Bar (No boxes) */}
      <div className="py-3.5 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted block">
          Run Activity
        </span>
        <div className="grid grid-cols-3 divide-x divide-cream-border dark:divide-charcoal-border text-xs">
          <div className="pr-3">
            <span className="text-[10px] text-cream-muted dark:text-charcoal-muted block">
              Thoughts
            </span>
            <span className="font-bold text-sm">{thoughts.length}</span>
          </div>
          <div className="px-3">
            <span className="text-[10px] text-cream-muted dark:text-charcoal-muted block">
              Tool Uses
            </span>
            <span className="font-bold text-sm">{toolCalls.length}</span>
          </div>
          <div className="pl-3">
            <span className="text-[10px] text-cream-muted dark:text-charcoal-muted block">
              Critic
            </span>
            <span className="font-bold text-sm text-coral">
              {latestCritique?.payload?.score != null ? `${latestCritique.payload.score}/10` : '—'}
            </span>
          </div>
        </div>
        {latestThought?.payload?.thought && (
          <p className="text-[11px] italic text-cream-muted dark:text-charcoal-muted pl-3 border-l-2 border-coral/40">
            “{latestThought.payload.thought}”
          </p>
        )}
      </div>

      {/* Permitted Tools */}
      <div className="py-3.5 space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted block">
          Permitted Tools
        </span>
        <div className="flex flex-wrap gap-1.5">
          {agent.allowed_tools && agent.allowed_tools.length > 0 ? (
            agent.allowed_tools.map((tool) => (
              <span
                key={tool}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-mono border border-cream-border dark:border-charcoal-border bg-cream-bg dark:bg-charcoal-bg"
              >
                {tool}
              </span>
            ))
          ) : (
            <span className="text-xs text-cream-muted dark:text-charcoal-muted italic">
              None (reasoning only)
            </span>
          )}
        </div>
      </div>

      {/* Runtime Spec */}
      <div className="py-3.5 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-cream-muted dark:text-charcoal-muted">Model</span>
          <span className="font-mono font-medium">{agent.llm_config?.model || 'gemini-2.5-flash'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream-muted dark:text-charcoal-muted">Temperature</span>
          <span className="font-mono">{agent.llm_config?.temperature ?? 0.2}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream-muted dark:text-charcoal-muted">Max steps</span>
          <span className="font-mono">{agent.execution_limits?.max_steps ?? 5}</span>
        </div>
      </div>

      {/* Collapsible Instructions */}
      <div className="pt-3.5">
        <button
          type="button"
          onClick={() => setShowInstructions((v) => !v)}
          className="w-full flex items-center justify-between text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted hover:text-coral transition-colors"
        >
          <span>System Instructions</span>
          {showInstructions ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
        {showInstructions && (
          <div className="mt-2 font-mono text-[11px] text-cream-muted dark:text-charcoal-muted max-h-36 overflow-y-auto leading-relaxed">
            {agent.instructions}
          </div>
        )}
      </div>
    </div>
  );
};
