import { captureProvince } from "../services/province.service";

// Replace with DB later
const provinces: any[] = [];

export async function processRebellions() {
  // Group by country
  const countryMap: Record<string, any[]> = {};

  for (const p of provinces) {
    if (!countryMap[p.owner_player_id]) {
      countryMap[p.owner_player_id] = [];
    }
    countryMap[p.owner_player_id].push(p);
  }

  for (const playerId in countryMap) {
    const playerProvinces = countryMap[playerId];

    const candidates = playerProvinces.filter(
      p => p.morale < 30 && p.surrounded_by_enemy >= 3
    );

    if (candidates.length === 0) continue;

    // 🔥 ONLY ONE rebellion per player per tick
    const target = candidates.sort((a, b) => a.morale - b.morale)[0];

    const newOwner = target.nearest_enemy_player_id;

    if (newOwner) {
      await captureProvince(target.id, newOwner);
    }
  }
}