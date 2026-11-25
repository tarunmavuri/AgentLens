import React from 'react';
import { motion } from 'framer-motion';
import { Event } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { agentPlain, eventPlain } from '../../lib/plain';
import { BookOpen } from 'lucide-react';

interface StoryFeedProps {
  events: Event[];
}

/**
 * The beginner-friendly version of the event log: one sentence per step, in
 * order, with the agent's friendly name. Technical payloads live in the
 * "Technical log" view instead of being mixed in here.
 */
export const StoryFeed: React.FC<StoryFeedProps> = ({ events }) => {
  const { selectConceptById } = useAppStore();

  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-bold">Nothing has happened yet</p>
          <p className="text-xs dark:text-charcoal-muted text-cream-muted">
            Once a run starts, every step shows up here in order — who did what, and why.
          </p>
        </div>
      </div>
    );
  }

  const firstTs = events[0].ts;
  const visible = events;

  return (
    <div className="h-full overflow-y-auto px-5 py-6">
      <ol className="relative max-w-3xl mx-auto space-y-1">
        <div className="absolute left-[19px] top-2 bottom-2 w-px dark:bg-charcoal-border bg-cream-border" />

        {visible.map((event, index) => {
          const plain = eventPlain(event);
          const who = agentPlain(event.agent_id);
          const seconds = Math.max(0, Math.round(event.ts - firstTs));
          const isNote = event.type === 'thought';

          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.015, 0.3) }}
              className="relative pl-12 pr-2 py-2.5 rounded-xl hover:dark:bg-charcoal-surface/60 hover:bg-cream-surface/60 transition-colors"
            >
              <span className="absolute left-0 top-2.5 w-10 h-10 rounded-full border dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface flex items-center justify-center text-base shadow-sm">
                <span aria-hidden="true">{plain.emoji}</span>
              </span>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-coral">
                  {who.name}
                </span>
                <span className="text-[10px] font-mono dark:text-charcoal-muted text-cream-muted">
                  +{seconds}s
                </span>
                {event.concept && (
                  <button
                    onClick={() => selectConceptById(event.concept!)}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-coral/30 text-coral bg-coral/5 hover:bg-coral/15 transition-colors"
                  >
                    <BookOpen className="w-2.5 h-2.5" />
                    <span>Why?</span>
                  </button>
                )}
              </div>

              <p className={`mt-0.5 text-sm leading-snug ${isNote ? 'italic dark:text-charcoal-muted text-cream-muted' : 'font-semibold'}`}>
                {plain.title}
              </p>

              {plain.detail && (
                <p className="mt-1 text-xs leading-relaxed dark:text-charcoal-muted text-cream-muted line-clamp-4">
                  {plain.detail}
                </p>
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
};
