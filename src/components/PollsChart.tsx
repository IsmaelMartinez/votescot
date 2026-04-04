import React, { useState, useRef, useCallback } from "react";

interface PollEntry {
  date: string;
  endDate: string;
  pollster: string;
  client: string;
  sampleSize: number | null;
  snp: number | null;
  con: number | null;
  lab: number | null;
  libdem: number | null;
  green: number | null;
  alba: number | null;
  reform: number | null;
  others: number | null;
}

interface PollsData {
  lastUpdated: string;
  constituency: PollEntry[];
  regional: PollEntry[];
}

interface Props {
  data: PollsData;
}

const PARTIES = [
  { key: "snp" as keyof PollEntry, label: "SNP", color: "#9B870C" },
  { key: "lab" as keyof PollEntry, label: "Labour", color: "#DC241F" },
  { key: "con" as keyof PollEntry, label: "Conservative", color: "#0087DC" },
  { key: "reform" as keyof PollEntry, label: "Reform", color: "#12B6CF" },
  { key: "green" as keyof PollEntry, label: "Green", color: "#00A651" },
  { key: "libdem" as keyof PollEntry, label: "Lib Dem", color: "#FAA61A" },
  { key: "alba" as keyof PollEntry, label: "Alba", color: "#005EB8" },
] as const;

const CHART_W = 800;
const CHART_H = 260;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 28;

function dateToMs(d: string): number {
  return new Date(d).getTime();
}

export default function PollsChart({ data }: Props) {
  const [voteType, setVoteType] = useState<"constituency" | "regional">("constituency");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; poll: PollEntry } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const polls = data[voteType];

  // Last 12 months
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

  const filtered = polls.filter((p) => dateToMs(p.endDate) >= twelveMonthsAgo.getTime());

  const minMs = twelveMonthsAgo.getTime();
  const maxMs = now.getTime();
  const msRange = maxMs - minMs;

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;

  function xPos(dateStr: string): number {
    const t = dateToMs(dateStr);
    return PAD_LEFT + ((t - minMs) / msRange) * plotW;
  }

  function yPos(pct: number): number {
    return PAD_TOP + plotH - (pct / 50) * plotH;
  }

  // Y axis gridlines at 0, 10, 20, 30, 40, 50
  const yTicks = [0, 10, 20, 30, 40, 50];

  // X axis ticks: one per month
  const xTicks: Date[] = [];
  const d = new Date(twelveMonthsAgo);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  while (d <= now) {
    xTicks.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || filtered.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = CHART_W / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;

      // Find nearest poll by x position
      let nearest: PollEntry | null = null;
      let nearestDist = Infinity;
      for (const p of filtered) {
        const px = xPos(p.endDate);
        const dist = Math.abs(px - mx);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }
      if (nearest && nearestDist < 30) {
        const px = xPos(nearest.endDate);
        const py = nearest.snp !== null ? yPos(nearest.snp) : CHART_H / 2;
        setTooltip({ x: px, y: py, poll: nearest });
      } else {
        setTooltip(null);
      }
    },
    [filtered]
  );

  const monthLabel = (d: Date) =>
    d.toLocaleString("en-GB", { month: "short" });

  return (
    <div>
      {/* Toggle */}
      <div className="flex gap-2 mb-3">
        {(["constituency", "regional"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setVoteType(t)}
            className={[
              "px-3 py-1 font-body text-xs font-medium rounded uppercase tracking-wide transition-colors",
              voteType === t
                ? "bg-votescot-dark text-votescot-paper"
                : "bg-white border border-votescot-border text-gray-500 hover:border-gray-400",
            ].join(" ")}
          >
            {t === "constituency" ? "Constituency" : "Regional List"}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative bg-white border border-votescot-border rounded-md p-2 overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full"
          style={{ minWidth: 320 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Y gridlines and labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD_LEFT}
                x2={CHART_W - PAD_RIGHT}
                y1={yPos(v)}
                y2={yPos(v)}
                stroke="#e5e7eb"
                strokeWidth={v === 0 ? 1 : 0.5}
              />
              <text
                x={PAD_LEFT - 4}
                y={yPos(v) + 4}
                textAnchor="end"
                fontSize={9}
                fill="#9ca3af"
              >
                {v}%
              </text>
            </g>
          ))}

          {/* X axis month labels */}
          {xTicks.map((tick, i) => {
            const tx = xPos(tick.toISOString().slice(0, 10));
            return (
              <text
                key={i}
                x={tx}
                y={CHART_H - 6}
                textAnchor="middle"
                fontSize={8}
                fill="#9ca3af"
              >
                {monthLabel(tick)}
              </text>
            );
          })}

          {/* Party lines */}
          {PARTIES.map(({ key, color }) => {
            const points = filtered
              .filter((p) => p[key] !== null)
              .sort((a, b) => dateToMs(a.endDate) - dateToMs(b.endDate));
            if (points.length < 2) return null;
            const d = points
              .map((p, i) => {
                const x = xPos(p.endDate);
                const y = yPos(p[key] as number);
                return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ");
            return (
              <path
                key={String(key)}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.9}
              />
            );
          })}

          {/* Tooltip vertical line */}
          {tooltip && (
            <line
              x1={tooltip.x}
              x2={tooltip.x}
              y1={PAD_TOP}
              y2={CHART_H - PAD_BOTTOM}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}
        </svg>

        {/* Tooltip box */}
        {tooltip && (
          <div
            className="absolute bg-white border border-votescot-border rounded shadow-md text-[11px] font-body pointer-events-none z-10 p-2 min-w-[140px]"
            style={{
              left: `calc(${(tooltip.x / CHART_W) * 100}% + 6px)`,
              top: `${PAD_TOP + 8}px`,
              transform: tooltip.x / CHART_W > 0.7 ? "translateX(-110%)" : undefined,
            }}
          >
            <div className="font-bold text-gray-700 mb-1">
              {tooltip.poll.pollster}
            </div>
            <div className="text-gray-400 mb-1.5">
              {tooltip.poll.endDate}
              {tooltip.poll.sampleSize ? ` · n=${tooltip.poll.sampleSize.toLocaleString()}` : ""}
            </div>
            {PARTIES.map(({ key, label, color }) => {
              const val = tooltip.poll[key];
              if (val === null) return null;
              return (
                <div key={String(key)} className="flex justify-between gap-3">
                  <span style={{ color }}>{label}</span>
                  <span className="font-medium text-gray-700">{val}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {PARTIES.map(({ key, label, color }) => (
          <div key={String(key)} className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-full"
              style={{ width: 10, height: 10, background: color }}
            />
            <span className="font-body text-[11px] text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
