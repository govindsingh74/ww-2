import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================
// CONFIG
// ============================================================
const BASE_SPEED = 10; // units per hour
const INFRA_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.3,
  3: 1.6,
  4: 2.0,
};
const EARTH_RADIUS_KM = 6371;
const TICK_INTERVAL_S = 60;

// ============================================================
// HAVERSINE DISTANCE
// ============================================================
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function travelTimeHours(distanceKm: number, infraLevel: number): number {
  const mult = INFRA_MULTIPLIERS[infraLevel] ?? 1.0;
  return distanceKm / (BASE_SPEED * mult);
}

// ============================================================
// SUPABASE CLIENT
// ============================================================
function makeSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// ============================================================
// 1. ARMY MOVEMENT
// ============================================================
async function processArmyMovement(sb: ReturnType<typeof makeSupabase>, tick: number) {
  const now = new Date().toISOString();

  // Find armies that are "moving" and have arrived
  const { data: arrived } = await sb
    .from("armies")
    .select("id, target_province_id, owner_player_id, unit_count, attack_power, defense_power")
    .eq("status", "moving")
    .lte("arrival_time", now);

  if (!arrived || arrived.length === 0) return;

  for (const army of arrived) {
    // Check if there's an enemy army at the target province
    const { data: defenders } = await sb
      .from("armies")
      .select("id, owner_player_id, unit_count, defense_power")
      .eq("current_province_id", army.target_province_id)
      .neq("owner_player_id", army.owner_player_id)
      .gt("unit_count", 0)
      .limit(1);

    if (defenders && defenders.length > 0) {
      // Switch to attacking status
      await sb
        .from("armies")
        .update({
          status: "attacking",
          current_province_id: army.target_province_id,
        })
        .eq("id", army.id);
    } else {
      // No resistance — move in
      await sb
        .from("armies")
        .update({
          status: "idle",
          current_province_id: army.target_province_id,
          target_province_id: null,
          departure_time: null,
          arrival_time: null,
        })
        .eq("id", army.id);

      // Claim unowned province
      const { data: prov } = await sb
        .from("provinces")
        .select("id, owner_player_id")
        .eq("id", army.target_province_id)
        .maybeSingle();

      if (prov && prov.owner_player_id !== army.owner_player_id) {
        await sb
          .from("provinces")
          .update({ owner_player_id: army.owner_player_id })
          .eq("id", prov.id);
      }
    }
  }
}

