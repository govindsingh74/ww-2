import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Country, Province, Army } from '../lib/types';

interface WorldMapProps {
  countries: Country[];
  provinces: Province[];
  armies: Army[];
  onSelectProvince: (province: Province) => void;
  selectedProvince: Province | null;
}

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 700;

function latLngToXY(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * MAP_WIDTH;
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return [x, y];
}

const NAME_MAP: Record<string, string> = {
  'USA': 'United States of America',
  'Germany': 'Germany',
  'UK': 'United Kingdom',
  'France': 'France',
  'USSR': 'Russia',
  'Japan': 'Japan',
  'Italy': 'Italy',
  'China': 'China',
  'India': 'India',
  'Canada': 'Canada',
  'Australia': 'Australia',
  'Brazil': 'Brazil',
  'Spain': 'Spain',
  'Turkey': 'Turkey',
  'Poland': 'Poland',
  'Netherlands': 'Netherlands',
  'Belgium': 'Belgium',
  'Sweden': 'Sweden',
  'Norway': 'Norway',
  'Finland': 'Finland',
  'Mexico': 'Mexico',
  'South Africa': 'South Africa',
  'Iran': 'Iran',
  'Iraq': 'Iraq',
  'Afghanistan': 'Afghanistan',
  'Thailand': 'Thailand',
  'Vietnam': 'Vietnam',
  'Argentina': 'Argentina',
  'Chile': 'Chile',
  'Peru': 'Peru',
  'Colombia': 'Colombia',
  'Saudi Arabia': 'Saudi Arabia',
  'Egypt': 'Egypt',
  'Libya': 'Libya',
  'Algeria': 'Algeria',
  'Morocco': 'Morocco',
  'Ukraine': 'Ukraine',
  'Kazakhstan': 'Kazakhstan',
  'Mongolia': 'Mongolia',
  'Philippines': 'Philippines',
};

function getProvinceRadius(type: Province['type']): number {
  if (type === 'capital') return 6;
  if (type === 'core') return 3.5;
  return 2.5;
}

function getLabelFontSize(type: Province['type'], zoom: number): number {
  const base = type === 'capital' ? 5 : type === 'core' ? 4 : 3.5;
  return base * Math.min(zoom, 2);
}

// Compute signed area of a polygon ring (lng/lat coords)
function ringArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return area / 2;
}

