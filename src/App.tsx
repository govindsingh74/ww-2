import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { seedDatabase } from './lib/seedDatabase';
import type { Country, Province } from './lib/types';
import { Header } from './components/Header';
import { WorldMap } from './components/WorldMap';
import { CountrySidebar } from './components/CountrySidebar';
import { ProvincePanel } from './components/ProvincePanel';
import { RankingsPanel } from './components/RankingsPanel';
import { NewsPanel } from './components/NewsPanel';
import { BattlesPanel } from './components/BattlesPanel';
import { GameTickStatus } from './components/GameTickStatus';

type Tab = 'map' | 'rankings' | 'news' | 'battles';

export default function App() {
  const [tab, setTab] = useState<Tab>('map');
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState('');

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    setIsSeeding(true);
    setSeedStatus('Initializing world…');

    const result = await seedDatabase();
    setSeedStatus(result.message);
    setIsSeeding(false);

    await loadData();
  }

  async function loadData() {
    setLoading(true);

    const [{ data: countriesData }, { data: provincesData }] = await Promise.all([
      supabase.from('countries').select('*').order('name'),
      supabase.from('provinces').select('*'),
    ]);

    setCountries(countriesData ?? []);
    setProvinces(provincesData ?? []);
    setLoading(false);
  }

  const countryById = Object.fromEntries(countries.map((c) => [c.id, c]));

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <Header
        activeTab={tab as 'map' | 'rankings' | 'news'}
        onTabChange={(t) => setTab(t as Tab)}
        seedStatus={seedStatus}
        isSeeding={isSeeding}
      />

      <main className="flex-1 overflow-hidden">
        {tab === 'map' && (
          <div className="flex h-full">
            <CountrySidebar
              countries={countries}
              provinces={provinces}
              onSelectProvince={setSelectedProvince}
              selectedProvince={selectedProvince}
            />

            <div className="flex-1 relative">
              {loading ? (
                <LoadingOverlay />
              ) : (
                <WorldMap
                  countries={countries}
                  provinces={provinces}
                  onSelectProvince={setSelectedProvince}
                  selectedProvince={selectedProvince}
                />
              )}

              {selectedProvince && (
                <div className="absolute top-4 right-4 z-20">
                  <ProvincePanel
                    province={selectedProvince}
                    country={countryById[selectedProvince.country_id]}
                    onClose={() => setSelectedProvince(null)}
                  />
                </div>
              )}

              {!loading && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                  <div className="bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-400 backdrop-blur-sm">
                    <span className="text-white font-semibold">{countries.length}</span> nations &middot;{' '}
                    <span className="text-white font-semibold">{provinces.length}</span> provinces
                  </div>
                  <GameTickStatus />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'rankings' && (
          <div className="h-full overflow-y-auto">
            {loading ? (
              <LoadingOverlay />
            ) : (
              <RankingsPanel countries={countries} provinces={provinces} />
            )}
          </div>
        )}

        {tab === 'news' && (
          <div className="h-full overflow-y-auto">
            <NewsPanel />
          </div>
        )}

        {tab === 'battles' && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto py-8 px-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-red-400 text-lg">⚔</span>
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">Battle Log</h2>
                  <p className="text-gray-400 text-sm">Combat reports from the front lines</p>
                </div>
              </div>
              <BattlesPanel countries={countries} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading world data…</p>
      </div>
    </div>
  );
}