// ============================================================
// 2. COMBAT RESOLUTION
// ============================================================
async function resolveBattles(sb: ReturnType<typeof makeSupabase>, tick: number) {
  // Find provinces with armies from different players
  const { data: armies } = await sb
    .from("armies")
    .select("id, owner_player_id, current_province_id, unit_count, attack_power, defense_power, status")
    .in("status", ["idle", "attacking"])
    .gt("unit_count", 0);

  if (!armies || armies.length === 0) return;

  // Group by province
  const byProvince: Record<string, typeof armies> = {};
  for (const a of armies) {
    const pid = a.current_province_id;
    if (!pid) continue;
    if (!byProvince[pid]) byProvince[pid] = [];
    byProvince[pid].push(a);
  }

  // For each contested province, resolve combat
  for (const [provinceId, provinceArmies] of Object.entries(byProvince)) {
    if (provinceArmies.length < 2) continue;

    // Group by owner
    const byOwner: Record<string, typeof provinceArmies> = {};
    for (const a of provinceArmies) {
      if (!byOwner[a.owner_player_id]) byOwner[a.owner_player_id] = [];
      byOwner[a.owner_player_id].push(a);
    }

    const owners = Object.keys(byOwner);
    if (owners.length < 2) continue;

    // Simple: first two owners fight
    const attackerOwner = owners[0];
    const defenderOwner = owners[1];
    const attackerArmies = byOwner[attackerOwner];
    const defenderArmies = byOwner[defenderOwner];

    const totalAttack = attackerArmies.reduce((s, a) => s + a.attack_power * a.unit_count, 0);
    const totalDefense = defenderArmies.reduce((s, a) => s + a.defense_power * a.unit_count, 0);

    const randFactor = () => 0.8 + Math.random() * 0.4; // 0.8–1.2
    const damageToDefender = totalAttack * randFactor();
    const damageToAttacker = totalDefense * randFactor();

    // Distribute damage proportionally across armies
    const attackerTotalUnits = attackerArmies.reduce((s, a) => s + a.unit_count, 0);
    const defenderTotalUnits = defenderArmies.reduce((s, a) => s + a.unit_count, 0);

    const attackerUnitsBefore = attackerTotalUnits;
    const defenderUnitsBefore = defenderTotalUnits;

    // Apply damage to defender armies
    for (const da of defenderArmies) {
      const share = da.unit_count / defenderTotalUnits;
      const dmg = damageToDefender * share;
      const unitsLost = Math.ceil(dmg / Math.max(da.defense_power, 1));
      const newCount = Math.max(0, da.unit_count - unitsLost);
      await sb.from("armies").update({ unit_count: newCount, status: newCount > 0 ? "attacking" : "idle" }).eq("id", da.id);
    }

    // Apply damage to attacker armies
    for (const aa of attackerArmies) {
      const share = aa.unit_count / attackerTotalUnits;
      const dmg = damageToAttacker * share;
      const unitsLost = Math.ceil(dmg / Math.max(aa.attack_power, 1));
      const newCount = Math.max(0, aa.unit_count - unitsLost);
      await sb.from("armies").update({ unit_count: newCount, status: newCount > 0 ? "attacking" : "idle" }).eq("id", aa.id);
    }

    // Determine outcome
    const attackerSurvived = attackerArmies.some((a) => {
      // re-check: we just updated, so estimate
      const unitsLost = Math.ceil((damageToAttacker * (a.unit_count / attackerTotalUnits)) / Math.max(a.attack_power, 1));
      return a.unit_count - unitsLost > 0;
    });
    const defenderSurvived = defenderArmies.some((a) => {
      const unitsLost = Math.ceil((damageToDefender * (a.unit_count / defenderTotalUnits)) / Math.max(a.defense_power, 1));
      return a.unit_count - unitsLost > 0;
    });

    let outcome: string;
    let provinceCaptured = false;

    if (!defenderSurvived && attackerSurvived) {
      outcome = "attacker_won";
      provinceCaptured = true;
      // Transfer province
      await sb
        .from("provinces")
        .update({ owner_player_id: attackerOwner })
        .eq("id", provinceId);
    } else if (defenderSurvived && !attackerSurvived) {
      outcome = "defender_won";
    } else {
      outcome = "ongoing";
    }

    // Log battle
    await sb.from("battles").insert({
      tick_number: tick,
      province_id: provinceId,
      attacker_army_id: attackerArmies[0].id,
      defender_army_id: defenderArmies[0].id,
      attacker_player_id: attackerOwner,
      defender_player_id: defenderOwner,
      attacker_units_before: attackerUnitsBefore,
      defender_units_before: defenderUnitsBefore,
      attacker_units_after: attackerSurvived ? 1 : 0, // approximate
      defender_units_after: defenderSurvived ? 1 : 0,
      damage_to_defender: Math.round(damageToDefender),
      damage_to_attacker: Math.round(damageToAttacker),
      outcome,
      province_captured: provinceCaptured,
    });

    // Notification
    if (provinceCaptured) {
      await sb.from("notifications").insert({
        type: "danger",
        message: `Province captured after battle (tick ${tick})!`,
        is_global: true,
      });
    }
  }

  // Clean up destroyed armies (unit_count = 0)
  await sb.from("armies").delete().lte("unit_count", 0);
}

