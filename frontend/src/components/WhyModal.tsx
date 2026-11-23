import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, BookOpen, ExternalLink, Sparkles } from 'lucide-react';

export const WhyModal: React.FC = () => {
  const { selectedConcept, selectConceptById } = useAppStore();

  if (!selectedConcept) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text bg-cream-surface border-cream-border text-cream-text shadow-2xl p-6 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-charcoal-border border-cream-border pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-coral/10 text-coral flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-coral">Why? Concept Deep Dive</span>
              <h3 className="font-bold text-base">{selectedConcept.title}</h3>
            </div>
          </div>
          <button 
            onClick={() => selectConceptById('')}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Explanation */}
        <div className="space-y-3">
          <p className="text-sm dark:text-charcoal-text text-cream-text leading-relaxed">
            {selectedConcept.explanation}
          </p>
        </div>

        {/* Learn more link */}
        <div className="pt-3 border-t dark:border-charcoal-border border-cream-border flex items-center justify-between">
          <span className="text-xs dark:text-charcoal-muted text-cream-muted">
            Foundational Literature & Spec:
          </span>
          <a
            href={selectedConcept.learn_more_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-coral hover:underline"
          >
            <span>Read Literature</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </div>
  );
};

