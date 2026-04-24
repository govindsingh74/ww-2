import { haversine } from "../utils/distance";

const BASE_SUPPLY_SPEED = 20;

function getInfraMultiplier(level: number): number {
  switch (level) {
    case 1: return 1.0;
    case 2: return 1.3;
    case 3: return 1.6;
    case 4: return 2.0;
    default: return 1.0;
  }
}

export function calculateSupplyTime(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  infraLevel: number
) {
  const distance = haversine(from.lat, from.lng, to.lat, to.lng);
  const speed = BASE_SUPPLY_SPEED * getInfraMultiplier(infraLevel);

  const hours = distance / speed;

  return hours * 60 * 60 * 1000;
}