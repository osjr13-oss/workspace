"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSpotlight } from "@/components/use-spotlight";

type SpotlightVars = {
  /** Ring color (the tracked border) */
  color?: string;
  /** Soft inner glow color */
  glow?: string;
  /** Radius of the radial gradient */
  size?: string;
};

export function SpotlightCard({
  children,
  className = "",
  color,
  glow,
  size,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & SpotlightVars) {
  const { spotlightProps } = useSpotlight<HTMLDivElement>();

  const vars: Record<string, string> = {};
  if (color) vars["--spot-color"] = color;
  if (glow) vars["--spot-glow"] = glow;
  if (size) vars["--spot-size"] = size;

  return (
    <div
      className={`spotlight ${className}`}
      ref={spotlightProps.ref}
      onMouseMove={spotlightProps.onMouseMove}
      onMouseEnter={spotlightProps.onMouseEnter}
      onMouseLeave={spotlightProps.onMouseLeave}
      data-active={spotlightProps["data-active"]}
      style={{ ...spotlightProps.style, ...vars, ...style }}
    >
      {children}
    </div>
  );
}
