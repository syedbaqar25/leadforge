import React from 'react';
import { cn } from '../../lib/cn';

export type ScoreBand = 'hot' | 'warm' | 'cold';

interface ScoreBadgeProps {
  band: ScoreBand | string;
  score?: number;
  className?: string;
  showScore?: boolean;
}

/**
 * Lead qualification score badge strictly adhering to the Editorial Paper design tokens
 * and WCAG AA accessibility rules (distinguished by SHAPE + LABEL, not color alone).
 * - Hot: ▲ triangle + 'Hot' label
 * - Warm: ■ square + 'Warm' label
 * - Cold: ● circle + 'Cold' label
 */
export function ScoreBadge({ band, score, className, showScore = true }: ScoreBadgeProps) {
  const normalizedBand = (band || 'cold').toLowerCase() as ScoreBand;

  switch (normalizedBand) {
    case 'hot':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm border border-danger/30 bg-danger-subtle px-2 py-0.5 text-xs font-semibold text-danger tabular-nums',
            className,
          )}
          title={`Score: ${score ?? 75}+ (Hot Lead)`}
        >
          <span className="text-[10px]" aria-hidden="true">
            ▲
          </span>
          <span>Hot</span>
          {showScore && score !== undefined && <span className="opacity-80">({score})</span>}
        </span>
      );

    case 'warm':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm border border-warning/30 bg-warning-subtle px-2 py-0.5 text-xs font-semibold text-warning tabular-nums',
            className,
          )}
          title={`Score: ${score ?? 40}-74 (Warm Lead)`}
        >
          <span className="text-[10px]" aria-hidden="true">
            ■
          </span>
          <span>Warm</span>
          {showScore && score !== undefined && <span className="opacity-80">({score})</span>}
        </span>
      );

    case 'cold':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm border border-info/30 bg-info-subtle px-2 py-0.5 text-xs font-semibold text-info tabular-nums',
            className,
          )}
          title={`Score: ${score ?? 0}-39 (Cold Lead)`}
        >
          <span className="text-[10px]" aria-hidden="true">
            ●
          </span>
          <span>Cold</span>
          {showScore && score !== undefined && <span className="opacity-80">({score})</span>}
        </span>
      );
  }
}
