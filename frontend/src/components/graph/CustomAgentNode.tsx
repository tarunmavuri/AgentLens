import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, CheckCircle2, AlertCircle, RefreshCw, Eye } from 'lucide-react';

interface AgentNodeData {
  agent_id: string;
  name: string;
  role: string;
  category: 'built_in' | 'custom' | 'system';
  status: 'idle' | 'waiting' | 'planning' | 'running' | 'using_tool' | 'reviewing' | 'retrying' | 'completed' | 'failed';
  currentTaskTitle?: string;
  criticScore?: number;
  retryCount?: number;
  duration?: number;
  isSelected?: boolean;
}

export const CustomAgentNode = memo(({ data }: { data: AgentNodeData }) => {
  const getStatusBadge = () => {
    switch (data.status) {
      case 'running':
      case 'using_tool':
      case 'planning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-coral text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>
              {data.status === 'using_tool'
                ? 'Using Tool'
                : data.status === 'planning'
                  ? 'Planning'
                  : 'Running'}
            </span>
          </span>
        );
      case 'reviewing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amberAccent text-white">
            <Eye className="w-2.5 h-2.5" />
            <span>Reviewing</span>
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amberAccent/15 text-amberAccent border border-amberAccent/30">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Retrying</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-statusSuccess/10 text-statusSuccess border border-statusSuccess/25">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Done</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-statusError/10 text-statusError border border-statusError/25">
            <AlertCircle className="w-2.5 h-2.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cream-subtle dark:bg-charcoal-bg text-cream-muted dark:text-charcoal-muted border border-cream-border dark:border-charcoal-border">
            {data.status === 'waiting' ? 'Queued' : 'Idle'}
          </span>
        );
    }
  };

  const isActive = ['running', 'using_tool', 'planning', 'reviewing', 'retrying'].includes(data.status);

  return (
    <div
      className={`w-72 rounded-2xl border overflow-hidden transition-all duration-200 relative shadow-sm
        bg-cream-surface border-cream-border text-cream-text
        dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text
        ${isActive ? 'ring-2 ring-coral agent-active-pulse' : 'hover:border-coral/50'}
        ${data.isSelected ? 'ring-2 ring-amberAccent border-amberAccent' : ''}`}
    >
      {/* Top 3px category stripe */}
      <div
        className={`h-1 w-full ${
          data.category === 'custom' ? 'bg-amberAccent' : 'bg-coral'
        }`}
      />

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-coral !border-2 !border-cream-surface dark:!border-charcoal-surface"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-amberAccent !border-2 !border-cream-surface dark:!border-charcoal-surface"
      />

      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-cream-border dark:border-charcoal-border">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                data.category === 'custom'
                  ? 'bg-amberAccent/15 text-amberAccent'
                  : 'bg-coral/15 text-coral'
              }`}
            >
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs tracking-tight truncate">{data.name}</div>
              <div className="text-[10px] text-cream-muted dark:text-charcoal-muted">
                {data.category === 'custom' ? 'Custom agent' : 'Built-in'}
              </div>
            </div>
          </div>

          {getStatusBadge()}
        </div>

        <div className="space-y-1 text-left">
          <div className="text-[11px] font-semibold text-coral line-clamp-1">{data.role}</div>
          <div className="text-[11px] text-cream-muted dark:text-charcoal-muted line-clamp-2 leading-relaxed">
            {data.currentTaskTitle ? `Task: ${data.currentTaskTitle}` : 'Awaiting task assignment…'}
          </div>
        </div>

        <div className="pt-2 border-t border-cream-border dark:border-charcoal-border flex items-center justify-between text-[10px] font-mono text-cream-muted dark:text-charcoal-muted">
          <span>{data.duration ? `${data.duration}s` : '—'}</span>
          {!!data.retryCount && (
            <span className="font-semibold text-amberAccent">Retries: {data.retryCount}</span>
          )}
          {data.criticScore !== undefined && (
            <span className="font-semibold text-coral">Score: {data.criticScore}/10</span>
          )}
        </div>
      </div>
    </div>
  );
});

CustomAgentNode.displayName = 'CustomAgentNode';
