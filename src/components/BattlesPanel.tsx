import { useEffect, useState } from 'react';
import { Swords, Trophy, Shield, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Battle, Country } from '../lib/types';

interface BattlesPanelProps {
  countries: Country[];
}

export function BattlesPanel({ countries }: BattlesPanelProps) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  const countryById = Object.fromEntries(countries.map((c) => [c.id, c]));

  useEffect(() => {
    supabase
      .from('battles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setBattles(data ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel('battles')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battles' }, (payload) => {
        setBattles((prev) => [payload.new as Battle, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (battles.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Swords size={40} className="mx-auto mb-3 opacity-30" />
        <p>No battles recorded yet. The world is at peace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {battles.map((battle) => (
        <BattleCard key={battle.id} battle={battle} countryById={countryById} />
      ))}
    </div>
  );
}

function BattleCard({ battle, countryById }: { battle: Battle; countryById: Record<string, Country> }) {
  const outcomeStyles: Record<string, { border: string; bg: string; label: string }> = {
    attacker_won: { border: 'border-red-500/30', bg: 'bg-red-500/5', label: 'Attacker Victory' },
    defender_won: { border: 'border-blue-500/30', bg: 'bg-blue-500/5', label: 'Defender Victory' },
    ongoing: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5', label: 'Ongoing' },
    draw: { border: 'border-gray-500/30', bg: 'bg-gray-500/5', label: 'Draw' },
  };

  const style = outcomeStyles[battle.outcome] ?? outcomeStyles.ongoing;
  const date = new Date(battle.created_at);
  const relative = formatRelative(date);

  return (
    <div className={`bg-gray-900 border ${style.border} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Swords size={16} className="text-red-400" />
          <span className="text-white font-semibold text-sm">Tick {battle.tick_number}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${style.border} ${style.bg}`}>
            {style.label}
          </span>
          <span className="text-gray-600 text-xs flex items-center gap-1">
            <Clock size={10} /> {relative}
          </span>
        </div>
      </div>

      {/* Forces */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <ForceColumn
          label="Attacker"
          unitsBefore={battle.attacker_units_before}
          unitsAfter={battle.attacker_units_after}
          damage={battle.damage_to_attacker}
          icon={<Swords size={12} className="text-red-400" />}
          won={battle.outcome === 'attacker_won'}
        />
        <ForceColumn
          label="Defender"
          unitsBefore={battle.defender_units_before}
          unitsAfter={battle.defender_units_after}
          damage={battle.damage_to_defender}
          icon={<Shield size={12} className="text-blue-400" />}
          won={battle.outcome === 'defender_won'}
        />
      </div>

      {battle.province_captured && (
        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Trophy size={12} /> Province captured!
        </div>
      )}
    </div>
  );
}

function ForceColumn({
  label,
  unitsBefore,
  unitsAfter,
  damage,
  icon,
  won,
}: {
  label: string;
  unitsBefore: number;
  unitsAfter: number;
  damage: number;
  icon: React.ReactNode;
  won: boolean;
}) {
  const loss = unitsBefore - unitsAfter;
  const lossPct = unitsBefore > 0 ? (loss / unitsBefore) * 100 : 0;

  return (
    <div className={`rounded-lg p-2.5 ${won ? 'bg-green-500/5 border border-green-500/20' : 'bg-gray-800/50'}`}>
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-2">
        {icon} {label}
      </div>
      <div className="text-white font-semibold text-sm">
        {unitsAfter} <span className="text-gray-500 font-normal">/ {unitsBefore}</span>
      </div>
      <div className="h-1 bg-gray-700 rounded-full mt-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${won ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${100 - lossPct}%` }}
        />
      </div>
      <div className="text-gray-500 text-[10px] mt-1">
        -{loss} units ({Math.round(damage)} dmg)
      </div>
    </div>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
}
