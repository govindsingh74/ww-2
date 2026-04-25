import type { Province, ResourceType, UnitType } from '../lib/types';
import type { UnitTemplate } from '../types/unit.types';
import { getProvinceProduction, updateUnitCount, completeProduction } from '../repositories/unit.repository';

const TICKS_PER_SECOND = 1; // Game ticks
const PRODUCTION_TIME_MULTIPLIER = 1.5; // Adjust production speed

export function calculateProductionTime(
  unitTemplate: UnitTemplate,
  researchLevel: number,
  quantity: number
): number {
  const baseTicks = unitTemplate.production_ticks;
  const researchBonus = Math.max(0.1, 1 - (researchLevel - 1) * 0.08); // 1.0 to 0.52
  const ticksPerUnit = baseTicks * researchBonus;
  const totalTicks = ticksPerUnit * quantity;
  return totalTicks / TICKS_PER_SECOND;
}

export function calculateResourceRequired(
  unitTemplate: UnitTemplate,
  quantity: number,
  researchLevel: number
): number {
  const baseResourceCost = 5;
  const researchCost = baseResourceCost * (1 + (researchLevel - 1) * 0.15); // Scale with research
  return researchCost * quantity;
}

export function calculateDailyConsumption(
  unitTemplate: UnitTemplate,
  quantity: number,
  researchLevel: number
): number {
  const baseDailyConsumption = unitTemplate.daily_consumption;
  // Higher research levels consume slightly more but are more efficient
  const scaledConsumption = baseDailyConsumption * quantity * (1 + (researchLevel - 1) * 0.05);
  return scaledConsumption;
}

export function calculateUnitPower(
  unitTemplate: UnitTemplate,
  researchLevel: number
): number {
  const basePower = unitTemplate.base_power;
  const levelBonus = (researchLevel - 1) * 2; // +2 damage per level
  return basePower + levelBonus;
}

export async function processProduction(
  province: Province,
  currentTick: number
) {
  try {
    const productions = await getProvinceProduction(province.id);

    for (const production of productions) {
      if (production.status !== 'producing') continue;

      const completionTime = new Date(production.completion_time).getTime();
      const now = Date.now();

      if (now >= completionTime) {
        await completeProduction(production.id);
      }
    }
  } catch (error) {
    console.error('Error processing production:', error);
  }
}

export function getProductionProgress(production: any): number {
  if (production.status === 'idle') return 0;

  const completionTime = new Date(production.completion_time).getTime();
  const now = Date.now();

  if (now >= completionTime) return 100;

  const createdTime = new Date(production.created_at).getTime();
  const totalDuration = completionTime - createdTime;
  const elapsed = now - createdTime;

  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

export function getTimeRemaining(production: any): number {
  if (production.status === 'idle') return 0;

  const completionTime = new Date(production.completion_time).getTime();
  const now = Date.now();

  return Math.max(0, (completionTime - now) / 1000);
}

export function formatProductionTime(seconds: number): string {
  if (seconds <= 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function getResourceMultiplier(level: number): number {
  // Level 1: 1x, Level 7: 1.9x
  return 1 + (level - 1) * 0.15;
}
