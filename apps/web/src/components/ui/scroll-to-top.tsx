'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Editorial Paper scroll-to-top micro-interaction.
 * Appears with a smooth slide-and-fade when scrolling down the page.
 * Provides instant active click feedback and glides smoothly back to top.
 */
export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Check both window scroll and possible scrollable main container
      const mainEl = document.querySelector('main');
      const scrollTop =
        window.scrollY || document.documentElement.scrollTop || mainEl?.scrollTop || 0;

      if (scrollTop > 180) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Back to top"
      className={cn(
        'fixed bottom-6 right-6 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition-all duration-normal ease-out',
        'hover:border-border-strong hover:bg-surface-hover hover:text-accent hover:-translate-y-0.5 hover:shadow-md',
        'active:scale-90 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-accent/40',
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none scale-90',
      )}
    >
      <ArrowUp className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
