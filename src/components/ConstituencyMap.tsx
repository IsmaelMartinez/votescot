import React, { useState, useEffect, useCallback } from "react";
import { slugifyConstituency } from "../lib/slugify";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Layer, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import { feature } from "topojson-client";
import ErrorBoundary from "./ErrorBoundary";
import { PARTY_COLORS_BY_LONG } from "../lib/party-config";

interface ConstituencyProperties {
  id: string;
  name: string;
  slug: string;
}

interface ConstituencyFeature {
  type: "Feature";
  properties: ConstituencyProperties;
  geometry: GeoJSON.Geometry;
}

interface ProjectionInfo {
  id: string;
  projection?: string;
  competitiveness?: "safe" | "competitive" | "marginal" | "toss-up";
  topParties?: { party: string; share: number; status: string }[];
}

interface ResultInfo {
  id: string;
  status: "pending" | "partial" | "declared";
  winner?: string | null;
  topShares?: { party: string; share: number }[];
}

interface RegionInfo {
  id: string;
  name: string;
}

interface RegionResultInfo {
  id: string;
  status: "pending" | "partial" | "declared";
  /** Long-form party keys (snp/labour/conservative/...). */
  seats?: string[];
  source?: string | null;
  manualEntry?: boolean;
}

interface Props {
  knownConstituencies: string[];
  basePath: string;
  projections?: ProjectionInfo[];
  results?: ResultInfo[];
  /** Map of constituency id (== topojson slug) to region id slug. */
  constituencyRegions?: Record<string, string>;
  /** Region id -> human-readable region name. */
  regions?: RegionInfo[];
  /** Per-region d'Hondt list seat allocation, in award order. */
  regionResults?: RegionResultInfo[];
}

type DisplayMode = "coverage" | "forecast" | "results";

// Scotland roughly: lat 54.6–60.9, lon -7.6–-0.7
const SCOTLAND_CENTER: [number, number] = [57.2, -4.0];
const SCOTLAND_ZOOM = 6;

const COLOR_COVERED = "#1a3a2a"; // votescot-dark green - has data
const COLOR_UNCOVERED = "#9ca3af"; // gray-400 - no data yet
const COLOR_HOVER = "#d4a017"; // votescot-gold highlight
const COLOR_HIGHLIGHTED = "#f59e0b"; // amber for postcode result

const PARTY_COLORS = PARTY_COLORS_BY_LONG;

// Compact labels for tight tooltips; long-form labels live in party-config.
const PARTY_LABELS: Record<string, string> = {
  snp: "SNP",
  conservative: "Con",
  labour: "Lab",
  libdem: "Lib Dem",
  green: "Green",
  alba: "Alba",
  reform: "Reform",
};

const COMPETITIVENESS_OPACITY: Record<string, number> = {
  safe: 0.75,
  competitive: 0.55,
  marginal: 0.45,
  "toss-up": 0.35,
};

// Hand-assigned palette for the 8 official Holyrood regions. Adjacent regions
// receive contrasting hues; ColorBrewer Set2-inspired but tuned to avoid clash
// with the reserved party colours above. Colour-blind friendly enough for the
// regional grouping cue (we are not encoding ranked data).
const REGION_COLORS: Record<string, string> = {
  "highlands-and-islands": "#8da0cb", // soft blue-violet (top)
  "north-east-scotland": "#fc8d62", // warm orange
  "mid-scotland-and-fife": "#66c2a5", // teal
  "central-scotland-and-lothians-west": "#e78ac3", // pink
  "edinburgh-and-lothians-east": "#a6d854", // lime
  glasgow: "#ffd92f", // yellow
  "west-scotland": "#e5c494", // tan
  "south-scotland": "#b3b3b3", // neutral grey
};
const REGION_COLOR_FALLBACK = "#9ca3af";

function MapController({
  highlightSlug,
  features,
}: {
  highlightSlug: string | null;
  features: ConstituencyFeature[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!highlightSlug || !features.length) return;
    const feature = features.find((f) => f.properties.slug === highlightSlug);
    if (!feature) return;

    try {
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      }
    } catch {}
  }, [highlightSlug, features, map]);

  return null;
}

