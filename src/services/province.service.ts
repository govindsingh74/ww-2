import { ProvinceRepository } from "../repositories/province.repository";

/**
 * Capture a province safely
 */
export async function captureProvince(
  provinceId: string,
  newOwnerId: string
) {
  const province = await ProvinceRepository.getById(provinceId);

  if (!province) return;

  // ❌ Prevent duplicate capture
  if (province.owner_player_id === newOwnerId) return;

  const oldOwner = province.owner_player_id;

  // ✅ Change ownership
  province.owner_player_id = newOwnerId;

  // 🔻 Reset morale (not too high, not too low)
  province.morale = 50;

  // 💰 Transfer treasury (you can tweak %)
  const loot = province.treasury || 0;
  province.treasury = 0;

  // 🧠 Reset supply state
  province.last_supply_time = Date.now();

  // 🧠 Reset pressure (important)
  province.surrounded_by_enemy = 0;

  await ProvinceRepository.update(province);

  // 🔥 OPTIONAL: Trigger global morale impact
  await applyCaptureEffects(oldOwner, newOwnerId, province);
}

/**
 * Apply extra effects after capture
 */
async function applyCaptureEffects(
  oldOwner: string,
  newOwner: string,
  province: any
) {
  // 💣 If capital captured → huge morale drop
  if (province.type === "capital") {
    await applyGlobalMoraleDrop(oldOwner, 20);
  }

  // 🧠 If core province → moderate effect
  if (province.type === "core") {
    await applyGlobalMoraleDrop(oldOwner, 10);
  }
}

/**
 * Reduce morale of all provinces of a player
 */
async function applyGlobalMoraleDrop(playerId: string, amount: number) {
  const provinces = await ProvinceRepository.getByOwner(playerId);

  for (const p of provinces) {
    p.morale = Math.max(0, p.morale - amount);
    await ProvinceRepository.update(p);
  }
}