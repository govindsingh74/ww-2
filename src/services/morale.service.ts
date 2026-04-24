export function calculateMoraleChange({
  hasArmy,
  hasSupply,
  surroundedEnemies
}: {
  hasArmy: boolean;
  hasSupply: boolean;
  surroundedEnemies: number;
}) {
  let change = 0;

  if (!hasArmy) change -= 5;
  else change += 3;

  if (!hasSupply) change -= 5;
  else change += 3;

  if (surroundedEnemies >= 3) change -= 10;
  else if (surroundedEnemies > 0) change -= 3;

  return change;
}

export function clampMorale(morale: number) {
  return Math.max(0, Math.min(100, morale));
}