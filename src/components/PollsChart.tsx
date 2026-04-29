import React, { useState, useRef, useCallback, useMemo } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { PARTY_THEMES_BY_SHORT } from "../lib/party-config";
import { centredRollingMean, DAY_MS } from "../lib/polls-smoothing";
import { BASELINE_2021_CONSTITUENCY, BASELINE_2021_REGIONAL, type PartyKey } from "../lib/poll-average";

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

interface MrpEntry {
  date: string;
  endDate: string;
  pollster: string;
  client: string;
  sampleSize: number | null;
  seats: {
    snp: number | null;
    con: number | null;
    lab: number | null;
    green: number | null;
    libdem: number | null;
    reform: number | null;
  };
  majority: string;
}

interface PollsData {
  lastUpdated: string;
  constituency: PollEntry[];
  regional: PollEntry[];
  mrp?: MrpEntry[];
}

interface Props {
  data: PollsData;
}

type View = "constituency" | "regional" | "mrp";

const PARTIES = (["snp", "lab", "con", "reform", "green", "libdem", "alba"] as const).map((short) => ({
  key: short as keyof PollEntry,
  short,
  label: PARTY_THEMES_BY_SHORT[short].label,
  color: PARTY_THEMES_BY_SHORT[short].color,
}));

const CHART_W = 800;
const CHART_H = 280;
const PAD_LEFT = 40;
const PAD_RIGHT = 60; // wider right gutter for baseline labels
const PAD_TOP = 10;
const PAD_BOTTOM = 32;

const SMOOTH_WINDOW_DAYS = 30;
const TOTAL_SEATS = 129;
const MAJORITY = 65;

function dateToMs(d: string): number {
  return new Date(d).getTime();
}

