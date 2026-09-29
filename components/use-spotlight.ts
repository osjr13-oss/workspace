"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";

/**
 * Tracks the cursor position over an element and exposes CSS custom
 * properties (--mx / --my) plus a data-active flag consumed by the
 * `.spotlight` class in globals.css to render a cursor-following border.
 */
export function useSpotlight<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: "50%", y: "50%" });

  const onMouseMove = useCallback((event: React.MouseEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: `${event.clientX - rect.left}px`,
      y: `${event.clientY - rect.top}px`,
    });
  }, []);

  const onMouseEnter = useCallback(() => setActive(true), []);
  const onMouseLeave = useCallback(() => setActive(false), []);

  const style = { "--mx": pos.x, "--my": pos.y } as CSSProperties;

  return {
    spotlightProps: {
      ref,
      onMouseMove,
      onMouseEnter,
      onMouseLeave,
      "data-active": active,
      style,
    },
  };
}
