import React from 'react';
import { Event } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { agentPlain, eventPlain } from '../../lib/plain';
import { BookOpen } from 'lucide-react';

interface StoryFeedProps {
  events: Event[];
}

export const StoryFeed: React.FC<StoryFeedProps> = ({ events }) => {
  const { selectConceptById } = useAppStore();

  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div className="max-w-sm space-y-1.5">
          <p className="text-sm font-semibold">No execution steps yet</p>
          <p className="text-xs text-cream-muted dark:text-charcoal-muted">
            Once a run starts, every action, tool call, and critic verdict unfolds here in plain
            language.
          </p>
        </div>
      </div>
    );
  }

  const firstTs = events[0].ts;

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <ol className="relative max-w-3xl mx-auto space-y-1">
        <div className="absolute left-[17px] top-2 bottom-2 w-px bg-cream-border dark:bg-charcoal-border" />

        {events.map((event) => {
          const plain = eventPlain(event);
          const who = agentPlain(event.agent_id);
          const seconds = Math.max(0, Math.round(event.ts - firstTs));
          const isNote = event.type === 'thought';

          return (
            <li
              key={event.id}
              className="relative pl-11 pr-2 py-2 rounded-lg hover:bg-cream-subtle/50 dark:hover:bg-charcoal-subtle/50 transition-colors"
            >
              <span className="absolute left-0 top-2 w-9 h-9 rounded-full border border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface flex items-center justify-center text-sm">
                <span aria-hidden="true">{plain.emoji}</span>
              </span>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-coral">
                  {who.name}
                </span>
                <span className="text-[10px] font-mono text-cream-muted dark:text-charcoal-muted">
                  +{seconds}s
                </span>
                {event.concept && (
                  <button
                    type="button"
                    onClick={() => selectConceptById(event.concept!)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-coral/30 text-coral bg-coral/5 hover:bg-coral/15 transition-colors"
                  >
                    <BookOpen className="w-2.5 h-2.5" />
                    <span>Explain</span>
                  </button>
                )}
              </div>

              <p
                className={`mt-0.5 text-xs leading-snug ${
                  isNote ? 'italic text-cream-muted dark:text-charcoal-muted' : 'font-semibold'
                }`}
              >
                {plain.title}
              </p>

              {plain.detail && (
                <p className="mt-0.5 text-xs leading-relaxed text-cream-muted dark:text-charcoal-muted line-clamp-3">
                  {plain.detail}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
