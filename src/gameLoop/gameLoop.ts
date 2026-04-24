import { processArmyMovement } from "./movement.processor";
import { processCombat } from "./combat.processor";
import { generateResources } from "./resource.production";
import { processResourceTransfers } from "./resource.processor";
import { processMorale } from "./morale.processor";
import { processRebellions } from "./rebellion.processor";

await processArmyMovement();
await processCombat();

await generateResources();
await processResourceTransfers();

// ✅ ADD THESE
await processMorale();
await processRebellions();

let running = false;

setInterval(async () => {
  if (running) return;

  running = true;

  try {
    await processArmyMovement();
    await processCombat();

    // ✅ ADD THESE
    await generateResources();
    await processResourceTransfers();

  } catch (err) {
    console.error(err);
  }

  running = false;
}, 60000);