import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, BookOpen, ExternalLink } from 'lucide-react';

export const WhyModal: React.FC = () => {
  const { selectedConcept, selectConceptById } = useAppStore();

  if (!selectedConcept) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4
          bg-cream-surface border-cream-border text-cream-text
          dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text"
      >
        <div className="flex items-center justify-between border-b border-cream-border dark:border-charcoal-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-coral/10 text-coral flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-coral">
                Agentic AI Concept
              </span>
              <h3 className="font-bold text-base">{selectedConcept.title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => selectConceptById('')}
            aria-label="Close concept dialog"
            className="p-1.5 rounded-full text-cream-muted hover:text-cream-text hover:bg-cream-subtle dark:hover:bg-charcoal-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed">{selectedConcept.explanation}</p>

        <div className="pt-3 border-t border-cream-border dark:border-charcoal-border flex items-center justify-between">
          <span className="text-xs text-cream-muted dark:text-charcoal-muted">
            Reference documentation
          </span>
          <a
            href={selectedConcept.learn_more_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-coral hover:underline"
          >
            <span>Read Specification</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
