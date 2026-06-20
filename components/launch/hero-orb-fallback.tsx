export function HeroOrbFallback() {
  return (
    <div className="launch-orb-fade relative mx-auto flex h-[320px] w-[320px] items-center justify-center sm:h-[420px] sm:w-[420px]">
      <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(21,24,31,0.12)" />
            <stop offset="100%" stopColor="rgba(21,24,31,0)" />
          </radialGradient>
        </defs>
        <circle cx="160" cy="160" r="120" fill="url(#orbGlow)" />
        <circle cx="160" cy="160" r="88" fill="none" stroke="rgba(21,24,31,0.15)" strokeWidth="1.5" />
        <circle cx="160" cy="160" r="64" fill="rgba(255,255,255,0.55)" stroke="rgba(21,24,31,0.2)" strokeWidth="1" />
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const x = 160 + Math.cos(angle) * 100;
          const y = 160 + Math.sin(angle) * 100;
          const h = 8 + (i % 5) * 6;
          return (
            <rect
              key={i}
              x={x - 2}
              y={y - h / 2}
              width="4"
              height={h}
              rx="2"
              fill="rgba(21,24,31,0.5)"
              transform={`rotate(${(angle * 180) / Math.PI + 90}, ${x}, ${y})`}
            />
          );
        })}
      </svg>
    </div>
  );
}