function PollsChartInner({ data }: Props) {
  const [view, setView] = useState<View>("constituency");
  const [showBaselines, setShowBaselines] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; poll: PollEntry } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const polls = view === "mrp" ? data.constituency : data[view];
  const baseline = view === "regional" ? BASELINE_2021_REGIONAL : BASELINE_2021_CONSTITUENCY;

  // 5-year window from 2021-05-06 (Holyrood election day) to today.
  const minMs = dateToMs("2021-05-06");
  const maxMs = Date.now();
  const msRange = maxMs - minMs;

  const filtered = useMemo(
    () => polls.filter((p) => dateToMs(p.endDate) >= minMs),
    [polls, minMs],
  );

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;

  function xPos(t: number): number {
    return PAD_LEFT + ((t - minMs) / msRange) * plotW;
  }

  function yPos(pct: number): number {
    return PAD_TOP + plotH - (pct / 50) * plotH;
  }

  // Sample size scaling for dot radius. Wikipedia-style: small but visible.
  const sampleSizes = filtered.map((p) => p.sampleSize ?? 1000).filter((n) => n > 0);
  const minSample = sampleSizes.length > 0 ? Math.min(...sampleSizes) : 500;
  const maxSample = sampleSizes.length > 0 ? Math.max(...sampleSizes) : 5000;
  function dotRadius(sampleSize: number | null): number {
    const n = sampleSize ?? 1000;
    if (maxSample === minSample) return 3;
    const t = (n - minSample) / (maxSample - minSample);
    return 1.6 + t * 2.6; // 1.6 to ~4.2 px
  }

  // Smoothed trend line per party.
  const smoothedByParty = useMemo(() => {
    const result: Record<string, Array<{ date: number; value: number }>> = {};
    for (const { short } of PARTIES) {
      const points = filtered
        .filter((p) => p[short as keyof PollEntry] !== null)
        .map((p) => ({
          date: dateToMs(p.endDate),
          value: p[short as keyof PollEntry] as number,
        }));
      result[short] = centredRollingMean(points, SMOOTH_WINDOW_DAYS * DAY_MS);
    }
    return result;
  }, [filtered]);

  // Y axis gridlines at 0, 10, 20, 30, 40, 50
  const yTicks = [0, 10, 20, 30, 40, 50];

  // X axis ticks: one per year (May 2021, May 2022, …)
  const xTicks: number[] = [];
  for (let year = 2021; year <= new Date().getFullYear(); year++) {
    const t = dateToMs(`${year}-05-01`);
    if (t >= minMs && t <= maxMs) xTicks.push(t);
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || filtered.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = CHART_W / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;

      let nearest: PollEntry | null = null;
      let nearestDist = Infinity;
      for (const p of filtered) {
        const px = xPos(dateToMs(p.endDate));
        const dist = Math.abs(px - mx);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }
      if (nearest && nearestDist < 30) {
        const px = xPos(dateToMs(nearest.endDate));
        const py = nearest.snp !== null ? yPos(nearest.snp) : CHART_H / 2;
        setTooltip({ x: px, y: py, poll: nearest });
      } else {
        setTooltip(null);
      }
    },
    [filtered, msRange],
  );

  const yearLabel = (t: number) => new Date(t).getFullYear().toString();

  return (
    <div>
      {/* Three-way flip toggle */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {(["constituency", "regional", "mrp"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={[
              "px-3 py-1 font-body text-xs font-medium rounded uppercase tracking-wide transition-colors",
              view === t
                ? "bg-votescot-dark text-votescot-paper"
                : "bg-white border border-votescot-border text-gray-500 hover:border-gray-400",
            ].join(" ")}
          >
            {t === "constituency" ? "Constituency vote" : t === "regional" ? "Regional vote" : "Seat projection (MRP)"}
          </button>
        ))}
        {view !== "mrp" && (
          <label className="ml-auto flex items-center gap-1.5 font-body text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showBaselines}
              onChange={(e) => setShowBaselines(e.target.checked)}
              className="cursor-pointer"
            />
            Show 2021 baselines
          </label>
        )}
      </div>

      {view === "mrp" ? (
        <MrpPanel mrp={data.mrp ?? []} />
      ) : (
        <>
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
                  <text x={PAD_LEFT - 4} y={yPos(v) + 4} textAnchor="end" fontSize={12} fill="#9ca3af">
                    {v}%
                  </text>
                </g>
              ))}

              {/* X axis year labels */}
              {xTicks.map((t, i) => (
                <text
                  key={i}
                  x={xPos(t)}
                  y={CHART_H - 6}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#9ca3af"
                >
                  {yearLabel(t)}
                </text>
              ))}

              {/* 2021 baseline reference lines */}
              {showBaselines &&
                PARTIES.map(({ short, color }) => {
                  const v = baseline[short as PartyKey];
                  if (v <= 0) return null;
                  const y = yPos(v);
                  return (
                    <g key={`baseline-${short}`}>
                      <line
                        x1={PAD_LEFT}
                        x2={CHART_W - PAD_RIGHT}
                        y1={y}
                        y2={y}
                        stroke={color}
                        strokeWidth={1}
                        strokeDasharray="2,3"
                        opacity={0.45}
                      />
                      <text
                        x={CHART_W - PAD_RIGHT + 3}
                        y={y + 3}
                        fontSize={10}
                        fill={color}
                        opacity={0.85}
                      >
                        {v.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

              {/* Per-poll dots (one layer per party) */}
              {PARTIES.map(({ short, color }) => {
                const points = filtered.filter((p) => p[short as keyof PollEntry] !== null);
                return (
                  <g key={`dots-${short}`}>
                    {points.map((p, i) => (
                      <circle
                        key={i}
                        cx={xPos(dateToMs(p.endDate))}
                        cy={yPos(p[short as keyof PollEntry] as number)}
                        r={dotRadius(p.sampleSize)}
                        fill={color}
                        opacity={0.4}
                      />
                    ))}
                  </g>
                );
              })}

              {/* Smoothed trend lines */}
              {PARTIES.map(({ short, color }) => {
                const series = smoothedByParty[short];
                if (!series || series.length < 2) return null;
                const d = series
                  .map((p, i) => `${i === 0 ? "M" : "L"}${xPos(p.date).toFixed(1)},${yPos(p.value).toFixed(1)}`)
                  .join(" ");
                return (
                  <path
                    key={`smooth-${short}`}
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={2.4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.95}
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
                className="absolute bg-white border border-votescot-border rounded shadow-md text-xs font-body pointer-events-none z-10 p-2 min-w-[140px]"
                style={{
                  left: `calc(${(tooltip.x / CHART_W) * 100}% + 6px)`,
                  top: `${PAD_TOP + 8}px`,
                  transform: tooltip.x / CHART_W > 0.7 ? "translateX(-110%)" : undefined,
                }}
              >
                <div className="font-bold text-gray-700 mb-1">{tooltip.poll.pollster}</div>
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
                <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: color }} />
                <span className="font-body text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
          <p className="font-body text-xs text-gray-500 mt-2">
            Each dot is one poll, sized by sample. The thicker line is a 30-day centred rolling mean. Dashed lines mark each party's 2021 result.
          </p>
        </>
      )}
    </div>
  );
}

const MRP_PARTY_ORDER: Array<{ short: keyof MrpEntry["seats"]; label: string; color: string }> = [
  "snp", "lab", "con", "libdem", "green", "reform",
].map((short) => ({
  short: short as keyof MrpEntry["seats"],
  label: PARTY_THEMES_BY_SHORT[short].label,
  color: PARTY_THEMES_BY_SHORT[short].color,
}));

function MrpPanel({ mrp }: { mrp: MrpEntry[] }) {
  if (mrp.length === 0) {
    return (
      <div className="bg-white border border-votescot-border rounded-md p-4 font-body text-xs text-gray-500">
        No MRP seat projections published yet.
      </div>
    );
  }

  const sorted = [...mrp].sort((a, b) => dateToMs(b.endDate) - dateToMs(a.endDate)).slice(0, 4);

  return (
    <div className="bg-white border border-votescot-border rounded-md p-3">
      <p className="font-body text-xs text-gray-500 mb-3">
        Most recent MRP seat projections. Vertical line marks 65 seats — the majority threshold in a 129-seat parliament.
      </p>
      <div className="flex flex-col gap-3">
        {sorted.map((row) => (
          <MrpRow key={`${row.pollster}-${row.endDate}`} row={row} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {MRP_PARTY_ORDER.map(({ short, label, color }) => (
          <div key={short} className="flex items-center gap-1.5">
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: color }} />
            <span className="font-body text-xs text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MrpRow({ row }: { row: MrpEntry }) {
  const segments = MRP_PARTY_ORDER.map(({ short, color, label }) => ({
    short,
    color,
    label,
    seats: row.seats[short] ?? 0,
  }));
  const totalKnown = segments.reduce((acc, s) => acc + s.seats, 0);
  const others = Math.max(0, TOTAL_SEATS - totalKnown);
  const majorityPct = (MAJORITY / TOTAL_SEATS) * 100;

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1 font-body text-xs">
        <span className="font-bold text-gray-700">{row.pollster}</span>
        <span className="text-gray-400">
          {row.endDate}
          {row.client && row.client !== "N/A" ? ` · ${row.client}` : ""}
          {row.sampleSize ? ` · n=${row.sampleSize.toLocaleString()}` : ""}
          {row.majority ? ` · ${row.majority === "3" || /^-?\d+$/.test(row.majority) ? `majority ${row.majority}` : row.majority}` : ""}
        </span>
      </div>
      <div className="relative h-6 bg-gray-100 rounded overflow-hidden border border-gray-200">
        {segments.map((seg, i) => {
          const widthPct = (seg.seats / TOTAL_SEATS) * 100;
          const leftPct = (segments.slice(0, i).reduce((a, s) => a + s.seats, 0) / TOTAL_SEATS) * 100;
          if (widthPct <= 0) return null;
          return (
            <div
              key={seg.short}
              className="absolute top-0 bottom-0 flex items-center justify-center text-white font-body text-[10px] font-bold"
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: seg.color }}
              title={`${seg.label}: ${seg.seats} seats`}
            >
              {widthPct >= 6 ? seg.seats : ""}
            </div>
          );
        })}
        {others > 0 && (
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: `${((TOTAL_SEATS - others) / TOTAL_SEATS) * 100}%`,
              width: `${(others / TOTAL_SEATS) * 100}%`,
              background: "#9ca3af",
            }}
            title={`Others: ${others} seats`}
          />
        )}
        {/* Majority marker */}
        <div
          className="absolute top-0 bottom-0 border-l-2 border-black border-dashed"
          style={{ left: `${majorityPct}%` }}
          title="65 seats = majority"
        />
      </div>
    </div>
  );
}

export default function PollsChart(props: Props) {
  return (
    <ErrorBoundary>
      <PollsChartInner {...props} />
    </ErrorBoundary>
  );
}
