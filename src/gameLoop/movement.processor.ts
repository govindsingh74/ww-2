import { ArmyRepository } from "../repositories/army.repositories";
import { now } from "../utils/time";

export async function processArmyMovement() {
  const armies = await ArmyRepository.getAll();
  const currentTime = now();

  for (const army of armies) {
    if (
      army.status === "moving" &&
      army.arrival_time &&
      currentTime >= army.arrival_time
    ) {
      // ✅ IMPORTANT: process only once
      army.current_province_id = army.target_province_id!;
      army.target_province_id = null;
      army.status = "idle";
      army.arrival_time = 0;

      await ArmyRepository.update(army);
    }
  }
}