// ============================================================
// 3. RESOURCE PRODUCTION + TRANSFERS
// ============================================================
async function updateResourceProduction(sb: ReturnType<typeof makeSupabase>, tick: number) {
  const { data: provinces } = await sb
    .from("provinces")
    .select("id, country_id, name, base_production, resource_type, infrastructure_level, lat, lng");

  if (!provinces || provinces.length === 0) return;

  // Get capitals for each country
  const { data: countries } = await sb
    .from("countries")
    .select("id, capital_province_id");

  const capitalByCountry: Record<string, string> = {};
  for (const c of countries ?? []) {
    if (c.capital_province_id) capitalByCountry[c.id] = c.capital_province_id;
  }

  const now = new Date();

  for (const prov of provinces) {
    const capitalId = capitalByCountry[prov.country_id];

    // Record production transaction
    await sb.from("resource_transactions").insert({
      province_id: prov.id,
      amount: prov.base_production,
      type: "production",
    });

    // Add to province treasury
    await sb
      .from("provinces")
      .update({ treasury: prov.base_production }) // will be accumulated via RPC or raw SQL in production
      .eq("id", prov.id);

    // Create transfer to capital if not already the capital
    if (capitalId && capitalId !== prov.id) {
      const { data: capital } = await sb
        .from("provinces")
        .select("lat, lng")
        .eq("id", capitalId)
        .maybeSingle();

      if (capital) {
        const dist = haversineKm(prov.lat, prov.lng, capital.lat, capital.lng);
        const hours = travelTimeHours(dist, prov.infrastructure_level);
        const arrivalMs = now.getTime() + hours * 3600 * 1000;

        await sb.from("resource_transfers").insert({
          from_province_id: prov.id,
          to_province_id: capitalId,
          amount: prov.base_production,
          resource_type: prov.resource_type,
          status: "in_transit",
          departure_time: now.toISOString(),
          arrival_time: new Date(arrivalMs).toISOString(),
        });
      }
    }
  }
}

// ============================================================
// 4. PROCESS RESOURCE TRANSFERS (arrivals)
// ============================================================
async function processResourceTransfers(sb: ReturnType<typeof makeSupabase>, tick: number) {
  const now = new Date().toISOString();

  // Mark arrived transfers
  const { data: arrived } = await sb
    .from("resource_transfers")
    .select("id, to_province_id, amount, resource_type")
    .eq("status", "in_transit")
    .lte("arrival_time", now);

  if (!arrived || arrived.length === 0) return;

  for (const t of arrived) {
    // Add to capital treasury
    await sb
      .from("provinces")
      .update({ treasury: t.amount })
      .eq("id", t.to_province_id);

    // Record transaction
    await sb.from("resource_transactions").insert({
      province_id: t.to_province_id,
      amount: t.amount,
      type: "transfer",
    });

    // Mark as arrived
    await sb
      .from("resource_transfers")
      .update({ status: "arrived" })
      .eq("id", t.id);
  }
}

// ============================================================
// 5. MORALE UPDATE
// ============================================================
async function updateMorale(sb: ReturnType<typeof makeSupabase>, tick: number) {
  const { data: provinces } = await sb
    .from("provinces")
    .select("id, country_id, morale, supply_level, owner_player_id, lat, lng");

  if (!provinces || provinces.length === 0) return;

  // Get armies per province
  const { data: armies } = await sb
    .from("armies")
    .select("current_province_id, owner_player_id, unit_count")
    .gt("unit_count", 0);

  const armiesByProvince: Record<string, typeof armies> = {};
  for (const a of armies ?? []) {
    const pid = a.current_province_id;
    if (!pid) continue;
    if (!armiesByProvince[pid]) armiesByProvince[pid] = [];
    armiesByProvince[pid].push(a);
  }

  // Get recent transfers (arrived in last 5 minutes)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentTransfers } = await sb
    .from("resource_transfers")
    .select("to_province_id")
    .eq("status", "arrived")
    .gte("arrival_time", fiveMinAgo);

  const transfersToProvince = new Set((recentTransfers ?? []).map((t) => t.to_province_id));

  for (const prov of provinces) {
    let moraleChange = 0;
    const provArmies = armiesByProvince[prov.id] ?? [];

    // Decrease if no army present
    if (provArmies.length === 0) moraleChange -= 2;

    // Decrease if no incoming resources
    if (!transfersToProvince.has(prov.id)) moraleChange -= 1;

    // Increase if friendly army present
    const friendlyArmy = provArmies.some(
      (a) => a.owner_player_id === prov.owner_player_id
    );
    if (friendlyArmy) moraleChange += 2;

    // Increase if receiving supply
    if (transfersToProvince.has(prov.id)) moraleChange += 1;

    // Check enemy neighbors (simplified: check nearby provinces within 5 degrees)
    const { data: nearbyEnemies } = await sb
      .from("provinces")
      .select("owner_player_id")
      .neq("id", prov.id)
      .neq("owner_player_id", prov.owner_player_id)
      .gte("lat", prov.lat - 5)
      .lte("lat", prov.lat + 5)
      .gte("lng", prov.lng - 5)
      .lte("lng", prov.lng + 5)
      .limit(5);

    const enemyCount = (nearbyEnemies ?? []).length;
    if (enemyCount >= 3) moraleChange -= 2;

    const newMorale = Math.max(0, Math.min(100, prov.morale + moraleChange));
    if (newMorale !== prov.morale) {
      await sb.from("provinces").update({ morale: newMorale }).eq("id", prov.id);
    }
  }
}

