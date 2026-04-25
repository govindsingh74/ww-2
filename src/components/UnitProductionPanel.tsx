import { useEffect, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Province } from '../lib/types';
import type { UnitTemplate, UnitProduction } from '../types/unit.types';
import { getUnitTemplates, getProvinceProduction, getUnitInventory, startProduction } from '../repositories/unit.repository';
import { calculateProductionTime, calculateResourceRequired, formatProductionTime, getProductionProgress, getTimeRemaining } from '../services/unit.service';

interface UnitProductionPanelProps {
  province: Province;
}

export function UnitProductionPanel({ province }: UnitProductionPanelProps) {
  const [templates, setTemplates] = useState<UnitTemplate[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [activeProduction, setActiveProduction] = useState<UnitProduction[]>([]);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const progressInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [province.id]);

  useEffect(() => {
    if (activeProduction.length > 0) {
      progressInterval.current = setInterval(() => {
        setActiveProduction([...activeProduction]);
      }, 500);
    }
    return () => clearInterval(progressInterval.current);
  }, [activeProduction]);

  async function loadData() {
    try {
      const [templatesData, inventoryData, productionData] = await Promise.all([
        getUnitTemplates(),
        getUnitInventory(province.id),
        getProvinceProduction(province.id),
      ]);

      setTemplates(templatesData);

      const invMap: Record<string, number> = {};
      for (const inv of inventoryData) {
        invMap[inv.unit_type] = inv.quantity;
      }
      setInventory(invMap);

      setActiveProduction(productionData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading production data:', error);
    }
  }

  async function handleStartProduction(template: UnitTemplate) {
    if (!selectedUnit || quantity <= 0) return;

    const resourceRequired = calculateResourceRequired(template, quantity, 1);
    if (province.treasury < resourceRequired) {
      alert(`Insufficient resources. Need ${resourceRequired} ${template.resource_type}, have ${province.treasury}`);
      return;
    }

    try {
      const productionSeconds = calculateProductionTime(template, 1, quantity);
      const completionTime = new Date(Date.now() + productionSeconds * 1000).toISOString();

      await startProduction(province.id, template.type, quantity, 1, completionTime);

      setSelectedUnit(null);
      setQuantity(1);
      await loadData();
    } catch (error) {
      console.error('Error starting production:', error);
      alert('Failed to start production');
    }
  }

  if (loading) return <div className="p-4 text-gray-400">Loading units...</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Unit Production</h3>

      {/* Active Production */}
      {activeProduction.length > 0 && (
        <div className="space-y-2 bg-blue-950/20 border border-blue-900/30 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-blue-300">Producing</h4>
          {activeProduction.map((prod) => {
            const template = templates.find(t => t.type === prod.unit_type);
            const progress = getProductionProgress(prod);
            const timeRemaining = getTimeRemaining(prod);

            return (
              <div key={prod.id} className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">
                    {template?.emoji} {template?.name} x{prod.quantity} (Lvl {prod.research_level})
                  </span>
                  <span className="text-gray-400">{Math.floor(progress)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-gray-500">{formatProductionTime(timeRemaining)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unit Inventory */}
      {Object.keys(inventory).length > 0 && (
        <div className="space-y-1 bg-green-950/20 border border-green-900/30 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-green-300 mb-2">Stationed Units</h4>
          {templates.map((template) => {
            const count = inventory[template.type] || 0;
            if (count === 0) return null;

            return (
              <div key={template.type} className="text-xs text-gray-300">
                {template.emoji} {template.name} x{count}
              </div>
            );
          })}
        </div>
      )}

      {/* Production Queue */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <h4 className="text-sm font-semibold text-white sticky top-0 bg-gray-900">Available Units</h4>
        {templates.map((template) => (
          <div key={template.type} className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50">
            <button
              onClick={() => setExpandedUnit(expandedUnit === template.type ? null : template.type)}
              className="w-full p-2 flex items-center justify-between hover:bg-gray-700 transition-colors text-left text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{template.emoji}</span>
                <span className="text-white font-medium">{template.name}</span>
                <span className="text-xs text-gray-400">Power: {template.base_power}</span>
              </div>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${expandedUnit === template.type ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedUnit === template.type && (
              <div className="p-3 border-t border-gray-700 space-y-2 bg-gray-900/50">
                <div className="text-xs text-gray-400 space-y-1">
                  <div>Resource: {template.emoji} {template.resource_type}</div>
                  <div>Daily consumption: {template.daily_consumption.toFixed(1)} {template.resource_type}</div>
                  <div>Production base: {template.production_ticks} ticks</div>
                </div>

                <div className="bg-gray-800 rounded p-2 space-y-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Quantity to produce:</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedUnit === template.type ? quantity : 1}
                      onChange={(e) => {
                        setSelectedUnit(template.type);
                        setQuantity(Math.max(1, parseInt(e.target.value) || 1));
                      }}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                    />
                  </div>

                  {selectedUnit === template.type && (
                    <div className="text-xs text-gray-400 space-y-1 bg-gray-900 rounded p-2">
                      <div>
                        Cost: {calculateResourceRequired(template, quantity, 1).toFixed(0)} {template.resource_type}
                      </div>
                      <div>
                        Time: {formatProductionTime(calculateProductionTime(template, 1, quantity))}
                      </div>
                      <div className="text-red-400">
                        Available: {Math.floor(province.treasury)} {template.resource_type}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => selectedUnit === template.type && handleStartProduction(template)}
                    disabled={selectedUnit !== template.type || quantity <= 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                  >
                    Start Production
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
