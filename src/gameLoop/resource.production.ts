import { ResourceRepository } from "../repositories/resource.repository";
import { calculateSupplyTime } from "../services/resource.service";
import { now } from "../utils/time";

// You will replace this with real DB data later
const provinces: any[] = [];
const capitals: Record<string, any> = {};

export async function generateResources() {
  for (const province of provinces) {
    const capital = capitals[province.owner_player_id];

    if (!capital) continue;

    const travelTime = calculateSupplyTime(
      province.coordinates,
      capital.coordinates,
      province.infrastructure_level
    );

    await ResourceRepository.insert({
      id: crypto.randomUUID(),
      from_province_id: province.id,
      to_province_id: capital.id,
      resource_type: province.resource_type,
      amount: province.base_production,
      departure_time: now(),
      arrival_time: now() + travelTime,
      status: "in_transit"
    });
  }
}