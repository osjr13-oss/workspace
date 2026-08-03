"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useSpotlight } from "@/components/use-spotlight";

export function LandingCta() {
  const { spotlightProps } = useSpotlight<HTMLAnchorElement>();

  return (
    <Link
      href="/signup"
      className="btn-primary spotlight group"
      style={{
        ...spotlightProps.style,
        ["--spot-size" as string]: "140px",
      }}
      ref={spotlightProps.ref}
      onMouseMove={spotlightProps.onMouseMove}
      onMouseEnter={spotlightProps.onMouseEnter}
      onMouseLeave={spotlightProps.onMouseLeave}
      data-active={spotlightProps["data-active"]}
    >
      Get started free
      <motion.span
        className="inline-flex"
        initial={false}
        whileHover={{ x: 2 }}
        aria-hidden="true"
      >
        <ArrowRight
          size={18}
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </motion.span>
    </Link>
  );
}
