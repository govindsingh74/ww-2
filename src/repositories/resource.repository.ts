import { ResourceTransfer } from "../types/resource.types";

const transfers: ResourceTransfer[] = [];

export const ResourceRepository = {
  getAll: async () => transfers,

  insert: async (transfer: ResourceTransfer) => {
    transfers.push(transfer);
  },

  update: async (updated: ResourceTransfer) => {
    const index = transfers.findIndex(t => t.id === updated.id);
    if (index !== -1) transfers[index] = updated;
  }
};