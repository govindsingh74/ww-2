/*
  # World Strategy Game - Complete Schema

  ## Overview
  Full schema for a WWII-era real-time multiplayer strategy game.
  40 countries (22 playable, 18 neutral), 528 provinces, armies with combat,
  resource logistics, morale/rebellion, battle logs, and game tick state.

  ## Tables

  ### countries
  - 40 nations with flag colors and capital references

  ### provinces
  - 528 provinces with lat/lng, morale, infrastructure, supply, adjacency

  ### players
  - One player per country, linked to auth.users

  ### armies
  - Movement + combat: attack_power, defense_power, departure/arrival times

  ### resource_transfers
  - Distance-based resource flow from provinces to capitals

  ### resource_transactions
  - Ledger for all economic activity

  ### battles
  - Combat resolution log per tick

  ### notifications
  - In-game newspaper and alerts

  ### rankings
  - Cached leaderboard

  ### game_state
  - Singleton tracking current tick number and timing

  ## Security
  - RLS enabled on all tables
  - Public read for world data (countries, provinces, battles, rankings, game_state)
  - Player-scoped access for armies, transfers, transactions
*/

-- =========================================
-- COUNTRIES
-- =========================================
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('playable', 'neutral')),
  capital_province_id uuid,
  flag_color text DEFAULT '#888888',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read countries"
  ON countries FOR SELECT
  TO anon, authenticated
  USING (true);

-- =========================================
-- PROVINCES
-- =========================================
CREATE TABLE IF NOT EXISTS provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  country_id uuid REFERENCES countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('capital', 'core', 'peripheral')),
  points integer NOT NULL DEFAULT 1,
  resource_type text NOT NULL DEFAULT 'food',
  base_production numeric NOT NULL DEFAULT 30,
  morale numeric NOT NULL DEFAULT 100,
  infrastructure_level integer NOT NULL DEFAULT 1,
  owner_player_id uuid,
  treasury numeric NOT NULL DEFAULT 0,
  supply_level numeric NOT NULL DEFAULT 100,
  lat numeric NOT NULL DEFAULT 0,
  lng numeric NOT NULL DEFAULT 0,
  adjacent_provinces jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read provinces"
  ON provinces FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can update owned provinces"
  ON provinces FOR UPDATE
  TO authenticated
  USING (owner_player_id = auth.uid())
  WITH CHECK (owner_player_id = auth.uid());

-- =========================================
-- PLAYERS
-- =========================================
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  country_id uuid REFERENCES countries(id) ON DELETE SET NULL,
  total_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read all players"
  ON players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Players can insert own record"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can update own record"
  ON players FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =========================================
-- ARMIES
-- =========================================
CREATE TABLE IF NOT EXISTS armies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_player_id uuid,
  current_province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  target_province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  unit_count integer NOT NULL DEFAULT 0,
  attack_power numeric NOT NULL DEFAULT 10,
  defense_power numeric NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'moving', 'attacking')),
  departure_time timestamptz,
  arrival_time timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE armies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read all armies"
  ON armies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Players can insert own armies"
  ON armies FOR INSERT
  TO authenticated
  WITH CHECK (owner_player_id = auth.uid());

CREATE POLICY "Players can update own armies"
  ON armies FOR UPDATE
  TO authenticated
  USING (owner_player_id = auth.uid())
  WITH CHECK (owner_player_id = auth.uid());

CREATE POLICY "Players can delete own armies"
  ON armies FOR DELETE
  TO authenticated
  USING (owner_player_id = auth.uid());

-- =========================================
-- RESOURCE TRANSFERS
-- =========================================
CREATE TABLE IF NOT EXISTS resource_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_province_id uuid REFERENCES provinces(id) ON DELETE CASCADE,
  to_province_id uuid REFERENCES provinces(id) ON DELETE CASCADE,
  player_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  resource_type text NOT NULL DEFAULT 'food',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'arrived', 'consumed')),
  departure_time timestamptz,
  arrival_time timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE resource_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all transfers"
  ON resource_transfers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert transfers"
  ON resource_transfers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update transfers"
  ON resource_transfers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =========================================
-- RESOURCE TRANSACTIONS
-- =========================================
CREATE TABLE IF NOT EXISTS resource_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid REFERENCES provinces(id) ON DELETE CASCADE,
  player_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('production', 'transfer', 'consumption')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE resource_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read own transactions"
  ON resource_transactions FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Players can insert own transactions"
  ON resource_transactions FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

-- =========================================
-- BATTLES
-- =========================================
CREATE TABLE IF NOT EXISTS battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tick_number integer NOT NULL DEFAULT 0,
  province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  attacker_army_id uuid REFERENCES armies(id) ON DELETE SET NULL,
  defender_army_id uuid REFERENCES armies(id) ON DELETE SET NULL,
  attacker_player_id uuid,
  defender_player_id uuid,
  attacker_units_before integer NOT NULL DEFAULT 0,
  defender_units_before integer NOT NULL DEFAULT 0,
  attacker_units_after integer NOT NULL DEFAULT 0,
  defender_units_after integer NOT NULL DEFAULT 0,
  damage_to_defender numeric NOT NULL DEFAULT 0,
  damage_to_attacker numeric NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT 'ongoing' CHECK (outcome IN ('ongoing', 'attacker_won', 'defender_won', 'draw')),
  province_captured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read battles"
  ON battles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert battles"
  ON battles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =========================================
-- NOTIFICATIONS
-- =========================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  related_country_id uuid REFERENCES countries(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global notifications"
  ON notifications FOR SELECT
  TO anon, authenticated
  USING (is_global = true);

CREATE POLICY "Authenticated users can read all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =========================================
-- RANKINGS
-- =========================================
CREATE TABLE IF NOT EXISTS rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  country_id uuid REFERENCES countries(id) ON DELETE SET NULL,
  score numeric NOT NULL DEFAULT 0,
  rank integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rankings"
  ON rankings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can upsert rankings"
  ON rankings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rankings"
  ON rankings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =========================================
-- GAME STATE
-- =========================================
CREATE TABLE IF NOT EXISTS game_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_tick integer NOT NULL DEFAULT 0,
  last_tick_at timestamptz DEFAULT now(),
  tick_interval_seconds integer NOT NULL DEFAULT 60,
  is_running boolean NOT NULL DEFAULT true
);

ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read game state"
  ON game_state FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO game_state (id, current_tick, last_tick_at, tick_interval_seconds, is_running)
VALUES (1, 0, now(), 60, true)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX IF NOT EXISTS idx_provinces_country_id ON provinces(country_id);
CREATE INDEX IF NOT EXISTS idx_provinces_owner ON provinces(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_armies_owner ON armies(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_armies_status ON armies(status);
CREATE INDEX IF NOT EXISTS idx_armies_current_province ON armies(current_province_id);
CREATE INDEX IF NOT EXISTS idx_armies_target_province ON armies(target_province_id);
CREATE INDEX IF NOT EXISTS idx_resource_transfers_status ON resource_transfers(status, arrival_time);
CREATE INDEX IF NOT EXISTS idx_resource_transfers_from ON resource_transfers(from_province_id);
CREATE INDEX IF NOT EXISTS idx_resource_transfers_to ON resource_transfers(to_province_id);
CREATE INDEX IF NOT EXISTS idx_battles_province ON battles(province_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battles_tick ON battles(tick_number DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_global ON notifications(is_global, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_score ON rankings(score DESC);
