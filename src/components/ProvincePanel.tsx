import { X, Wheat, Fuel, Factory, DollarSign, Shield, Building2, TrendingUp, Package, Swords } from 'lucide-react';
import { useState } from 'react';
import type { Country, Province } from '../lib/types';
import { UnitProductionPanel } from './UnitProductionPanel';

interface ProvincePanelProps {
  province: Province;
  country: Country | undefined;
  onClose: () => void;
}

const RESOURCE_ICONS = {
  food: Wheat,
  oil: Fuel,
  steel: Factory,
  money: DollarSign,
};

const RESOURCE_COLORS: Record<string, string> = {
  food: 'text-green-400 bg-green-400/10 border-green-400/20',
  oil: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  steel: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  money: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
};

export function ProvincePanel({ province, country, onClose }: ProvincePanelProps) {
  const [showProduction, setShowProduction] = useState(false);
  const ResourceIcon = RESOURCE_ICONS[province.resource_type] ?? DollarSign;
  const resourceStyle = RESOURCE_COLORS[province.resource_type] ?? '';

  const moraleColor =
    province.morale >= 70
      ? 'bg-green-500'
      : province.morale >= 40
      ? 'bg-yellow-500'
      : 'bg-red-500';

  const supplyColor =
    province.supply_level >= 70
      ? 'bg-green-500'
      : province.supply_level >= 40
      ? 'bg-yellow-500'
      : 'bg-red-500';

  const typeLabels: Record<Province['type'], string> = {
    capital: 'Capital City',
    core: 'Core Province',
    peripheral: 'Peripheral Territory',
  };

  return (
    <div className="w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div
        className="p-4 flex items-start justify-between shrink-0"
        style={{ background: `linear-gradient(135deg, ${country?.flag_color ?? '#374151'}22, transparent)` }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            {country && (
              <div
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ background: country.flag_color }}
              />
            )}
            <span className="text-gray-400 text-xs uppercase tracking-wider">{typeLabels[province.type]}</span>
          </div>
          <h3 className="text-white font-bold text-lg leading-tight">{province.name}</h3>
          <p className="text-gray-400 text-sm">{country?.name}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 rounded"
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        {/* Points badge */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs uppercase tracking-wider">Victory Points</span>
          <span className="text-amber-400 font-bold text-xl">{province.points}</span>
        </div>

        {/* Resource */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${resourceStyle}`}>
          <ResourceIcon size={20} />
          <div>
            <div className="text-xs text-gray-400">Primary Resource</div>
            <div className="font-semibold capitalize">{province.resource_type}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-400">Per Tick</div>
            <div className="font-bold">{province.base_production}</div>
          </div>
        </div>

        {/* Morale */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-400 flex items-center gap-1">
              <Shield size={12} /> Morale
            </span>
            <span className="text-white font-medium">{province.morale}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${moraleColor}`}
              style={{ width: `${province.morale}%` }}
            />
          </div>
          {province.morale < 30 && (
            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
              <Swords size={10} /> Rebellion risk!
            </p>
          )}
        </div>

        {/* Supply Level */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-400 flex items-center gap-1">
              <Package size={12} /> Supply
            </span>
            <span className="text-white font-medium">{province.supply_level}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${supplyColor}`}
              style={{ width: `${province.supply_level}%` }}
            />
          </div>
        </div>

        {/* Grid stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={<Building2 size={14} />} label="Infrastructure" value={`Lv ${province.infrastructure_level}`} />
          <StatCard icon={<TrendingUp size={14} />} label="Treasury" value={`${province.treasury.toFixed(0)}`} />
        </div>

        {/* Infrastructure speed bonus */}
        <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1 text-gray-400">
            <Building2 size={11} /> Infrastructure Multiplier
          </div>
          <div className="text-white font-semibold">
            {province.infrastructure_level === 1 ? '1.0x' :
             province.infrastructure_level === 2 ? '1.3x' :
             province.infrastructure_level === 3 ? '1.6x' : '2.0x'}
            {' '}travel speed
          </div>
        </div>

        {/* Coordinates */}
        <div className="text-xs text-gray-600 border-t border-gray-800 pt-3">
          {province.lat.toFixed(2)}° {province.lat >= 0 ? 'N' : 'S'},{' '}
          {province.lng.toFixed(2)}° {province.lng >= 0 ? 'E' : 'W'}
        </div>

        {/* Unit Production Toggle */}
        <button
          onClick={() => setShowProduction(!showProduction)}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          {showProduction ? 'Hide' : 'Show'} Unit Production
        </button>

        {/* Unit Production Panel */}
        {showProduction && (
          <div className="border-t border-gray-700 pt-4 -mx-4 -mb-4 px-4 pb-4">
            <UnitProductionPanel province={province} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="text-white font-semibold text-sm">{value}</div>
    </div>
  );
}
