import React from 'react';
import { cn } from '../../lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-normal ease-out focus:outline-none focus:ring-2 focus:ring-accent/40 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none disabled:transform-none rounded-md select-none cursor-pointer';

    const sizeStyles = {
      sm: 'px-2.5 py-1 text-xs gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-5 py-2.5 text-base gap-2.5',
    };

    const variantStyles = {
      primary:
        'bg-accent text-white hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow',
      secondary:
        'bg-surface-hover text-foreground hover:bg-border/60 hover:-translate-y-0.5 active:translate-y-0 border border-border',
      outline:
        'border border-border bg-surface text-foreground hover:bg-surface-hover hover:border-border-strong hover:-translate-y-0.5 active:translate-y-0',
      ghost: 'bg-transparent text-foreground hover:bg-surface-hover',
      danger:
        'bg-danger text-white hover:bg-danger/90 hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
