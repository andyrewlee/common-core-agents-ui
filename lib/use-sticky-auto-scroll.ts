"use client";

import { useEffect, useState, type RefObject } from "react";

type Options = {
  threshold?: number; // px distance from bottom to consider "at bottom"
};

/**
 * Keeps a scroll container pinned to the bottom while new content streams in,
 * but stops auto-scrolling if the user scrolls up. Auto-scroll resumes once
 * the user returns to the bottom area (within `threshold`).
 */
export function useStickyAutoScroll<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null> | { current: T | null },
  deps: ReadonlyArray<unknown> = [],
  { threshold = 24 }: Options = {}
) {
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setStickToBottom(distanceFromBottom <= threshold);
    };

    // Initialize state and attach listener
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [ref, threshold]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stickToBottom) {
      el.scrollTop = el.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickToBottom, ...deps]);
}
