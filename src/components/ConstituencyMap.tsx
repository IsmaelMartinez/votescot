import React, { useState, useEffect, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Layer, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";

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

interface Props {
  knownConstituencies: string[];
  basePath: string;
}

// Scotland roughly: lat 54.6–60.9, lon -7.6–-0.7
const SCOTLAND_CENTER: [number, number] = [57.2, -4.0];
const SCOTLAND_ZOOM = 6;

const COLOR_COVERED = "#1a3a2a"; // votescot-dark green - has data
const COLOR_UNCOVERED = "#9ca3af"; // gray-400 - no data yet
const COLOR_HOVER = "#d4a017"; // votescot-gold highlight
const COLOR_HIGHLIGHTED = "#f59e0b"; // amber for postcode result

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

    // Compute bounding box of the feature geometry
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

export default function ConstituencyMap({ knownConstituencies, basePath }: Props) {
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

  // Load the GeoJSON at mount
  useEffect(() => {
    fetch(`${basePath}constituencies.geojson`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load boundaries: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setFeatures(data.features as ConstituencyFeature[]);
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
      return {
        fillColor: isHighlighted ? COLOR_HIGHLIGHTED : covered ? COLOR_COVERED : COLOR_UNCOVERED,
        fillOpacity: isHighlighted ? 0.7 : covered ? 0.55 : 0.3,
        color: isHighlighted ? "#d97706" : covered ? "#0f2418" : "#6b7280",
        weight: isHighlighted ? 2.5 : 1,
      };
    },
    [knownConstituencies, highlightSlug]
  );

  const onEachFeature = useCallback(
    (feature: ConstituencyFeature, layer: Layer) => {
      const { name, slug } = feature.properties;
      const covered = knownConstituencies.includes(slug);

      // Bind a sticky tooltip with the constituency name
      (layer as any).bindTooltip(
        covered
          ? `<strong>${name}</strong><br/><span style="font-size:11px;color:#16a34a">Click to see candidates</span>`
          : `<strong>${name}</strong><br/><span style="font-size:11px;color:#9ca3af">Coming soon</span>`,
        { sticky: true, className: "constituency-tooltip" }
      );

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
          if (covered) {
            window.location.href = `${basePath}candidates/constituency/${slug}`;
          } else {
            setTooltip({ name, slug, covered });
            setTimeout(() => setTooltip(null), 3000);
          }
        },
      });
    },
    [knownConstituencies, basePath, highlightSlug, styleFeature]
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
      const slug = name
        .toLowerCase()
        .replace(/, /g, "-")
        .replace(/,/g, "")
        .replace(/\s+/g, "-")
        .replace(/'/g, "");
      const covered = knownConstituencies.includes(slug);

      setPostcodeResult({ found: true, constituencyName: name, slug, covered });
      setHighlightSlug(slug);
    } catch {
      setPostcodeResult({ found: false });
    } finally {
      setPostcodeLoading(false);
    }
  }

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
              "We don't have candidate data for this constituency yet — check WhoCanIVoteFor.co.uk."
            )}
          </div>
        )}
        {postcodeResult && !postcodeResult.found && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md font-body text-sm">
            Couldn't find that postcode. Check the format (e.g. EH1 1BB) and try again.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 font-body text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_COVERED, opacity: 0.8 }} />
          Has candidate data
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_UNCOVERED, opacity: 0.6 }} />
          Coming soon
        </span>
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
            <strong>{tooltip.name}</strong> — candidate data coming soon.{" "}
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
                key={highlightSlug ?? "none"}
                data={{ type: "FeatureCollection", features } as any}
                style={styleFeature as any}
                onEachFeature={onEachFeature as any}
              />
              <MapController highlightSlug={highlightSlug} features={features} />
            </>
          )}
        </MapContainer>
      </div>

      <div className="font-body text-[10px] text-gray-400">
        Boundaries: 2026 Scottish Parliament constituencies (SPCF) via{" "}
        <a
          href="https://mapit.mysociety.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          MapIt/mySociety
        </a>
        . Postcode lookup uses the MapIt API. Click a constituency to view candidates.
      </div>
    </div>
  );
}
