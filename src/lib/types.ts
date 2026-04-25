export type CountryType = 'playable' | 'neutral';
export type ProvinceType = 'capital' | 'core' | 'peripheral';
export type ResourceType = 'food' | 'oil' | 'steel' | 'money';
export type ArmyStatus = 'idle' | 'moving' | 'attacking';
export type TransactionType = 'production' | 'transfer' | 'consumption';
export type TransferStatus = 'pending' | 'in_transit' | 'arrived' | 'consumed';
export type BattleOutcome = 'ongoing' | 'attacker_won' | 'defender_won' | 'draw';
export type UnitType = 'infantry' | 'militia' | 'motorized_infantry' | 'mechanized_infantry' | 'commandos' | 'paratroopers' | 'marines' | 'snipers' | 'armored_car' | 'light_tank' | 'medium_tank' | 'heavy_tank' | 'tank_destroyer' | 'interceptor' | 'tactical_bomber' | 'strategic_bomber' | 'naval_bomber' | 'attack_bomber' | 'destroyer' | 'submarine' | 'battleship' | 'carrier' | 'nuclear_bomber' | 'missile_1' | 'nuclear_missile' | 'rocket_artillery' | 'artillery' | 'anti_tank' | 'anti_air';

export interface Country {
  id: string;
  slug: string;
  name: string;
  type: CountryType;
  capital_province_id: string | null;
  flag_color: string;
  created_at: string;
  provinces?: Province[];
}

export interface Province {
  id: string;
  slug: string;
  country_id: string;
  name: string;
  type: ProvinceType;
  points: number;
  resource_type: ResourceType;
  base_production: number;
  morale: number;
  infrastructure_level: number;
  owner_player_id: string | null;
  treasury: number;
  supply_level: number;
  lat: number;
  lng: number;
  adjacent_provinces: string[];
  created_at: string;
  country?: Country;
}

export interface Player {
  id: string;
  user_id: string;
  country_id: string;
  total_score: number;
  created_at: string;
  country?: Country;
}

export interface Army {
  id: string;
  owner_player_id: string;
  current_province_id: string;
  target_province_id: string | null;
  unit_count: number;
  attack_power: number;
  defense_power: number;
  status: ArmyStatus;
  departure_time: string | null;
  arrival_time: string | null;
  created_at: string;
  current_province?: Province;
  target_province?: Province;
}

export interface ResourceTransfer {
  id: string;
  from_province_id: string;
  to_province_id: string;
  player_id: string | null;
  amount: number;
  resource_type: ResourceType;
  status: TransferStatus;
  departure_time: string | null;
  arrival_time: string | null;
  created_at: string;
}

export interface Battle {
  id: string;
  tick_number: number;
  province_id: string;
  attacker_army_id: string | null;
  defender_army_id: string | null;
  attacker_player_id: string | null;
  defender_player_id: string | null;
  attacker_units_before: number;
  defender_units_before: number;
  attacker_units_after: number;
  defender_units_after: number;
  damage_to_defender: number;
  damage_to_attacker: number;
  outcome: BattleOutcome;
  province_captured: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  is_global: boolean;
  related_country_id: string | null;
  created_at: string;
}

export interface Ranking {
  id: string;
  player_id: string;
  country_id: string;
  score: number;
  rank: number;
  updated_at: string;
  country?: Country;
}

export interface GameState {
  id: number;
  current_tick: number;
  last_tick_at: string;
  tick_interval_seconds: number;
  is_running: boolean;
}

// Generator types
export interface GeneratedProvince {
  slug: string;
  name: string;
  type: ProvinceType;
  points: number;
  resource_type: ResourceType;
  base_production: number;
  lat: number;
  lng: number;
}

export interface GeneratedCountry {
  slug: string;
  name: string;
  type: CountryType;
  flag_color: string;
  capital_slug: string;
  provinces: GeneratedProvince[];
}

export interface UnitTemplate {
  id: string;
  type: UnitType;
  name: string;
  emoji: string;
  base_power: number;
  resource_type: ResourceType;
  production_ticks: number;
  daily_consumption: number;
}

export interface UnitProduction {
  id: string;
  province_id: string;
  unit_type: UnitType;
  research_level: number;
  quantity: number;
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
}