// Centroid of a polygon (first ring) in lng/lat
function polygonCentroid(coordinates: number[][][]): [number, number] | null {
  const ring = coordinates[0];
  if (!ring || ring.length < 3) return null;
  const area = ringArea(ring);
  if (Math.abs(area) < 1e-9) {
    const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    cx += (ring[i][0] + ring[i + 1][0]) * cross;
    cy += (ring[i][1] + ring[i + 1][1]) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

// Get centroid of largest polygon in a feature
function featureCentroid(f: GeoJSON.Feature): [number, number] | null {
  const geom = f.geometry;
  if (!geom) return null;
  if (geom.type === 'Polygon') {
    return polygonCentroid(geom.coordinates as number[][][]);
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates as number[][][][];
    let maxArea = 0;
    let best: number[][][] = polys[0];
    for (const poly of polys) {
      const a = Math.abs(ringArea(poly[0] ?? []));
      if (a > maxArea) { maxArea = a; best = poly; }
    }
    return polygonCentroid(best);
  }
  return null;
}

export function WorldMap({ countries, provinces, armies, onSelectProvince, selectedProvince }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState(`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vbX: 0, vbY: 0 });
  const [zoom, setZoom] = useState(1);
  const [vbX, setVbX] = useState(0);
  const [vbY, setVbY] = useState(0);
  const [tooltip, setTooltip] = useState<{ province: Province; x: number; y: number } | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const countryById = useMemo(
    () => Object.fromEntries(countries.map((c) => [c.id, c])),
    [countries]
  );

  const countryByName = useMemo(() => {
    const map: Record<string, Country> = {};
    for (const c of countries) {
      map[c.name] = c;
      const neName = NAME_MAP[c.name];
      if (neName) map[neName] = c;
    }
    return map;
  }, [countries]);

  // Armies grouped by province
  const armiesByProvince = useMemo(() => {
    const map: Record<string, Army[]> = {};
    for (const army of armies) {
      const pid = army.current_province_id;
      if (!pid) continue;
      if (!map[pid]) map[pid] = [];
      map[pid].push(army);
    }
    return map;
  }, [armies]);

  const geoFeatures = useMemo(() => {
    const topo = worldData as unknown as Topology;
    const geo = feature(topo, topo.objects.countries as GeometryCollection);
    return geo.features;
  }, []);

  const featureCountryMap = useMemo(() => {
    const map = new Map<number, Country | null>();
    for (const f of geoFeatures) {
      const props = f.properties as { name?: string } | undefined;
      const neName = props?.name ?? '';
      const country = countryByName[neName] ?? null;
      map.set(f.id as number, country);
    }
    return map;
  }, [geoFeatures, countryByName]);

  // Precompute centroids for country name labels
  const featureCentroids = useMemo(() => {
    const map = new Map<number, [number, number]>();
    for (const f of geoFeatures) {
      const c = featureCentroid(f);
      if (c) map.set(f.id as number, c);
    }
    return map;
  }, [geoFeatures]);

  const vbW = MAP_WIDTH / zoom;
  const vbH = MAP_HEIGHT / zoom;

  useEffect(() => {
    setViewBox(`${vbX} ${vbY} ${vbW} ${vbH}`);
  }, [vbX, vbY, vbW, vbH]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const target = e.target as SVGElement;
    if (target.closest('svg')) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.min(8, Math.max(1, z * delta)));
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY, vbX, vbY });
  }, [vbX, vbY]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = (e.clientX - panStart.x) / zoom;
    const dy = (e.clientY - panStart.y) / zoom;
    setVbX(Math.max(0, Math.min(MAP_WIDTH - vbW, panStart.vbX - dx)));
    setVbY(Math.max(0, Math.min(MAP_HEIGHT - vbH, panStart.vbY - dy)));
  }, [isPanning, panStart, zoom, vbW, vbH]);

  const onMouseUp = useCallback(() => setIsPanning(false), []);

  function polygonToPath(coordinates: number[][][]): string {
    return coordinates.map((ring) => {
      const points = ring.map(([lng, lat]) => {
        const [x, y] = latLngToXY(lat, lng);
        return `${x},${y}`;
      });
      return `M${points.join('L')}Z`;
    }).join('');
  }

  function featureToPath(f: GeoJSON.Feature): string {
    const geom = f.geometry;
    if (!geom) return '';
    if (geom.type === 'Polygon') return polygonToPath(geom.coordinates as number[][][]);
    if (geom.type === 'MultiPolygon') {
      return (geom.coordinates as number[][][][]).map((poly) => polygonToPath(poly)).join('');
    }
    return '';
  }

  return (
    <div className="relative w-full h-full bg-gray-950 overflow-hidden rounded-lg border border-gray-800">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#0a1628] to-slate-900" />

      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="relative w-full h-full cursor-grab active:cursor-grabbing select-none"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="armyGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        <g opacity={0.05} stroke="#64748b" strokeWidth={0.5}>
          {[-60, -30, 0, 30, 60].map((lat) => {
            const [, y] = latLngToXY(lat, 0);
            return <line key={lat} x1={0} y1={y} x2={MAP_WIDTH} y2={y} />;
          })}
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lng) => {
            const [x] = latLngToXY(0, lng);
            return <line key={lng} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} />;
          })}
        </g>

        {/* ── Country fill layer ── */}
        <g>
          {geoFeatures.map((f) => {
            const country = featureCountryMap.get(f.id as number);
            const isGameCountry = !!country;
            const isHovered = hoveredCountry === country?.id;
            const path = featureToPath(f);
            if (!path) return null;

            const fillColor = isGameCountry ? country.flag_color : '#1a2535';
            const fillOpacity = isGameCountry ? (isHovered ? 0.48 : 0.28) : 0.18;

            return (
              <path
                key={`fill-${f.id as number}`}
                d={path}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke="none"
                onMouseEnter={() => isGameCountry && setHoveredCountry(country.id)}
                onMouseLeave={() => setHoveredCountry(null)}
                className={isGameCountry ? 'cursor-pointer' : ''}
                style={{ transition: 'fill-opacity 0.2s' }}
              />
            );
          })}
        </g>

        {/* ── Country boundary lines ── */}
        {/* Non-game countries: dotted gray */}
        <g>
          {geoFeatures.map((f) => {
            const country = featureCountryMap.get(f.id as number);
            if (country) return null;
            const path = featureToPath(f);
            if (!path) return null;
            return (
              <path
                key={`border-other-${f.id as number}`}
                d={path}
                fill="none"
                stroke="rgba(100,116,139,0.3)"
                strokeWidth={0.35}
                strokeDasharray="2,3"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            );
          })}
        </g>
        {/* Game countries: solid white line */}
        <g>
          {geoFeatures.map((f) => {
            const country = featureCountryMap.get(f.id as number);
            if (!country) return null;
            const isHovered = hoveredCountry === country.id;
            const path = featureToPath(f);
            if (!path) return null;
            return (
              <path
                key={`border-game-${f.id as number}`}
                d={path}
                fill="none"
                stroke={isHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)'}
                strokeWidth={isHovered ? 1.5 : 0.8}
                strokeLinejoin="round"
                style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
                pointerEvents="none"
              />
            );
          })}
        </g>

        {/* ── Country name labels at polygon centroid ── */}
        <g>
          {geoFeatures.map((f) => {
            const country = featureCountryMap.get(f.id as number);
            if (!country) return null;
            const centroid = featureCentroids.get(f.id as number);
            if (!centroid) return null;
            const [lng, lat] = centroid;
            const [x, y] = latLngToXY(lat, lng);
            const isPlayable = country.type === 'playable';
            const fontSize = zoom > 3 ? 8 : zoom > 2 ? 6 : zoom > 1.5 ? 5 : 4;

            return (
              <text
                key={`name-${f.id as number}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isPlayable ? 'rgba(255,255,255,0.92)' : 'rgba(148,163,184,0.6)'}
                fontSize={fontSize}
                fontWeight={isPlayable ? '700' : '500'}
                fontFamily="system-ui, sans-serif"
                stroke="rgba(0,0,0,0.75)"
                strokeWidth={isPlayable ? 3 : 2.5}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', letterSpacing: '0.04em' }}
              >
                {country.name}
              </text>
            );
          })}
        </g>

        {/* ── Province connection lines (dotted, from capital) ── */}
        <g>
          {countries.map((country) => {
            const cProvinces = provinces.filter((p) => p.country_id === country.id);
            const cap = cProvinces.find((p) => p.type === 'capital');
            if (!cap) return null;
            const [cx, cy] = latLngToXY(cap.lat, cap.lng);
            return (
              <g key={`lines-${country.id}`}>
                {cProvinces
                  .filter((p) => p.id !== cap.id)
                  .map((p) => {
                    const [px, py] = latLngToXY(p.lat, p.lng);
                    return (
                      <line
                        key={p.id}
                        x1={cx} y1={cy}
                        x2={px} y2={py}
                        stroke={country.flag_color}
                        strokeWidth={0.4}
                        opacity={0.18}
                        strokeDasharray="1.5,3"
                      />
                    );
                  })}
              </g>
            );
          })}
        </g>

        {/* ── Province markers ── */}
        <g>
          {provinces.map((province) => {
            const [x, y] = latLngToXY(province.lat, province.lng);
            const country = countryById[province.country_id];
            const isSelected = selectedProvince?.id === province.id;
            const r = getProvinceRadius(province.type);
            const color = isSelected ? '#f59e0b' : (country?.flag_color ?? '#4b5563');
            const labelSize = getLabelFontSize(province.type, zoom);
            const isCapital = province.type === 'capital';

            return (
              <g
                key={province.id}
                onClick={() => onSelectProvince(province)}
                onMouseEnter={(e) => setTooltip({ province, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
                className="cursor-pointer"
              >
                {/* Selection pulse */}
                {isSelected && (
                  <circle cx={x} cy={y} r={r + 5} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.6} filter="url(#glow)">
                    <animate attributeName="r" values={`${r + 4};${r + 8};${r + 4}`} dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {isCapital ? (
                  <>
                    <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={isSelected ? 2 : 1.5} />
                    <circle cx={x} cy={y} r={r * 0.48} fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth={0.5} />
                    <line x1={x - r - 2} y1={y} x2={x - r + 1} y2={y} stroke={color} strokeWidth={1} opacity={0.8} />
                    <line x1={x + r - 1} y1={y} x2={x + r + 2} y2={y} stroke={color} strokeWidth={1} opacity={0.8} />
                    <line x1={x} y1={y - r - 2} x2={x} y2={y - r + 1} stroke={color} strokeWidth={1} opacity={0.8} />
                    <line x1={x} y1={y + r - 1} x2={x} y2={y + r + 2} stroke={color} strokeWidth={1} opacity={0.8} />
                  </>
                ) : (
                  <>
                    <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={isSelected ? 1.5 : 0.8} opacity={0.7} />
                    <circle cx={x} cy={y} r={isSelected ? 2 : 1.5} fill={color} />
                  </>
                )}

                {/* Province name */}
                <text
                  x={x}
                  y={y + r + labelSize + 1}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fill={isSelected ? '#f59e0b' : (isCapital ? 'white' : 'rgba(255,255,255,0.75)')}
                  fontSize={labelSize}
                  fontWeight={isCapital ? '700' : '500'}
                  fontFamily="system-ui, sans-serif"
                  stroke="rgba(0,0,0,0.65)"
                  strokeWidth={isCapital ? 3 : 2}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none' }}
                >
                  {province.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Army markers ── */}
        <g>
          {provinces.map((province) => {
            const provinceArmies = armiesByProvince[province.id];
            if (!provinceArmies || provinceArmies.length === 0) return null;

            const totalUnits = provinceArmies.reduce((s, a) => s + a.unit_count, 0);
            const [x, y] = latLngToXY(province.lat, province.lng);
            const pr = getProvinceRadius(province.type);

            // Army badge offset above province dot
            const ax = x + 7;
            const ay = y - pr - 6;

            const dominantStatus = provinceArmies.find((a) => a.status === 'attacking')?.status
              ?? provinceArmies.find((a) => a.status === 'moving')?.status
              ?? 'idle';

            const armyColor = dominantStatus === 'attacking'
              ? '#ef4444'
              : dominantStatus === 'moving'
              ? '#f59e0b'
              : '#22c55e';

            return (
              <g key={`army-${province.id}`} style={{ pointerEvents: 'none' }}>
                {/* Pulse glow for attacking */}
                {dominantStatus === 'attacking' && (
                  <circle cx={ax} cy={ay} r={7} fill="none" stroke="#ef4444" strokeWidth={1} opacity={0}>
                    <animate attributeName="r" values="5;10;5" dur="0.9s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0;0.7" dur="0.9s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Glow bg */}
                <circle cx={ax} cy={ay} r={5.5} fill={armyColor} fillOpacity={0.15} filter="url(#armyGlow)" />
                {/* Badge */}
                <circle cx={ax} cy={ay} r={5} fill="#0d1b2a" stroke={armyColor} strokeWidth={1.3} />
                {/* Cross/sword icon */}
                <line x1={ax - 2.8} y1={ay} x2={ax + 2.8} y2={ay} stroke={armyColor} strokeWidth={1.1} />
                <line x1={ax} y1={ay - 2.8} x2={ax} y2={ay + 2.8} stroke={armyColor} strokeWidth={1.1} />
                {/* Guard crossbar */}
                <line x1={ax - 1.8} y1={ay - 1} x2={ax + 1.8} y2={ay - 1} stroke={armyColor} strokeWidth={0.8} opacity={0.75} />
                {/* Unit count */}
                <text
                  x={ax}
                  y={ay + 8}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fill={armyColor}
                  fontSize={zoom > 2 ? 4 : 3.5}
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                  stroke="rgba(0,0,0,0.85)"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                >
                  {totalUnits >= 1000 ? `${(totalUnits / 1000).toFixed(1)}k` : String(totalUnits)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <ProvinceTooltip
          province={tooltip.province}
          country={countryById[tooltip.province.country_id]}
          armies={armiesByProvince[tooltip.province.id] ?? []}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(8, z * 1.3))}
          className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 text-white rounded text-lg flex items-center justify-center transition-colors border border-gray-700"
        >+</button>
        <button
          onClick={() => setZoom((z) => Math.max(1, z / 1.3))}
          className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 text-white rounded text-lg flex items-center justify-center transition-colors border border-gray-700"
        >-</button>
        <button
          onClick={() => { setZoom(1); setVbX(0); setVbY(0); }}
          className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 text-white rounded text-xs flex items-center justify-center transition-colors border border-gray-700 text-[10px]"
        >RST</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900/95 border border-gray-700 rounded-xl p-3 text-xs text-gray-300 space-y-1.5 backdrop-blur-sm">
        <div className="text-gray-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">Legend</div>
        <div className="flex items-center gap-2">
          <svg width={16} height={16}>
            <circle cx={8} cy={8} r={6} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
            <circle cx={8} cy={8} r={2.8} fill="#f59e0b" />
          </svg>
          <span>Capital</span>
        </div>
        <LegendItem color="#6b7280" size={3.5} label="Core Province" />
        <LegendItem color="#374151" size={2.5} label="Peripheral" />
        <div className="border-t border-gray-700 pt-2 mt-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <svg width={16} height={3}><line x1={0} y1={1.5} x2={16} y2={1.5} stroke="rgba(255,255,255,0.65)" strokeWidth={1} /></svg>
            <span>Nation Border</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width={16} height={3}><line x1={0} y1={1.5} x2={16} y2={1.5} stroke="rgba(100,116,139,0.4)" strokeWidth={1} strokeDasharray="2,2" /></svg>
            <span>Non-playable</span>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-2 mt-1 space-y-1.5">
          <ArmyLegendRow color="#22c55e" label="Idle Army" />
          <ArmyLegendRow color="#f59e0b" label="Moving" />
          <ArmyLegendRow color="#ef4444" label="Attacking" />
        </div>
      </div>
    </div>
  );
}

function ArmyLegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={14} height={14}>
        <circle cx={7} cy={7} r={5} fill="#0d1b2a" stroke={color} strokeWidth={1.2} />
        <line x1={4} y1={7} x2={10} y2={7} stroke={color} strokeWidth={1} />
        <line x1={7} y1={4} x2={7} y2={10} stroke={color} strokeWidth={1} />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function LegendItem({ color, size, label }: { color: string; size: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={16} height={16}>
        <circle cx={8} cy={8} r={size} fill="none" stroke={color} strokeWidth={0.8} opacity={0.7} />
        <circle cx={8} cy={8} r={1.5} fill={color} />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function ProvinceTooltip({
  province,
  country,
  armies,
  x,
  y,
}: {
  province: Province;
  country: Country | undefined;
  armies: Army[];
  x: number;
  y: number;
}) {
  const resourceColors: Record<string, string> = {
    food: 'text-green-400',
    oil: 'text-yellow-400',
    steel: 'text-blue-400',
    money: 'text-amber-400',
  };

  const totalUnits = armies.reduce((s, a) => s + a.unit_count, 0);

  return (
    <div
      className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl text-xs"
      style={{ left: x + 14, top: y - 12 }}
    >
      <div className="font-semibold text-white mb-0.5">{province.name}</div>
      <div className="text-gray-400 mb-2 text-[10px]">{country?.name}</div>
      <div className="space-y-1 text-gray-300">
        <div>Type: <span className="capitalize text-white">{province.type}</span></div>
        <div>
          Resource: <span className={`capitalize ${resourceColors[province.resource_type] ?? ''}`}>{province.resource_type}</span>
        </div>
        <div>Production: <span className="text-white">{province.base_production}/tick</span></div>
        <div>Points: <span className="text-amber-400 font-semibold">{province.points}</span></div>
        <div>Morale: <span className="text-white">{province.morale}%</span></div>
        {totalUnits > 0 && (
          <div className="border-t border-gray-700 pt-1 mt-1">
            <span className="text-green-400 font-semibold">{totalUnits} units stationed</span>
          </div>
        )}
      </div>
    </div>
  );
}
