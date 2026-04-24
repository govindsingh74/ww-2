import { clampMorale, calculateMoraleChange } from "../services/morale.service";

// Replace with DB later
const provinces: any[] = [];
const armies: any[] = [];

export async function processMorale() {
  for (const province of provinces) {
    const hasArmy = armies.some(
      a =>
        a.current_province_id === province.id &&
        a.owner_player_id === province.owner_player_id &&
        a.unit_count > 0
    );

    const hasSupply = province.last_supply_time
      ? Date.now() - province.last_supply_time < 3600000
      : false;

    const surroundedEnemies = province.surrounded_by_enemy || 0;

    const change = calculateMoraleChange({
      hasArmy,
      hasSupply,
      surroundedEnemies
    });

    province.morale = clampMorale(province.morale + change);
  }
}