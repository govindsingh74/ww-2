export type ProvinceType = "capital" | "core" | "peripheral";

export interface Province {
  id: string;

  // Ownership
  owner_player_id: string;

  // Classification
  type: ProvinceType;

  // Economy
  resource_type: string;
  base_production: number;
  treasury: number;

  // Infrastructure
  infrastructure_level: number;

  // Morale System
  morale: number; // 0–100
  last_supply_time: number;

  // War Pressure System
  surrounded_by_enemy: number;
  nearest_enemy_player_id: string | null;

  // Map / Position
  coordinates: {
    lat: number;
    lng: number;
  };

  // Meta
  created_at?: number;
  updated_at?: number;
}