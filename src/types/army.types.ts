export type ArmyStatus = "idle" | "moving" | "attacking";

export interface Army {
  id: string;
  owner_player_id: string;
  current_province_id: string;
  target_province_id: string | null;
  unit_count: number;
  status: ArmyStatus;
  departure_time: number;
  arrival_time: number;
}