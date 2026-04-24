const processedProvinces = new Set<string>();

export const BattleRepository = {
  isProcessed: (provinceId: string) => {
    return processedProvinces.has(provinceId);
  },

  markProcessed: (provinceId: string) => {
    processedProvinces.add(provinceId);
  },

  reset: () => {
    processedProvinces.clear();
  }
};