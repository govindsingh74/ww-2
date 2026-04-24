import { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import type { Country, Province } from '../lib/types';

interface CountrySidebarProps {
  countries: Country[];
  provinces: Province[];
  onSelectProvince: (province: Province) => void;
  selectedProvince: Province | null;
}

export function CountrySidebar({ countries, provinces, onSelectProvince, selectedProvince }: CountrySidebarProps) {
  const [search, setSearch] = useState('');
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'playable' | 'neutral'>('all');

  const filtered = countries
    .filter((c) => c.type === filter || filter === 'all')
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const provincesByCountry = (countryId: string) =>
    provinces.filter((p) => p.country_id === countryId);

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search nations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 text-gray-200 text-xs pl-8 pr-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-amber-500/50 placeholder-gray-600"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-2">
          {(['all', 'playable', 'neutral'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-[10px] py-1 rounded capitalize font-medium transition-colors ${
                filter === f ? 'bg-amber-500 text-gray-950' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Country list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-600 text-xs py-8">No nations found</div>
        ) : (
          filtered.map((country) => {
            const cProvinces = provincesByCountry(country.id);
            const isExpanded = expandedCountry === country.id;
            const hasSelected = cProvinces.some((p) => p.id === selectedProvince?.id);

            return (
              <div key={country.id}>
                <button
                  onClick={() => setExpandedCountry(isExpanded ? null : country.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-800/60 transition-colors text-left ${
                    hasSelected ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full border border-white/15 shrink-0"
                    style={{ background: country.flag_color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-200 text-xs font-medium truncate">{country.name}</div>
                    <div className="text-gray-600 text-[10px]">
                      {cProvinces.length} provinces
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={12} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-gray-500 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="bg-gray-950/50">
                    {cProvinces.map((province) => (
                      <button
                        key={province.id}
                        onClick={() => onSelectProvince(province)}
                        className={`w-full flex items-center gap-2 pl-8 pr-3 py-2 hover:bg-gray-800/60 transition-colors text-left ${
                          selectedProvince?.id === province.id ? 'bg-amber-500/10' : ''
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            province.type === 'capital'
                              ? 'bg-amber-400'
                              : province.type === 'core'
                              ? 'bg-blue-400'
                              : 'bg-gray-500'
                          }`}
                        />
                        <span className="text-gray-400 text-[11px] truncate">{province.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="p-3 border-t border-gray-800 grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-amber-400 font-bold text-sm">{countries.filter(c=>c.type==='playable').length}</div>
          <div className="text-gray-600 text-[10px]">Playable</div>
        </div>
        <div className="text-center">
          <div className="text-gray-300 font-bold text-sm">{countries.filter(c=>c.type==='neutral').length}</div>
          <div className="text-gray-600 text-[10px]">Neutral</div>
        </div>
      </div>
    </div>
  );
}
