import React from 'react';
import { cn } from '../../lib/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-surface border-border text-foreground',
    secondary: 'bg-surface-hover border-border text-foreground-secondary',
    success: 'bg-success-subtle border-success/30 text-success',
    warning: 'bg-warning-subtle border-warning/30 text-warning',
    danger: 'bg-danger-subtle border-danger/30 text-danger',
    info: 'bg-info-subtle border-info/30 text-info',
    outline: 'bg-transparent border-border-strong text-foreground',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium tracking-wide',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
