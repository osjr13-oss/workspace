"use client";

import { formatDay } from "@/lib/dates";

/**
 * Small hand-drawn SVG charts. They scale to their container, use the page's
 * colors, and carry a text summary for screen readers.
 */

type WeightPoint = { date: string; weight: number | null; trend: number };

export function WeightChart({ points, unitLabel, convert, goal }: { points: WeightPoint[]; unitLabel: string; convert: (kg: number) => number; goal?: number | null }) {
  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">Log your weight on two different days to see your trend.</p>;
  }
  const width = 420;
  const height = 230;
  const pad = { top: 14, right: 10, bottom: 26, left: 40 };
  const values = points.flatMap((point) => [point.trend, point.weight ?? point.trend]).map(convert);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 2) {
    min -= 1;
    max += 1;
  }
  const spread = max - min;
  min -= spread * 0.08;
  max += spread * 0.08;
  const x = (index: number) => pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - (value - min) / (max - min)) * (height - pad.top - pad.bottom);
  const trendPath = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(convert(point.trend)).toFixed(1)}`).join(" ");
  const ticks = [min + (max - min) * 0.15, (min + max) / 2, max - (max - min) * 0.15];
  const labelEvery = Math.max(1, Math.ceil(points.length / 4));
  const last = points[points.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Weight trend from ${formatDay(points[0].date)} to ${formatDay(last.date)}, now ${convert(last.trend).toFixed(1)} ${unitLabel}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" />
            <text x={pad.left - 6} y={y(tick) + 4} textAnchor="end" className="chart-label">{tick.toFixed(1)}</text>
          </g>
        ))}
        {goal && convert(goal) >= min && convert(goal) <= max ? (
          <g>
            <line x1={pad.left} x2={width - pad.right} y1={y(convert(goal))} y2={y(convert(goal))} stroke="var(--low)" strokeDasharray="4 4" />
            <text x={width - pad.right} y={y(convert(goal)) - 5} textAnchor="end" className="chart-label" fill="var(--low)">goal</text>
          </g>
        ) : null}
        {points.map((point, index) =>
          point.weight === null ? null : <circle key={point.date} cx={x(index)} cy={y(convert(point.weight))} r={2.6} fill="var(--muted)" opacity={0.55} />
        )}
        <path d={trendPath} fill="none" stroke="var(--text)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) =>
          index % labelEvery === 0 || index === points.length - 1 ? (
            <text key={`l-${point.date}`} x={x(index)} y={height - 6} textAnchor="middle" className="chart-label">
              {formatDay(point.date, { month: "short", day: "numeric" })}
            </text>
          ) : null
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-[12px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-[var(--text)]" /> Trend</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--muted)]" /> Weigh-ins</span>
      </figcaption>
    </figure>
  );
}

export function CalorieChart({ days }: { days: Array<{ date: string; kcal: number; target: number | null }> }) {
  if (!days.some((day) => day.kcal > 0)) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">Log food to see your days here.</p>;
  }
  const width = 420;
  const height = 210;
  const pad = { top: 12, right: 6, bottom: 26, left: 40 };
  const max = Math.max(...days.map((day) => Math.max(day.kcal, day.target ?? 0)), 500) * 1.1;
  const band = (width - pad.left - pad.right) / days.length;
  const barWidth = Math.max(3, Math.min(28, band * 0.62));
  const y = (value: number) => pad.top + (1 - value / max) * (height - pad.top - pad.bottom);
  const labelEvery = Math.max(1, Math.ceil(days.length / 5));
  const ticks = [max * 0.25, max * 0.5, max * 0.75].map((tick) => Math.round(tick / 100) * 100);
  const logged = days.filter((day) => day.kcal > 0);
  const average = Math.round(logged.reduce((sum, day) => sum + day.kcal, 0) / Math.max(1, logged.length));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Calories on ${logged.length} logged days, averaging ${average} kcal`}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" />
          <text x={pad.left - 6} y={y(tick) + 4} textAnchor="end" className="chart-label">{tick}</text>
        </g>
      ))}
      {days.map((day, index) => {
        const cx = pad.left + band * index + band / 2;
        const over = day.target !== null && day.kcal > day.target * 1.05;
        return (
          <g key={day.date}>
            {day.kcal > 0 ? (
              <rect x={cx - barWidth / 2} y={y(day.kcal)} width={barWidth} height={Math.max(1, y(0) - y(day.kcal))} rx={Math.min(5, barWidth / 2)} fill={over ? "var(--high)" : "var(--text)"} opacity={over ? 0.75 : 0.82}>
                <title>{`${formatDay(day.date)}: ${Math.round(day.kcal)} kcal`}</title>
              </rect>
            ) : null}
            {day.target ? <line x1={cx - band / 2 + 1} x2={cx + band / 2 - 1} y1={y(day.target)} y2={y(day.target)} stroke="var(--low)" strokeWidth={2} /> : null}
            {index % labelEvery === 0 ? (
              <text x={cx} y={height - 6} textAnchor="middle" className="chart-label">{formatDay(day.date, days.length <= 7 ? { weekday: "short" } : { month: "short", day: "numeric" })}</text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** A ring showing how much of the day's calorie target is used. */
export function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const size = 156;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, target > 0 ? eaten / target : 0);
  const remaining = Math.round(target - eaten);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-subtle)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={remaining < -target * 0.05 ? "var(--high)" : "var(--text)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-extrabold tabular-nums tracking-[-0.03em]">{Math.abs(remaining).toLocaleString()}</p>
        <p className="text-[12px] font-bold text-[var(--muted)]">{remaining >= 0 ? "kcal left" : "kcal over"}</p>
      </div>
    </div>
  );
}

export function MacroBar({ label, value, target }: { label: string; value: number; target: number }) {
  const fraction = Math.min(1, target > 0 ? value / target : 0);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-bold">{label}</span>
        <span className="tabular-nums text-[var(--muted-strong)]">{Math.round(value)} / {target} g</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
        <div className="h-full rounded-full bg-[var(--text)]" style={{ width: `${fraction * 100}%`, transition: "width 400ms ease" }} />
      </div>
    </div>
  );
}
