import { supabase } from '../lib/supabase';
import type { UnitProduction, UnitInventory } from '../types/unit.types';

export async function getUnitInventory(provinceId: string) {
  const { data, error } = await supabase
    .from('unit_inventory')
    .select('*')
    .eq('province_id', provinceId);

  if (error) throw error;
  return data || [];
}

export async function getProvinceProduction(provinceId: string) {
  const { data, error } = await supabase
    .from('unit_production')
    .select('*')
    .eq('province_id', provinceId);

  if (error) throw error;
  return data || [];
}

export async function startProduction(
  provinceId: string,
  unitType: string,
  quantity: number,
  researchLevel: number,
  completionTime: string
) {
  const { data, error } = await supabase
    .from('unit_production')
    .upsert({
      province_id: provinceId,
      unit_type: unitType,
      quantity,
      research_level: researchLevel,
      status: 'producing',
      completion_time: completionTime,
    }, {
      onConflict: 'province_id,unit_type,status'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeProduction(productionId: string) {
  const { data: production, error: fetchError } = await supabase
    .from('unit_production')
    .select('*')
    .eq('id', productionId)
    .single();

  if (fetchError) throw fetchError;

  // Add units to inventory
  await supabase
    .from('unit_inventory')
    .upsert({
      province_id: production.province_id,
      unit_type: production.unit_type,
      quantity: (await getUnitCount(production.province_id, production.unit_type)) + production.quantity,
      research_level: production.research_level,
    }, {
      onConflict: 'province_id,unit_type'
    });

  // Mark production as idle
  const { data, error } = await supabase
    .from('unit_production')
    .update({ status: 'idle', completion_time: null })
    .eq('id', productionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUnitCount(provinceId: string, unitType: string): Promise<number> {
  const { data, error } = await supabase
    .from('unit_inventory')
    .select('quantity')
    .eq('province_id', provinceId)
    .eq('unit_type', unitType)
    .maybeSingle();

  if (error) throw error;
  return data?.quantity || 0;
}

export async function updateUnitCount(
  provinceId: string,
  unitType: string,
  quantity: number,
  researchLevel: number = 1
) {
  const { data, error } = await supabase
    .from('unit_inventory')
    .upsert({
      province_id: provinceId,
      unit_type: unitType,
      quantity: Math.max(0, quantity),
      research_level: researchLevel,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'province_id,unit_type'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUnitTemplates() {
  const { data, error } = await supabase
    .from('unit_templates')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCountryResearch(countryId: string) {
  const { data, error } = await supabase
    .from('unit_research')
    .select('*')
    .eq('country_id', countryId);

  if (error) throw error;
  return data || [];
}

export async function setUnitResearchLevel(
  countryId: string,
  unitType: string,
  level: number
) {
  const { data, error } = await supabase
    .from('unit_research')
    .upsert({
      country_id: countryId,
      unit_type: unitType,
      level,
      completed_at: new Date().toISOString(),
    }, {
      onConflict: 'country_id,unit_type'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
