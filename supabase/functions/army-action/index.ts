import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASE_SPEED = 10;
const INFRA_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.3,
  3: 1.6,
  4: 2.0,
};
const EARTH_RADIUS_KM = 6371;

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

function makeSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const sb = makeSupabase();
    const url = new URL(req.url);
    const path = url.pathname.replace("/army-action", "").replace("/functions/v1/army-action", "");

    // GET / — list armies for a player
    if (req.method === "GET") {
      const playerId = url.searchParams.get("player_id");
      if (!playerId) {
        return new Response(
          JSON.stringify({ error: "player_id query param required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await sb
        .from("armies")
        .select("*, current_province:provinces!armies_current_province_id_fkey(id, name, lat, lng), target_province:provinces!armies_target_province_id_fkey(id, name, lat, lng)")
        .eq("owner_player_id", playerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ armies: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST / — create or move an army
    if (req.method === "POST") {
      const body = await req.json();
      const { action, player_id, army_id, from_province_id, to_province_id, unit_count } = body;

      if (!player_id) {
        return new Response(
          JSON.stringify({ error: "player_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // CREATE: deploy a new army at a province
      if (action === "create") {
        if (!from_province_id || !unit_count) {
          return new Response(
            JSON.stringify({ error: "from_province_id and unit_count required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify player owns the province
        const { data: prov } = await sb
          .from("provinces")
          .select("id, owner_player_id")
          .eq("id", from_province_id)
          .maybeSingle();

        if (!prov || prov.owner_player_id !== player_id) {
          return new Response(
            JSON.stringify({ error: "You do not own this province" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await sb
          .from("armies")
          .insert({
            owner_player_id: player_id,
            current_province_id: from_province_id,
            unit_count,
            attack_power: 10,
            defense_power: 10,
            status: "idle",
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ army: data }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // MOVE: send an army to a target province
      if (action === "move") {
        if (!army_id || !to_province_id) {
          return new Response(
            JSON.stringify({ error: "army_id and to_province_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify army ownership
        const { data: army } = await sb
          .from("armies")
          .select("id, owner_player_id, current_province_id, status, unit_count")
          .eq("id", army_id)
          .maybeSingle();

        if (!army || army.owner_player_id !== player_id) {
          return new Response(
            JSON.stringify({ error: "Army not found or not owned by you" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (army.status === "moving") {
          return new Response(
            JSON.stringify({ error: "Army is already moving" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get origin province for distance calc
        const { data: origin } = await sb
          .from("provinces")
          .select("id, lat, lng, infrastructure_level")
          .eq("id", army.current_province_id)
          .maybeSingle();

        const { data: target } = await sb
          .from("provinces")
          .select("id, lat, lng")
          .eq("id", to_province_id)
          .maybeSingle();

        if (!origin || !target) {
          return new Response(
            JSON.stringify({ error: "Province not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const dist = haversineKm(origin.lat, origin.lng, target.lat, target.lng);
        const hours = travelTimeHours(dist, origin.infrastructure_level);
        const now = new Date();
        const arrival = new Date(now.getTime() + hours * 3600 * 1000);

        const { data, error } = await sb
          .from("armies")
          .update({
            target_province_id: to_province_id,
            status: "moving",
            departure_time: now.toISOString(),
            arrival_time: arrival.toISOString(),
          })
          .eq("id", army_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            army: data,
            distance_km: Math.round(dist),
            travel_hours: Math.round(hours * 10) / 10,
            arrival_at: arrival.toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Unknown action. Use 'create' or 'move'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
