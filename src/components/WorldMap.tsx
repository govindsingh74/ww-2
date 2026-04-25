import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Country, Province } from '../lib/types';

interface WorldMapProps {
  countries: Country[];
  provinces: Province[];
  onSelectProvince: (province: Province) => void;
  selectedProvince: Province | null;
}

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 700;

// Natural Earth projection (simplified equirectangular with compression)
function latLngToXY(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * MAP_WIDTH;
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return [x, y];
}

// Map our country names to Natural Earth GeoJSON NAME property
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

// Label font size based on zoom and province type
function getLabelFontSize(type: Province['type'], zoom: number): number {
  const base = type === 'capital' ? 5 : type === 'core' ? 4 : 3.5;
  return base * Math.min(zoom, 2);
}

// Get resource emoji
function getResourceEmoji(resourceType: string): string {
  const emojis: Record<string, string> = {
    food: '🌾',
    oil: '🛢️',
    steel: '⚙️',
    money: '💰',
  };
  return emojis[resourceType] || '📦';
}

export function WorldMap({ countries, provinces, onSelectProvince, selectedProvince }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState(`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vbX: 0, vbY: 0 });
  const [zoom, setZoom] = useState(1);
  const [vbX, setVbX] = useState(0);
  const [vbY, setVbY] = useState(0);
  const [tooltip, setTooltip] = useState<{ province: Province; x: number; y: number } | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const countryById = Object.fromEntries(countries.map((c) => [c.id, c]));
  const countryByName = useMemo(() => {
    const map: Record<string, Country> = {};
    for (const c of countries) {
      map[c.name] = c;
      const neName = NAME_MAP[c.name];
      if (neName) map[neName] = c;
    }
    return map;
  }, [countries]);

  // Convert TopoJSON to GeoJSON features
  const geoFeatures = useMemo(() => {
    const topo = worldData as unknown as Topology;
    const geo = feature(topo, topo.objects.countries as GeometryCollection);
    return geo.features;
  }, []);

  // Build a map from GeoJSON feature NAME to our country
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

  // Convert GeoJSON polygon coordinates to SVG path
  function polygonToPath(coordinates: number[][][]): string {
    return coordinates.map((ring) => {
      const points = ring.map(([lng, lat]) => {
        const [x, y] = latLngToXY(lat, lng);
        return `${x},${y}`;
      });
      return `M${points.join('L')}Z`;
    }).join('');
  }

  function multiPolygonToPath(coordinates: number[][][][]): string {
    return coordinates.map((polygon) => polygonToPath(polygon)).join('');
  }

  function featureToPath(f: GeoJSON.Feature): string {
    const geom = f.geometry;
    if (!geom) return '';
    if (geom.type === 'Polygon') return polygonToPath(geom.coordinates as number[][][]);
    if (geom.type === 'MultiPolygon') return multiPolygonToPath(geom.coordinates as number[][][][]);
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
          {/* Glow filter for selected province */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        <g opacity={0.06} stroke="#64748b" strokeWidth={0.5}>
          {[-60, -30, 0, 30, 60].map((lat) => {
            const [, y] = latLngToXY(lat, 0);
            return <line key={lat} x1={0} y1={y} x2={MAP_WIDTH} y2={y} />;
          })}
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lng) => {
            const [x] = latLngToXY(0, lng);
            return <line key={lng} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} />;
          })}
        </g>

        {/* Country boundary polygons */}
        <g>
          {geoFeatures.map((f) => {
            const country = featureCountryMap.get(f.id as number);
            const isGameCountry = country !== null && country !== undefined;
            const isHovered = hoveredCountry === country?.id;
            const path = featureToPath(f);

            if (!path) return null;

            // Color: game countries get their flag color, others get neutral gray
            const fillColor = isGameCountry
              ? (country as Country).flag_color
              : '#1e293b';
            const fillOpacity = isGameCountry
              ? (isHovered ? 0.55 : 0.35)
              : 0.3;
            const strokeColor = isGameCountry
              ? (country as Country).flag_color
              : '#334155';
            const strokeWidth = isGameCountry
              ? (isHovered ? 1.2 : 0.6)
              : 0.3;

            return (
              <path
                key={f.id as number}
                d={path}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeDasharray={isGameCountry ? 'none' : '2,2'}
                onMouseEnter={() => {
                  if (isGameCountry) setHoveredCountry((country as Country).id);
                }}
                onMouseLeave={() => setHoveredCountry(null)}
                className={isGameCountry ? 'cursor-pointer' : ''}
                style={{ transition: 'fill-opacity 0.15s, stroke-width 0.15s' }}
              />
            );
          })}
        </g>

        {/* Country name labels for game countries */}
        <g>
          {countries.map((country) => {
            // Find the centroid of this country's provinces
            const cProvs = provinces.filter((p) => p.country_id === country.id);
            if (cProvs.length === 0) return null;
            const avgLat = cProvs.reduce((s, p) => s + p.lat, 0) / cProvs.length;
            const avgLng = cProvs.reduce((s, p) => s + p.lng, 0) / cProvs.length;
            const [x, y] = latLngToXY(avgLat, avgLng);

            return (
              <text
                key={`label-${country.id}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fillOpacity={0.7}
                fontSize={zoom > 2 ? 6 : zoom > 1.5 ? 5 : 4}
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {country.name}
              </text>
            );
          })}
        </g>

        {/* Connection lines between provinces of the same country */}
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
                        strokeWidth={0.3}
                        opacity={0.15}
                      />
                    );
                  })}
              </g>
            );
          })}
        </g>

        {/* Province markers with labels */}
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
                {/* Selection pulse ring */}
                {isSelected && (
                  <circle cx={x} cy={y} r={r + 5} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.6} filter="url(#glow)">
                    <animate attributeName="r" values={`${r + 4};${r + 8};${r + 4}`} dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {isCapital ? (
                  /* Capital: double-dot — outer ring + inner filled circle */
                  <>
                    {/* Outer ring */}
                    <circle
                      cx={x} cy={y} r={r}
                      fill="none"
                      stroke={color}
                      strokeWidth={isSelected ? 2 : 1.5}
                    />
                    {/* Inner filled dot */}
                    <circle
                      cx={x} cy={y} r={r * 0.48}
                      fill={color}
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth={0.5}
                    />
                    {/* Star/cross tick marks at cardinal points for capital */}
                    <line x1={x - r - 2} y1={y} x2={x - r + 1} y2={y} stroke={color} strokeWidth={1} opacity={0.8} />
                    <line x1={x + r - 1} y1={y} x2={x + r + 2} y2={y} stroke={color} strokeWidth={1} opacity={0.8} />
                    <line x1={x} y1={y - r - 2} x2={x} y2={y - r + 1} stroke={color} strokeWidth={1} opacity={0.8} />
                    <line x1={x} y1={y + r - 1} x2={x} y2={y + r + 2} stroke={color} strokeWidth={1} opacity={0.8} />
                  </>
                ) : (
                  /* Non-capital: crosshair point marker */
                  <>
                    {/* Outer thin ring */}
                    <circle
                      cx={x} cy={y} r={r}
                      fill="none"
                      stroke={color}
                      strokeWidth={isSelected ? 1.5 : 0.8}
                      opacity={0.7}
                    />
                    {/* Center point */}
                    <circle
                      cx={x} cy={y} r={isSelected ? 2 : 1.5}
                      fill={color}
                    />
                  </>
                )}

                {/* Province name and resource emoji */}
                <text
                  x={x}
                  y={y + r + labelSize + 1}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fill={isSelected ? '#f59e0b' : (isCapital ? 'white' : 'rgba(255,255,255,0.75)')}
                  fontSize={labelSize}
                  fontWeight={isCapital ? '700' : '500'}
                  fontFamily="system-ui, sans-serif"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={isCapital ? 3 : 2}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none' }}
                >
                  {province.name}
                </text>

                {/* Resource emoji */}
                <text
                  x={x + (province.name.length * labelSize * 0.25)}
                  y={y + r + labelSize + 1}
                  textAnchor="start"
                  dominantBaseline="hanging"
                  fontSize={labelSize * 1.2}
                  style={{ pointerEvents: 'none', marginLeft: '2px' }}
                >
                  {getResourceEmoji(province.resource_type)}
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
        >−</button>
        <button
          onClick={() => { setZoom(1); setVbX(0); setVbY(0); }}
          className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 text-white rounded text-xs flex items-center justify-center transition-colors border border-gray-700"
        >↺</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900/90 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 space-y-1.5 backdrop-blur-sm">
        <div className="text-gray-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">Legend</div>
        {/* Capital double-dot */}
        <div className="flex items-center gap-2">
          <svg width={16} height={16}>
            <circle cx={8} cy={8} r={6} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
            <circle cx={8} cy={8} r={2.8} fill="#f59e0b" />
          </svg>
          <span>Capital</span>
        </div>
        <LegendItem color="#6b7280" size={3.5} label="Core Province" />
        <LegendItem color="#374151" size={2.5} label="Peripheral" />
        <div className="border-t border-gray-700 pt-2 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded-sm bg-amber-500/40 border border-amber-500/60" />
            <span>Game Nation</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-4 h-3 rounded-sm bg-slate-700/40 border border-slate-600/40" />
            <span>Non-playable</span>
          </div>
        </div>
      </div>
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
  x,
  y,
}: {
  province: Province;
  country: Country | undefined;
  x: number;
  y: number;
}) {
  const resourceColors: Record<string, string> = {
    food: 'text-green-400',
    oil: 'text-yellow-400',
    steel: 'text-blue-400',
    money: 'text-amber-400',
  };

  return (
    <div
      className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs"
      style={{ left: x + 12, top: y - 10 }}
    >
      <div className="font-semibold text-white mb-1">{province.name}</div>
      <div className="text-gray-400 mb-2">{country?.name}</div>
      <div className="space-y-1 text-gray-300">
        <div>Type: <span className="capitalize text-white">{province.type}</span></div>
        <div>
          Resource:{' '}
          <span className={`capitalize ${resourceColors[province.resource_type] ?? ''}`}>
            {province.resource_type}
          </span>
        </div>
        <div>Production: <span className="text-white">{province.base_production}/tick</span></div>
        <div>Points: <span className="text-amber-400">{province.points}</span></div>
        <div>Morale: <span className="text-white">{province.morale}%</span></div>
      </div>
    </div>
  );
}
