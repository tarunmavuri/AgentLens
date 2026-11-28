import React, { useState } from 'react';
import { Event } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import {
  AlertTriangle,
  Sparkles,
  BookOpen,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface ActivityTimelineProps {
  events: Event[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events }) => {
  const { selectConceptById } = useAppStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

  const filteredEvents = events.filter((e) => {
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
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amberAccent/15 text-amberAccent">
            Thought
          </span>
        );
      case 'tool_call':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-coral/15 text-coral">
            Tool Call
          </span>
        );
      case 'tool_result':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-statusSuccess/10 text-statusSuccess">
            Tool Result
          </span>
        );
      case 'critique':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-coral/15 text-coral">
            Critic Review
          </span>
        );
      case 'retry':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amberAccent/15 text-amberAccent">
            Retry
          </span>
        );
      case 'artifact':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-statusSuccess/10 text-statusSuccess">
            Artifact
          </span>
        );
      case 'fault_injected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-statusError/10 text-statusError">
            Fault Injected
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cream-subtle dark:bg-charcoal-bg text-cream-muted dark:text-charcoal-muted">
            {type.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden">
      <div className="px-4 py-2.5 border-b border-cream-border dark:border-charcoal-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
          {(
            [
              ['all', 'All Events'],
              ['thought', 'Thoughts'],
              ['tool', 'Tools'],
              ['critique', 'Critiques & Retries'],
              ['artifact', 'Artifacts'],
            ] as const
          ).map(([ft, label]) => (
            <button
              key={ft}
              type="button"
              onClick={() => setFilterType(ft)}
              className={`px-3 py-1 rounded-full font-semibold transition-colors whitespace-nowrap ${
                filterType === ft
                  ? 'bg-coral text-white'
                  : 'text-cream-muted dark:text-charcoal-muted hover:bg-cream-subtle dark:hover:bg-charcoal-subtle'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-mono text-cream-muted dark:text-charcoal-muted">
          {filteredEvents.length} events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-cream-border dark:divide-charcoal-border text-xs">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-cream-muted dark:text-charcoal-muted">
            No events match this filter yet.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const isExpanded = expandedEventId === ev.id;
            return (
              <div
                key={ev.id}
                className="p-3.5 hover:bg-cream-subtle/40 dark:hover:bg-charcoal-bg/50 transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-cream-muted dark:text-charcoal-muted">
                      #{ev.id}
                    </span>
                    <span className="font-semibold text-xs text-coral">{ev.agent_id}</span>
                    {getEventBadge(ev.type)}
                  </div>

                  <div className="flex items-center gap-2">
                    {ev.concept && (
                      <button
                        type="button"
                        onClick={() => selectConceptById(ev.concept!)}
                        title="Explain this Agentic AI concept"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                          border border-coral/30 text-coral bg-coral/5 hover:bg-coral/15 transition-colors"
                      >
                        <BookOpen className="w-2.5 h-2.5" />
                        <span>Explain</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                      aria-label="Toggle raw JSON payload"
                      className="text-cream-muted hover:text-cream-text dark:hover:text-charcoal-text p-1 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-xs leading-relaxed">
                  {ev.type === 'thought' && (
                    <p className="italic text-cream-muted dark:text-charcoal-muted">
                      “{ev.payload?.thought}”
                    </p>
                  )}
                  {ev.type === 'tool_call' && (
                    <div className="font-mono text-[11px] bg-cream-bg dark:bg-charcoal-bg p-2 rounded-lg overflow-x-auto">
                      <span className="text-coral font-semibold">{ev.payload?.tool}</span>(
                      {JSON.stringify(ev.payload?.args)})
                    </div>
                  )}
                  {ev.type === 'tool_result' && (
                    <div className="font-mono text-[11px] bg-cream-bg dark:bg-charcoal-bg p-2 rounded-lg line-clamp-3">
                      {typeof ev.payload?.result === 'object'
                        ? JSON.stringify(ev.payload?.result)
                        : ev.payload?.stdout || JSON.stringify(ev.payload)}
                    </div>
                  )}
                  {ev.type === 'critique' && (
                    <div className="pl-3 border-l-2 border-coral space-y-0.5">
                      <div className="flex items-center gap-3 font-semibold text-coral">
                        <span>Score: {ev.payload?.score}/10</span>
                        <span className="uppercase text-[10px]">{ev.payload?.verdict}</span>
                      </div>
                      <p>{ev.payload?.feedback}</p>
                    </div>
                  )}
                  {ev.type === 'fault_injected' && (
                    <div className="pl-3 border-l-2 border-statusError text-statusError font-semibold text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{ev.payload?.description}</span>
                    </div>
                  )}
                  {ev.type === 'artifact' && (
                    <div className="text-xs text-amberAccent font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        Artifact created: {ev.payload?.name} ({ev.payload?.type})
                      </span>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-2 p-2.5 rounded-lg bg-cream-bg dark:bg-charcoal-bg font-mono text-[10px] overflow-x-auto">
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
