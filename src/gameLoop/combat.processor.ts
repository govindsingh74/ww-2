import { ArmyRepository } from "../repositories/army.repositories";
import { BattleRepository } from "../repositories/battle.repository";
import { resolveBattle, getWinningPlayer } from "../services/combat.service";
import { captureProvince } from "../services/province.service";

export async function processCombat() {
  const armies = await ArmyRepository.getAll();

  // Reset battle lock each tick
  BattleRepository.reset();

  // Group armies by province
  const provinceMap: Record<string, any[]> = {};

  for (const army of armies) {
    if (army.status !== "idle") continue;

    if (!provinceMap[army.current_province_id]) {
      provinceMap[army.current_province_id] = [];
    }

    provinceMap[army.current_province_id].push(army);
  }

  // Process each province once
  for (const provinceId in provinceMap) {
    if (BattleRepository.isProcessed(provinceId)) continue;

    const armiesInProvince = provinceMap[provinceId];

    // Check if multiple players present
    const players = new Set(
      armiesInProvince.map(a => a.owner_player_id)
    );

    if (players.size > 1) {
      const updatedArmies = resolveBattle(armiesInProvince);

      // ✅ 1. Update armies
      for (const army of updatedArmies) {
        if (army.unit_count <= 0) {
          army.status = "destroyed";
        }
        await ArmyRepository.update(army);
      }

      // ✅ 2. Determine winner
      const winner = getWinningPlayer(updatedArmies);

      // ✅ 3. Capture province (ONLY ONCE)
      if (winner) {
        await captureProvince(provinceId, winner);
      }
    }

    BattleRepository.markProcessed(provinceId);
  }
}