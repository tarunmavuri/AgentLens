import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, CheckCircle2, Clock, AlertCircle, Wrench, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

interface AgentNodeData {
  agent_id: string;
  name: string;
  role: string;
  category: 'built_in' | 'custom' | 'system';
  status: 'idle' | 'waiting' | 'planning' | 'running' | 'using_tool' | 'reviewing' | 'retrying' | 'completed' | 'failed';
  currentTaskTitle?: string;
  criticScore?: number;
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
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-coral text-white animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
            <span>{data.status.replace('_', ' ')}</span>
          </span>
        );
      case 'reviewing':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-500 text-white">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Reviewing</span>
          </span>
        );
      case 'retrying':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amberAccent text-white animate-bounce">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Retrying</span>
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Done</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-500 text-white">
            <AlertCircle className="w-2.5 h-2.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider dark:bg-charcoal-bg bg-cream-bg dark:text-charcoal-muted text-cream-muted border dark:border-charcoal-border border-cream-border">
            {data.status}
          </span>
        );
    }
  };

  const isActive = ['running', 'using_tool', 'planning', 'reviewing', 'retrying'].includes(data.status);

  return (
    <div className={`w-72 rounded-2xl border p-4 transition-all duration-300 relative shadow-md
      dark:bg-charcoal-surface dark:border-charcoal-border 
      bg-cream-surface border-cream-border ${
        isActive ? 'ring-2 ring-coral shadow-coral/20' : 'hover:border-coral/50'
      } ${data.isSelected ? 'ring-2 ring-amberAccent' : ''}`}>
      
      {/* Node Input and Output Handles */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-coral !border-2 dark:!border-charcoal-surface !border-cream-surface" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-coral !border-2 dark:!border-charcoal-surface !border-cream-surface" />

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b dark:border-charcoal-border border-cream-border">
        <div className="flex items-center space-x-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
            data.category === 'custom' ? 'bg-purple-500/10 text-purple-500' : 'bg-coral/10 text-coral'
          }`}>
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs tracking-tight">{data.name}</div>
            <div className="text-[10px] dark:text-charcoal-muted text-cream-muted leading-none mt-0.5 font-medium">
              {data.category}
            </div>
          </div>
        </div>

        {getStatusBadge()}
      </div>

      {/* Role & Task Info */}
      <div className="py-2.5 space-y-1.5 text-left">
        <div className="text-[11px] font-semibold text-coral line-clamp-1">{data.role}</div>
        <div className="text-[11px] dark:text-charcoal-muted text-cream-muted line-clamp-2 leading-relaxed">
          {data.currentTaskTitle ? `Task: ${data.currentTaskTitle}` : 'Waiting for task assignment...'}
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="pt-2 border-t dark:border-charcoal-border border-cream-border flex items-center justify-between text-[10px] font-mono dark:text-charcoal-muted text-cream-muted">
        <span>{data.duration ? `${data.duration}s` : '0.0s'}</span>
        {data.criticScore !== undefined && (
          <span className="font-bold text-coral">Score: {data.criticScore}/10</span>
        )}
      </div>

    </div>
  );
});

CustomAgentNode.displayName = 'CustomAgentNode';

