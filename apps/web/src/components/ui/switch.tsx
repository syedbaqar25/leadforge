'use client';

import React from 'react';
import { cn } from '../../lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Editorial Paper tactile switch with smooth spring microanimation on toggles.
 * Features:
 * - Tactile active compression (active:scale-95)
 * - Smooth thumb translation with ease-out timing
 * - High-contrast focus rings and accessible ARIA attributes
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  id,
  className,
  ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-normal ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1',
        'active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none select-none',
        checked ? 'bg-accent' : 'bg-border-strong hover:bg-border-strong/80',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-normal ease-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}
