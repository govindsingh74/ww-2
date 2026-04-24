import { Army } from "../types/army.types";
import { haversine } from "../utils/distance";
import { now } from "../utils/time";

const BASE_SPEED = 10; // km per hour

function getInfraMultiplier(level: number): number {
  switch (level) {
    case 1: return 1.0;
    case 2: return 1.3;
    case 3: return 1.6;
    case 4: return 2.0;
    default: return 1.0;
  }
}

export function calculateTravelTime(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  infraLevel: number
): number {
  const distance = haversine(from.lat, from.lng, to.lat, to.lng);
  const speed = BASE_SPEED * getInfraMultiplier(infraLevel);

  const hours = distance / speed;

  return hours * 60 * 60 * 1000; // ms
}

// ----------------------------

export function moveArmy(
  army: Army,
  fromCoords: { lat: number; lng: number },
  toCoords: { lat: number; lng: number },
  infraLevel: number
): Army {
  if (army.status !== "idle") {
    throw new Error("Army is not idle");
  }

  const travelTime = calculateTravelTime(fromCoords, toCoords, infraLevel);

  return {
    ...army,
    status: "moving",
    target_province_id: "TARGET_ID", // assign properly outside
    departure_time: now(),
    arrival_time: now() + travelTime,
  };
}