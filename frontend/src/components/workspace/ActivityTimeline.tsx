import React, { useState } from 'react';
import { Event } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { 
  Terminal, 
  Search, 
  Code2, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  BookOpen, 
  FileText,
  ChevronRight,
  ChevronDown,
  Layers,
  Wrench,
  Activity
} from 'lucide-react';

interface ActivityTimelineProps {
  events: Event[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events }) => {
  const { selectConceptById } = useAppStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

  const filteredEvents = events.filter(e => {
    if (filterType === 'all') return true;
    if (filterType === 'thought') return e.type === 'thought';
    if (filterType === 'tool') return e.type === 'tool_call' || e.type === 'tool_result';
    if (filterType === 'critique') return e.type === 'critique' || e.type === 'retry';
    if (filterType === 'artifact') return e.type === 'artifact';
    return true;
  });

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'thought':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500">Thought</span>;
      case 'tool_call':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-coral/10 text-coral">Tool Call</span>;
      case 'tool_result':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500">Observation</span>;
      case 'critique':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-500">Critique</span>;
      case 'retry':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amberAccent">Retry</span>;
      case 'artifact':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-pink-500/10 text-pink-500">Artifact</span>;
      case 'fault_injected':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-500 font-bold">Fault Injected</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider dark:bg-charcoal-bg bg-cream-bg text-neutral-400">{type}</span>;
    }
  };

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden">
      
      {/* Filter Header */}
      <div className="p-3 border-b dark:border-charcoal-border border-cream-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px]">
          {(['all', 'thought', 'tool', 'critique', 'artifact'] as const).map((ft) => (
            <button
              key={ft}
              onClick={() => setFilterType(ft)}
              className={`px-3 py-1 rounded-lg font-bold uppercase tracking-wider transition-colors ${
                filterType === ft
                  ? 'bg-coral text-white'
                  : 'dark:hover:bg-charcoal-bg hover:bg-cream-bg dark:text-charcoal-muted text-cream-muted'
              }`}
            >
              {ft}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-mono dark:text-charcoal-muted text-cream-muted">
          {filteredEvents.length} events logged
        </span>
      </div>

      {/* Events Stream List */}
      <div className="flex-1 overflow-y-auto divide-y dark:divide-charcoal-border divide-cream-border text-xs">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center dark:text-charcoal-muted text-cream-muted">
            No events recorded yet. Start a run to view real-time agent execution stream.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const isExpanded = expandedEventId === ev.id;
            return (
              <div 
                key={ev.id}
                className="p-3.5 hover:dark:bg-charcoal-bg/60 hover:bg-cream-bg/60 transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] dark:text-charcoal-muted text-cream-muted">
                      #{ev.id}
                    </span>
                    <span className="font-bold text-xs uppercase text-coral">
                      {ev.agent_id}
                    </span>
                    {getEventBadge(ev.type)}
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Why? Concept Badge */}
                    {ev.concept && (
                      <button
                        onClick={() => selectConceptById(ev.concept!)}
                        title="Click to view Why? architectural rationale"
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider 
                          border border-coral/30 text-coral bg-coral/5 hover:bg-coral/15 transition-all"
                      >
                        <BookOpen className="w-2.5 h-2.5" />
                        <span>Why: {ev.concept}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                      className="text-neutral-400 hover:text-neutral-200 p-0.5"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Event Summary Preview */}
                <div className="text-xs dark:text-charcoal-text text-cream-text leading-relaxed">
                  {ev.type === 'thought' && (
                    <p className="italic dark:text-neutral-300 text-neutral-700">
                      "{ev.payload?.thought}"
                    </p>
                  )}
                  {ev.type === 'tool_call' && (
                    <div className="font-mono text-[11px] bg-black/5 dark:bg-black/30 p-2 rounded-lg">
                      <span className="text-coral font-bold">{ev.payload?.tool}</span>({JSON.stringify(ev.payload?.args)})
                    </div>
                  )}
                  {ev.type === 'tool_result' && (
                    <div className="font-mono text-[11px] bg-black/5 dark:bg-black/30 p-2 rounded-lg line-clamp-3">
                      {typeof ev.payload?.result === 'object' ? JSON.stringify(ev.payload?.result) : (ev.payload?.stdout || JSON.stringify(ev.payload))}
                    </div>
                  )}
                  {ev.type === 'critique' && (
                    <div className="p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-1">
                      <div className="flex items-center justify-between font-bold text-purple-400">
                        <span>Score: {ev.payload?.score}/10</span>
                        <span className="uppercase text-[10px]">{ev.payload?.verdict}</span>
                      </div>
                      <p className="text-xs">{ev.payload?.feedback}</p>
                    </div>
                  )}
                  {ev.type === 'fault_injected' && (
                    <div className="p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 font-bold text-xs flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span>{ev.payload?.description}</span>
                    </div>
                  )}
                  {ev.type === 'artifact' && (
                    <div className="text-xs text-pink-500 font-bold flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generated Artifact: {ev.payload?.name} ({ev.payload?.type})</span>
                    </div>
                  )}
                </div>

                {/* Full Payload View when expanded */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t dark:border-charcoal-border border-cream-border font-mono text-[10px] bg-black/20 p-2.5 rounded-lg overflow-x-auto">
                    <pre>{JSON.stringify(ev.payload, null, 2)}</pre>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

