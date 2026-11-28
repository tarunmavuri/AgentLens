import React from 'react';

interface AgentLensLogoProps {
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
}

/**
 * Custom editorial optical-aperture mark for AgentLens:
 * Dual interlocking Coral (#FF513C) & Amber (#F47742) viewing curves form an
 * expressive human eye / optical prism framing an inner iris and focal constellation
 * — symbolizing human clarity and open multi-agent observation.
 */
export const AgentLensLogo: React.FC<AgentLensLogoProps> = ({
  size = 34,
  showWordmark = true,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none group ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        {/* Outer organic aperture contour: upper coral sweep + lower warm amber sweep */}
        <path
          d="M4.5 18C8.4 11 13 8 18 8C23 8 27.6 11 31.5 18"
          stroke="#FF513C"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M31.5 18C27.6 25 23 28 18 28C13 28 8.4 25 4.5 18"
          stroke="#F47742"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Subtle rotated inner prism blade */}
        <circle
          cx="18"
          cy="18"
          r="5.6"
          className="stroke-cream-text/85 dark:stroke-charcoal-text/90"
          strokeWidth="1.9"
        />

        {/* Collaborative focal satellites anchored to the lens ring */}
        <circle cx="9.5" cy="18" r="1.8" fill="#FF513C" />
        <circle cx="26.5" cy="18" r="1.8" fill="#F47742" />

        {/* Luminous pupil core */}
        <circle cx="18" cy="18" r="2.2" fill="#FF513C" />
      </svg>

      {showWordmark && (
        <div className="leading-none">
          <div className="flex items-baseline gap-0.5 tracking-tight">
            <span className="font-bold text-lg text-cream-text dark:text-charcoal-text">
              Agent
            </span>
            <span className="font-editorial italic text-[22px] text-coral leading-none">
              Lens
            </span>
          </div>
          {subtitle && (
            <p className="text-[11px] font-medium text-cream-muted dark:text-charcoal-muted mt-0.5 hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
