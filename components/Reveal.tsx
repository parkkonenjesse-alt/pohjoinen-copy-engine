"use client";

import { useReveal } from "@/hooks/useReveal";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

// Wraps content in a scroll-triggered fade + rise. Motion is removed entirely
// for users who prefer reduced motion (handled in globals.css).
export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${shown ? "is-shown" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
