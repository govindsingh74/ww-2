import { Trophy, Users, MapPin } from 'lucide-react';
import type { Country, Province } from '../lib/types';

interface RankingsPanelProps {
  countries: Country[];
  provinces: Province[];
}

interface CountryStats {
  country: Country;
  totalPoints: number;
  provinceCount: number;
  capitalName: string;
}

export function RankingsPanel({ countries, provinces }: RankingsPanelProps) {
  const stats: CountryStats[] = countries
    .map((country) => {
      const cProvinces = provinces.filter((p) => p.country_id === country.id);
      const totalPoints = cProvinces.reduce((s, p) => s + p.points, 0);
      const capital = cProvinces.find((p) => p.type === 'capital');
      return {
        country,
        totalPoints,
        provinceCount: cProvinces.length,
        capitalName: capital?.name ?? 'Unknown',
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const maxPoints = stats[0]?.totalPoints ?? 1;

  const medalColors = ['text-amber-400', 'text-gray-300', 'text-amber-600'];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h2 className="text-white text-2xl font-bold mb-1">Global Rankings</h2>
        <p className="text-gray-400 text-sm">Nations ranked by total victory points across all provinces</p>
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.slice(0, 3).map((s, i) => (
          <PodiumCard key={s.country.id} stats={s} rank={i + 1} medalColor={medalColors[i]} />
        ))}
      </div>

      {/* Full table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-500 text-xs uppercase tracking-wider px-4 py-3 w-10">#</th>
              <th className="text-left text-gray-500 text-xs uppercase tracking-wider px-4 py-3">Nation</th>
              <th className="text-left text-gray-500 text-xs uppercase tracking-wider px-4 py-3">Type</th>
              <th className="text-right text-gray-500 text-xs uppercase tracking-wider px-4 py-3">Provinces</th>
              <th className="text-right text-gray-500 text-xs uppercase tracking-wider px-4 py-3 w-40">Points</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <TableRow
                key={s.country.id}
                stats={s}
                rank={i + 1}
                maxPoints={maxPoints}
                isTop={i < 3}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PodiumCard({
  stats,
  rank,
  medalColor,
}: {
  stats: CountryStats;
  rank: number;
  medalColor: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col items-center text-center">
      <div className={`text-3xl font-black mb-2 ${medalColor}`}>{rank}</div>
      <div
        className="w-10 h-10 rounded-full border-2 border-white/20 mb-2 flex items-center justify-center text-xs font-bold text-white"
        style={{ background: stats.country.flag_color }}
      >
        {stats.country.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="text-white font-semibold text-sm">{stats.country.name}</div>
      <div className="text-gray-400 text-xs mt-0.5">{stats.capitalName}</div>
      <div className="text-amber-400 font-bold text-lg mt-2">{stats.totalPoints.toLocaleString()}</div>
      <div className="text-gray-500 text-xs">points</div>
    </div>
  );
}

function TableRow({
  stats,
  rank,
  maxPoints,
  isTop,
}: {
  stats: CountryStats;
  rank: number;
  maxPoints: number;
  isTop: boolean;
}) {
  const barWidth = (stats.totalPoints / maxPoints) * 100;

  return (
    <tr className={`border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors ${isTop ? 'bg-amber-500/5' : ''}`}>
      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ background: stats.country.flag_color }}
          >
            {stats.country.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-white font-medium text-sm">{stats.country.name}</div>
            <div className="text-gray-500 text-xs flex items-center gap-1">
              <MapPin size={10} />
              {stats.capitalName}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            stats.country.type === 'playable'
              ? 'text-blue-400 bg-blue-400/10 border-blue-400/20'
              : 'text-gray-400 bg-gray-700/40 border-gray-600/20'
          }`}
        >
          {stats.country.type}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5 text-gray-300">
          <Users size={12} className="text-gray-500" />
          {stats.provinceCount}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className="text-amber-400 font-semibold w-12 text-right text-sm">
            {stats.totalPoints.toLocaleString()}
          </span>
        </div>
      </td>
    </tr>
  );
}