// ============================================================
// 6. REBELLION CHECK
// ============================================================
async function checkRebellions(sb: ReturnType<typeof makeSupabase>, tick: number) {
  // Find provinces with morale < 30
  const { data: lowMorale } = await sb
    .from("provinces")
    .select("id, country_id, name, morale, owner_player_id, lat, lng")
    .lt("morale", 30)
    .order("morale", { ascending: true })
    .limit(10);

  if (!lowMorale || lowMorale.length === 0) return;

  for (const prov of lowMorale) {
    // Check if surrounded by >= 3 enemy provinces
    const { data: nearbyEnemies } = await sb
      .from("provinces")
      .select("id, owner_player_id, country_id")
      .neq("id", prov.id)
      .neq("owner_player_id", prov.owner_player_id)
      .gte("lat", prov.lat - 5)
      .lte("lat", prov.lat + 5)
      .gte("lng", prov.lng - 5)
      .lte("lng", prov.lng + 5)
      .limit(5);

    if ((nearbyEnemies ?? []).length >= 3) {
      // Rebellion! Transfer to nearest enemy owner
      const newOwner = nearbyEnemies![0].owner_player_id;

      await sb
        .from("provinces")
        .update({
          owner_player_id: newOwner,
          morale: 50, // Reset morale
        })
        .eq("id", prov.id);

      await sb.from("notifications").insert({
        type: "warning",
        message: `Rebellion in ${prov.name}! The province has switched allegiance.`,
        is_global: true,
        related_country_id: prov.country_id,
      });

      // Only one rebellion per tick
      break;
    }
  }
}

// ============================================================
// 7. UPDATE RANKINGS
// ============================================================
async function updateRankings(sb: ReturnType<typeof makeSupabase>, tick: number) {
  const { data: players } = await sb
    .from("players")
    .select("id, country_id, user_id");

  if (!players || players.length === 0) return;

  for (const player of players) {
    const { data: ownedProvinces } = await sb
      .from("provinces")
      .select("points")
      .eq("owner_player_id", player.id);

    const totalScore = (ownedProvinces ?? []).reduce((s, p) => s + p.points, 0);

    await sb
      .from("players")
      .update({ total_score: totalScore })
      .eq("id", player.id);

    // Upsert ranking
    const { data: existing } = await sb
      .from("rankings")
      .select("id")
      .eq("player_id", player.id)
      .maybeSingle();

    if (existing) {
      await sb
        .from("rankings")
        .update({ score: totalScore, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await sb.from("rankings").insert({
        player_id: player.id,
        country_id: player.country_id,
        score: totalScore,
      });
    }
  }

  // Assign ranks
  const { data: allRankings } = await sb
    .from("rankings")
    .select("id, score")
    .order("score", { ascending: false });

  if (allRankings) {
    for (let i = 0; i < allRankings.length; i++) {
      await sb
        .from("rankings")
        .update({ rank: i + 1 })
        .eq("id", allRankings[i].id);
    }
  }
}

// ============================================================
// MAIN GAME LOOP
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const sb = makeSupabase();

    // Get and increment tick
    const { data: state } = await sb
      .from("game_state")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!state || !state.is_running) {
      return new Response(
        JSON.stringify({ ok: false, message: "Game not running" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tick = state.current_tick + 1;

    // Run all systems in order
    await processArmyMovement(sb, tick);
    await resolveBattles(sb, tick);
    await updateResourceProduction(sb, tick);
    await processResourceTransfers(sb, tick);
    await updateMorale(sb, tick);
    await checkRebellions(sb, tick);
    await updateRankings(sb, tick);

    // Advance tick
    await sb
      .from("game_state")
      .update({
        current_tick: tick,
        last_tick_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return new Response(
      JSON.stringify({
        ok: true,
        tick,
        message: `Game tick ${tick} processed`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
