import { Army } from "../types/army.types";

function randomFactor() {
  return 0.8 + Math.random() * 0.4; // 0.8 - 1.2
}

export function resolveBattle(armies: Army[]): Army[] {
  if (armies.length <= 1) return armies;

  // Group armies by player
  const groups: Record<string, Army[]> = {};

  for (const army of armies) {
    if (!groups[army.owner_player_id]) {
      groups[army.owner_player_id] = [];
    }
    groups[army.owner_player_id].push(army);
  }

  const players = Object.keys(groups);

  if (players.length <= 1) return armies;

  // Simple 2-side combat (expand later if needed)
  const [playerA, playerB] = players;

  const armyA = groups[playerA].reduce((sum, a) => sum + a.unit_count, 0);
  const armyB = groups[playerB].reduce((sum, a) => sum + a.unit_count, 0);

  const attackA = armyA * randomFactor();
  const attackB = armyB * randomFactor();

  let remainingA = armyA - attackB;
  let remainingB = armyB - attackA;

  remainingA = Math.max(0, remainingA);
  remainingB = Math.max(0, remainingB);

  // Redistribute remaining units
  const updated: Army[] = [];

  for (const army of armies) {
    if (army.owner_player_id === playerA) {
      const ratio = army.unit_count / armyA || 0;
      army.unit_count = Math.floor(remainingA * ratio);
    } else {
      const ratio = army.unit_count / armyB || 0;
      army.unit_count = Math.floor(remainingB * ratio);
    }

    updated.push(army);
  }

  return updated;
}