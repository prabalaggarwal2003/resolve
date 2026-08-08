'use client';

import { type ReactNode } from 'react';
import { useInView } from './useInView';

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-5 inline-flex items-center px-3.5 py-1.5 rounded-full bg-gray-800/70 border border-gray-700/60 text-[11px] font-semibold text-gray-400 tracking-[0.18em] uppercase backdrop-blur-sm">
      {children}
    </span>
  );
}
