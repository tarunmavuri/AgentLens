import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  label?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, label = 'More information' }) => {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex items-center ml-1.5 align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={label}
        className="text-cream-muted dark:text-charcoal-muted hover:text-coral focus:outline-none transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 rounded-lg text-[11px] font-normal normal-case tracking-normal leading-relaxed shadow-lg z-50 border
            bg-cream-text text-cream-surface border-charcoal-border
            dark:bg-charcoal-subtle dark:text-charcoal-text dark:border-charcoal-border pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
};
