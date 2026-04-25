import type { ResourceType, UnitType } from '../lib/types';

export interface UnitTemplate {
  id: string;
  type: UnitType;
  name: string;
  emoji: string;
  base_power: number;
  resource_type: ResourceType;
  production_ticks: number;
  daily_consumption: number;
  created_at: string;
}

export interface UnitInventory {
  id: string;
  province_id: string;
  unit_type: UnitType;
  quantity: number;
  research_level: number;
  updated_at: string;
}

export interface UnitProduction {
  id: string;
  province_id: string;
  unit_type: UnitType;
  quantity: number;
  research_level: number;
  status: 'idle' | 'producing';
  completion_time: string | null;
  created_at: string;
}

export interface UnitResearch {
  id: string;
  country_id: string;
  unit_type: UnitType;
  level: number;
  completed_at: string | null;
  created_at: string;
}
