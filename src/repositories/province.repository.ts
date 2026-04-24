import { Province } from "../types/province.types";

const provinces: Province[] = [];

export const ProvinceRepository = {
  // 🔍 Get all provinces
  getAll: async (): Promise<Province[]> => {
    return provinces;
  },

  // 🔍 Get by ID
  getById: async (id: string): Promise<Province | undefined> => {
    return provinces.find(p => p.id === id);
  },

  // 🔍 Get all provinces of a player
  getByOwner: async (ownerId: string): Promise<Province[]> => {
    return provinces.filter(p => p.owner_player_id === ownerId);
  },

  // ➕ Insert new province
  insert: async (province: Province) => {
    provinces.push({
      ...province,
      created_at: Date.now(),
      updated_at: Date.now()
    });
  },

  // 🔄 Update province
  update: async (updated: Province) => {
    const index = provinces.findIndex(p => p.id === updated.id);

    if (index !== -1) {
      provinces[index] = {
        ...updated,
        updated_at: Date.now()
      };
    }
  },

  // ❌ Delete province (rare use)
  delete: async (id: string) => {
    const index = provinces.findIndex(p => p.id === id);
    if (index !== -1) {
      provinces.splice(index, 1);
    }
  }
};