import { Army } from "../types/army.types";

const armies: Army[] = [];

export const ArmyRepository = {
  getAll: async (): Promise<Army[]> => armies,

  update: async (updated: Army) => {
    const index = armies.findIndex(a => a.id === updated.id);
    if (index !== -1) {
      armies[index] = updated;
    }
  },

  insert: async (army: Army) => {
    armies.push(army);
  }
};