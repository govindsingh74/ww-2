import { ResourceRepository } from "../repositories/resource.repository";
import { now } from "../utils/time";

export async function processResourceTransfers() {
  const transfers = await ResourceRepository.getAll();
  const currentTime = now();

  for (const transfer of transfers) {
    if (
      transfer.status === "in_transit" &&
      currentTime >= transfer.arrival_time
    ) {
      transfer.status = "delivered";

      // TODO: add to capital treasury

      await ResourceRepository.update(transfer);
    }
  }
}