function ConstituencyMapInner({
  knownConstituencies,
  basePath,
  projections,
  results,
  constituencyRegions,
  regions,
  regionResults,
}: Props) {
  const [features, setFeatures] = useState<ConstituencyFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postcode, setPostcode] = useState("");
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [postcodeResult, setPostcodeResult] = useState<{
    found: boolean;
    constituencyName?: string;
    slug?: string;
    covered?: boolean;
  } | null>(null);
  const [highlightSlug, setHighlightSlug] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ name: string; slug: string; covered: boolean } | null>(null);
  const hasProjections = projections && projections.length > 0;
  const hasResults = !!results?.some((r) => r.status === "declared");
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    hasResults ? "results" : hasProjections ? "forecast" : "coverage"
  );
  const [viewMode, setViewMode] = useState<"constituency" | "region">("constituency");

  const regionsById = React.useMemo(() => {
    const map = new Map<string, string>();
    if (regions) for (const r of regions) map.set(r.id, r.name);
    return map;
  }, [regions]);

  const hasRegionData = !!constituencyRegions && !!regions?.length;

  const regionResultsById = React.useMemo(() => {
    const map = new Map<string, RegionResultInfo>();
    if (regionResults) for (const r of regionResults) map.set(r.id, r);
    return map;
  }, [regionResults]);

  const hasAnyRegionalSeats = React.useMemo(
    () => (regionResults ?? []).some((r) => (r.seats?.length ?? 0) > 0),
    [regionResults],
  );

  const projectionMap = React.useMemo(() => {
    const map = new Map<string, ProjectionInfo>();
    if (projections) {
      for (const p of projections) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [projections]);

  const resultMap = React.useMemo(() => {
    const map = new Map<string, ResultInfo>();
    if (results) {
      for (const r of results) {
        map.set(r.id, r);
      }
    }
    return map;
  }, [results]);

  useEffect(() => {
    fetch(`${basePath}constituencies.topojson`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load boundaries: ${r.status}`);
        return r.json();
      })
      .then((topo) => {
        const geojson = feature(topo, topo.objects.constituencies) as any;
        setFeatures(geojson.features as ConstituencyFeature[]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [basePath]);

  const styleFeature = useCallback(
    (feature?: { properties?: ConstituencyProperties }): PathOptions => {
      const slug = feature?.properties?.slug ?? "";
      const covered = knownConstituencies.includes(slug);
      const isHighlighted = slug === highlightSlug;

      if (isHighlighted) {
        return {
          fillColor: COLOR_HIGHLIGHTED,
          fillOpacity: 0.7,
          color: "#d97706",
          weight: 2.5,
        };
      }

      if (viewMode === "region" && hasRegionData) {
        const regionId = constituencyRegions?.[slug];
        const fill = (regionId && REGION_COLORS[regionId]) || REGION_COLOR_FALLBACK;
        // Reduce internal stroke weight so adjacent constituencies sharing
        // a region read visually as one block.
        return {
          fillColor: fill,
          fillOpacity: 0.65,
          color: "#4b5563",
          weight: 0.5,
        };
      }

      if (displayMode === "results" && hasResults) {
        const res = resultMap.get(slug);
        if (res?.status === "declared" && res.winner) {
          const partyColor = PARTY_COLORS[res.winner] ?? COLOR_UNCOVERED;
          return {
            fillColor: partyColor,
            fillOpacity: 0.75,
            color: "#333",
            weight: 0.8,
          };
        }
        return {
          fillColor: COLOR_UNCOVERED,
          fillOpacity: 0.2,
          color: "#6b7280",
          weight: 0.8,
        };
      }

      if (displayMode === "forecast" && hasProjections) {
        const proj = projectionMap.get(slug);
        if (proj?.projection) {
          const partyColor = PARTY_COLORS[proj.projection] ?? COLOR_UNCOVERED;
          const opacity = COMPETITIVENESS_OPACITY[proj.competitiveness ?? "competitive"] ?? 0.55;
          return {
            fillColor: partyColor,
            fillOpacity: opacity,
            color: "#333",
            weight: 0.8,
          };
        }
        return {
          fillColor: COLOR_UNCOVERED,
          fillOpacity: 0.25,
          color: "#6b7280",
          weight: 0.8,
        };
      }

      return {
        fillColor: covered ? COLOR_COVERED : COLOR_UNCOVERED,
        fillOpacity: covered ? 0.55 : 0.3,
        color: covered ? "#0f2418" : "#6b7280",
        weight: 1,
      };
    },
    [
      knownConstituencies,
      highlightSlug,
      displayMode,
      hasProjections,
      hasResults,
      projectionMap,
      resultMap,
      viewMode,
      hasRegionData,
      constituencyRegions,
    ]
  );

  const onEachFeature = useCallback(
    (feature: ConstituencyFeature, layer: Layer) => {
      const { name, slug } = feature.properties;
      const covered = knownConstituencies.includes(slug);

      let tooltipHtml: string;
      if (viewMode === "region" && hasRegionData) {
        const regionId = constituencyRegions?.[slug];
        const regionName = (regionId && regionsById.get(regionId)) || "Unknown region";
        tooltipHtml = `<strong>${regionName}</strong><br/><span style="font-size:12px;color:#16a34a">Click to see regional list candidates</span>`;
      } else if (displayMode === "results" && hasResults) {
        const res = resultMap.get(slug);
        if (res?.status === "declared" && res.winner) {
          const partyLabel = PARTY_LABELS[res.winner] ?? res.winner;
          const proj = projectionMap.get(slug);
          const verdict = proj?.projection
            ? proj.projection === res.winner
              ? `<span style="color:#16a34a"> ✓ forecast hit</span>`
              : `<span style="color:#dc2626"> ✗ forecast missed (${PARTY_LABELS[proj.projection] ?? proj.projection})</span>`
            : "";
          const topSharesHtml = res.topShares
            ? res.topShares
                .slice(0, 3)
                .map(
                  (tp) =>
                    `<span style="color:${PARTY_COLORS[tp.party] ?? "#666"}">${PARTY_LABELS[tp.party] ?? tp.party} ${tp.share.toFixed(1)}%</span>`
                )
                .join(" · ")
            : "";
          tooltipHtml = `<strong>${name}</strong><br/><span style="font-size:12px">${partyLabel} wins${verdict}</span>`;
          if (topSharesHtml) {
            tooltipHtml += `<br/><span style="font-size:11px">${topSharesHtml}</span>`;
          }
        } else {
          tooltipHtml = `<strong>${name}</strong><br/><span style="font-size:12px;color:#9ca3af">Result pending</span>`;
        }
      } else if (displayMode === "forecast" && hasProjections) {
        const proj = projectionMap.get(slug);
        if (proj?.projection) {
          const partyLabel = PARTY_LABELS[proj.projection] ?? proj.projection;
          const compLabel = proj.competitiveness
            ? ` (${proj.competitiveness})`
            : "";
          const topPartiesHtml = proj.topParties
            ? proj.topParties
                .slice(0, 3)
                .map(
                  (tp) =>
                    `<span style="color:${PARTY_COLORS[tp.party] ?? "#666"}">${PARTY_LABELS[tp.party] ?? tp.party} ${tp.share}%</span>`
                )
                .join(" · ")
            : "";
          tooltipHtml = `<strong>${name}</strong><br/><span style="font-size:12px">${partyLabel} projected${compLabel}</span>`;
          if (topPartiesHtml) {
            tooltipHtml += `<br/><span style="font-size:11px">${topPartiesHtml}</span>`;
          }
        } else {
          tooltipHtml = `<strong>${name}</strong><br/><span style="font-size:12px;color:#9ca3af">No projection</span>`;
        }
      } else {
        tooltipHtml = covered
          ? `<strong>${name}</strong><br/><span style="font-size:12px;color:#16a34a">Click to see candidates</span>`
          : `<strong>${name}</strong><br/><span style="font-size:12px;color:#9ca3af">Coming soon</span>`;
      }

      (layer as any).bindTooltip(tooltipHtml, {
        sticky: true,
        className: "constituency-tooltip",
      });

      layer.on({
        mouseover(e: any) {
          e.target.setStyle({
            fillColor: COLOR_HOVER,
            fillOpacity: 0.7,
            weight: 2,
          });
          e.target.bringToFront();
        },
        mouseout(e: any) {
          e.target.setStyle(styleFeature(feature));
        },
        click() {
          if (viewMode === "region" && hasRegionData) {
            const regionId = constituencyRegions?.[slug];
            if (regionId) {
              window.location.href = `${basePath}candidates/region/${regionId}`;
            }
            return;
          }
          if (covered) {
            window.location.href = `${basePath}candidates/constituency/${slug}`;
          } else {
            setTooltip({ name, slug, covered });
            setTimeout(() => setTooltip(null), 3000);
          }
        },
      });
    },
    [
      knownConstituencies,
      basePath,
      highlightSlug,
      styleFeature,
      displayMode,
      hasProjections,
      hasResults,
      projectionMap,
      resultMap,
      viewMode,
      hasRegionData,
      constituencyRegions,
      regionsById,
    ]
  );

  async function lookupPostcode() {
    const clean = postcode.replace(/\s/g, "").toUpperCase();
    if (clean.length < 5) return;

    setPostcodeLoading(true);
    setPostcodeResult(null);

    try {
      const response = await fetch(
        `https://mapit.mysociety.org/postcode/${encodeURIComponent(clean)}`
      );
      if (!response.ok) throw new Error("Postcode not found");

      const data = await response.json();

      let constituency: { name: string } | null = null;
      for (const area of Object.values(data.areas) as any[]) {
        if (area.type === "SPCF") {
          constituency = { name: area.name };
          break;
        }
      }

      if (!constituency) {
        setPostcodeResult({ found: false });
        return;
      }

      const name = constituency.name;
      const slug = slugifyConstituency(name);
      const covered = knownConstituencies.includes(slug);

      setPostcodeResult({ found: true, constituencyName: name, slug, covered });
      setHighlightSlug(slug);
    } catch {
      setPostcodeResult({ found: false });
    } finally {
      setPostcodeLoading(false);
    }
  }

  // Derive unique parties from projections for the legend
  const legendParties = React.useMemo(() => {
    if (!projections) return [];
    const seen = new Set<string>();
    for (const p of projections) {
      if (p.projection) seen.add(p.projection);
    }
    return Array.from(seen).sort();
  }, [projections]);

  // Derive winning parties present in declared results for the legend
  const resultLegendParties = React.useMemo(() => {
    if (!results) return [];
    const seen = new Set<string>();
    for (const r of results) {
      if (r.status === "declared" && r.winner) seen.add(r.winner);
    }
    return Array.from(seen).sort();
  }, [results]);

  // Force GeoJSON re-render when display mode, view mode, or highlight changes
  const geoJsonKey = `${viewMode}-${displayMode}-${highlightSlug ?? "none"}`;

  return (
    <div className="flex flex-col gap-3">
      {/* Postcode search */}
      <div className="bg-white rounded-lg p-4 border border-votescot-border">
        <label className="block font-heading font-bold text-base mb-2">
          Find your constituency by postcode
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={postcode}
            onChange={(e) => {
              setPostcode(e.target.value);
              setPostcodeResult(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && lookupPostcode()}
            placeholder="e.g. EH1 1BB"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-body text-sm focus:outline-none focus:border-votescot-gold"
          />
          <button
            onClick={lookupPostcode}
            disabled={postcodeLoading}
            className="px-4 py-2 bg-votescot-dark text-white rounded-md font-body text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {postcodeLoading ? "..." : "Find"}
          </button>
        </div>

        {postcodeResult?.found && (
          <div
            className={`mt-3 p-3 rounded-md font-body text-sm ${
              postcodeResult.covered
                ? "bg-green-50 border border-green-200"
                : "bg-amber-50 border border-amber-200"
            }`}
          >
            You're in <strong>{postcodeResult.constituencyName}</strong>.{" "}
            {postcodeResult.covered ? (
              <>
                <a
                  href={`${basePath}candidates/constituency/${postcodeResult.slug}`}
                  className="text-blue-600 underline font-semibold"
                >
                  See your candidates →
                </a>
              </>
            ) : (
              "We don't have candidate data for this constituency yet. Check WhoCanIVoteFor.co.uk."
            )}
          </div>
        )}
        {postcodeResult && !postcodeResult.found && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md font-body text-sm">
            Couldn't find that postcode. Check the format (e.g. EH1 1BB) and try again.
          </div>
        )}
      </div>

      {/* View toggle + Projection toggle + Legend */}
      <div className="flex flex-wrap items-center gap-4 font-body text-xs text-gray-600">
        {hasRegionData && (
          <div
            role="group"
            aria-label="Map view"
            className="inline-flex rounded-full border border-gray-300 overflow-hidden text-xs font-bold"
          >
            <button
              onClick={() => setViewMode("constituency")}
              aria-pressed={viewMode === "constituency"}
              className={`px-3 py-1.5 transition-colors ${
                viewMode === "constituency"
                  ? "bg-votescot-dark text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Constituency
            </button>
            <button
              onClick={() => setViewMode("region")}
              aria-pressed={viewMode === "region"}
              className={`px-3 py-1.5 border-l border-gray-300 transition-colors ${
                viewMode === "region"
                  ? "bg-votescot-dark text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Region
            </button>
          </div>
        )}

        {viewMode === "constituency" && (hasProjections || hasResults) && (
          <div
            role="group"
            aria-label="Map overlay"
            className="inline-flex rounded-full border border-gray-300 overflow-hidden text-xs font-bold"
          >
            <button
              onClick={() => setDisplayMode("coverage")}
              aria-pressed={displayMode === "coverage"}
              className={`px-3 py-1.5 transition-colors ${
                displayMode === "coverage"
                  ? "bg-votescot-dark text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Coverage
            </button>
            {hasProjections && (
              <button
                onClick={() => setDisplayMode("forecast")}
                aria-pressed={displayMode === "forecast"}
                className={`px-3 py-1.5 border-l border-gray-300 transition-colors ${
                  displayMode === "forecast"
                    ? "bg-votescot-dark text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Forecast
              </button>
            )}
            {hasResults && (
              <button
                onClick={() => setDisplayMode("results")}
                aria-pressed={displayMode === "results"}
                className={`px-3 py-1.5 border-l border-gray-300 transition-colors ${
                  displayMode === "results"
                    ? "bg-votescot-gold text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Results
              </button>
            )}
          </div>
        )}

        {viewMode === "region" && hasRegionData && !hasAnyRegionalSeats ? (
          <>
            {regions!.map((r) => (
              <span key={r.id} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm inline-block"
                  style={{ background: REGION_COLORS[r.id] ?? REGION_COLOR_FALLBACK, opacity: 0.8 }}
                />
                {r.name}
              </span>
            ))}
          </>
        ) : viewMode === "region" && hasRegionData && hasAnyRegionalSeats ? (
          <span className="text-gray-400">List seats below — click a region tile for candidates.</span>
        ) : displayMode === "results" && hasResults ? (
          <>
            {resultLegendParties.map((party) => (
              <span key={party} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm inline-block"
                  style={{ background: PARTY_COLORS[party] ?? "#666", opacity: 0.8 }}
                />
                {PARTY_LABELS[party] ?? party}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_UNCOVERED, opacity: 0.5 }} />
              Pending
            </span>
          </>
        ) : displayMode === "forecast" && hasProjections ? (
          <>
            {legendParties.map((party) => (
              <span key={party} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm inline-block"
                  style={{ background: PARTY_COLORS[party] ?? "#666", opacity: 0.8 }}
                />
                {PARTY_LABELS[party] ?? party}
              </span>
            ))}
            <span className="text-gray-400 ml-1">Opacity = competitiveness</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_COVERED, opacity: 0.8 }} />
              Has candidate data
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_UNCOVERED, opacity: 0.6 }} />
              Coming soon
            </span>
          </>
        )}
        {highlightSlug && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_HIGHLIGHTED, opacity: 0.9 }} />
            Your constituency
          </span>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-lg overflow-hidden border border-votescot-border" style={{ height: "520px" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="font-body text-sm text-gray-500">Loading constituency boundaries…</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
            <div className="font-body text-sm text-red-600">{error}</div>
          </div>
        )}

        {/* Floating tooltip for uncovered constituency click */}
        {tooltip && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white border border-gray-300 rounded-md px-3 py-2 font-body text-sm shadow-md max-w-xs text-center">
            <strong>{tooltip.name}</strong>: candidate data coming soon.{" "}
            <a
              href="https://whocanivotefor.co.uk/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              WhoCanIVoteFor
            </a>
          </div>
        )}

        <MapContainer
          center={SCOTLAND_CENTER}
          zoom={SCOTLAND_ZOOM}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {!loading && features.length > 0 && (
            <>
              <GeoJSON
                key={geoJsonKey}
                data={{ type: "FeatureCollection", features } as any}
                style={styleFeature as any}
                onEachFeature={onEachFeature as any}
              />
              <MapController highlightSlug={highlightSlug} features={features} />
            </>
          )}
        </MapContainer>
      </div>

      {viewMode === "region" && hasAnyRegionalSeats && regions && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {regions.map((r) => {
            const rr = regionResultsById.get(r.id);
            const seats = rr?.seats ?? [];
            const cells = Array.from({ length: 7 }, (_, i) => seats[i] ?? null);
            const counts = seats.reduce<Record<string, number>>((acc, p) => {
              acc[p] = (acc[p] ?? 0) + 1;
              return acc;
            }, {});
            const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            return (
              <div key={r.id} className="bg-white border border-votescot-border rounded-md p-2.5">
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="font-body text-sm font-bold text-votescot-dark">{r.name}</div>
                  <div className="font-body text-[10px] uppercase tracking-wider text-gray-400">
                    {rr?.manualEntry ? "manual" : rr?.source === "Democracy Club" ? "DC" : rr?.status === "pending" || !seats.length ? "pending" : ""}
                  </div>
                </div>
                <div className="flex gap-0.5 mb-1.5">
                  {cells.map((party, i) => (
                    <div
                      key={i}
                      className="flex-1 h-3 rounded-sm"
                      style={{
                        background: party ? PARTY_COLORS[party] ?? "#94a3b8" : "#e5e7eb",
                        opacity: party ? 0.9 : 0.6,
                      }}
                      title={party ? PARTY_LABELS[party] ?? party : "Pending"}
                    />
                  ))}
                </div>
                <div className="font-body text-[11px] text-gray-500 leading-snug">
                  {seats.length === 0
                    ? "Awaiting declaration"
                    : sortedCounts
                        .map(([p, n]) => `${PARTY_LABELS[p] ?? p} ${n}`)
                        .join(" · ")}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="font-body text-xs text-gray-400 mt-3">
        Boundaries: 2026 Scottish Parliament constituencies (SPCF) via{" "}
        <a
          href="https://mapit.mysociety.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          MapIt/mySociety
        </a>
        . Postcode lookup uses the MapIt API.
        {viewMode === "region"
          ? " Click any area to view that region's list candidates."
          : " Click a constituency to view candidates."}
        {viewMode === "constituency" && displayMode === "forecast" && (
          <> Projections are estimates based on notional results, not predictions.</>
        )}
        {viewMode === "constituency" && displayMode === "results" && (
          <> Results from Democracy Club. Pending seats are greyed out.</>
        )}
      </div>
    </div>
  );
}

export default function ConstituencyMap(props: Props) {
  return <ErrorBoundary><ConstituencyMapInner {...props} /></ErrorBoundary>;
}
