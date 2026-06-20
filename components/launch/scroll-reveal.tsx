"use client";

import type { ReactNode } from "react";
import { useScrollReveal } from "@/components/launch/use-scroll-reveal";

export function ScrollReveal({
  children,
  className = "",
  as: Tag = "div"
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  return (
    <Tag ref={ref as never} className={`launch-fade-up ${visible ? "is-visible" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
