import { supabase } from './supabase';
import { generateFullMap } from './mapGenerator';

export async function seedDatabase(): Promise<{ success: boolean; message: string }> {
  // Check if already seeded
  const { count } = await supabase
    .from('countries')
    .select('*', { count: 'exact', head: true });

  if (count && count > 0) {
    return { success: true, message: 'Database already seeded' };
  }

  const countries = generateFullMap();

  // Insert countries (without capital_province_id first)
  const countryRows = countries.map((c) => ({
    slug: c.slug,
    name: c.name,
    type: c.type,
    flag_color: c.flag_color,
  }));

  const { data: insertedCountries, error: countryError } = await supabase
    .from('countries')
    .insert(countryRows)
    .select('id, slug');

  if (countryError || !insertedCountries) {
    return { success: false, message: `Country insert failed: ${countryError?.message}` };
  }

  const countryIdBySlug = Object.fromEntries(insertedCountries.map((c) => [c.slug, c.id]));

  // Insert provinces in batches
  const allProvinces = countries.flatMap((c) =>
    c.provinces.map((p) => ({
      slug: p.slug,
      country_id: countryIdBySlug[c.slug],
      name: p.name,
      type: p.type,
      points: p.points,
      resource_type: p.resource_type,
      base_production: p.base_production,
      lat: p.lat,
      lng: p.lng,
    }))
  );

  const BATCH = 100;
  for (let i = 0; i < allProvinces.length; i += BATCH) {
    const { error } = await supabase.from('provinces').insert(allProvinces.slice(i, i + BATCH));
    if (error) {
      return { success: false, message: `Province insert failed: ${error.message}` };
    }
  }

  // Fetch all inserted provinces to get IDs
  const { data: allInsertedProvinces, error: fetchError } = await supabase
    .from('provinces')
    .select('id, slug');

  if (fetchError || !allInsertedProvinces) {
    return { success: false, message: `Province fetch failed: ${fetchError?.message}` };
  }

  const provinceIdBySlug = Object.fromEntries(allInsertedProvinces.map((p) => [p.slug, p.id]));

  // Update each country with its capital_province_id
  for (const c of countries) {
    const countryId = countryIdBySlug[c.slug];
    const capitalId = provinceIdBySlug[c.capital_slug];
    if (countryId && capitalId) {
      await supabase
        .from('countries')
        .update({ capital_province_id: capitalId })
        .eq('id', countryId);
    }
  }

  // Seed a welcome notification
  await supabase.from('notifications').insert({
    type: 'info',
    message: 'The world map has been initialized. 40 nations stand ready.',
    is_global: true,
  });

  // Seed demo armies for USA (across multiple provinces)
  const usaProvinces = countries.find((c) => c.slug === 'usa')?.provinces ?? [];
  const demoArmyProvinces = usaProvinces.slice(0, 5); // Capital + first 4 provinces
  for (const p of demoArmyProvinces) {
    const pid = provinceIdBySlug[p.slug];
    if (pid) {
      await supabase.from('armies').insert({
        current_province_id: pid,
        unit_count: p.type === 'capital' ? 500 : Math.floor(Math.random() * 200) + 50,
        attack_power: 15,
        defense_power: 12,
        status: 'idle',
      });
    }
  }

  return { success: true, message: `Seeded ${countries.length} countries, ${allProvinces.length} provinces, and demo armies.` };
}
