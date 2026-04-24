/*
  # World Strategy Game - Initial Schema

  ## Overview
  Full schema for a WWII-era world strategy game with 40 countries (22 playable, 18 neutral),
  528 provinces, armies, resources, notifications, and rankings.

  ## Tables

  ### countries
  - Stores all 40 countries (playable + neutral)
  - capital_province_id is a forward reference resolved after province insertion

  ### provinces
  - 528 total: 15 per playable country, 11 per neutral
  - Types: capital, core, peripheral
  - Tracks ownership, morale, infrastructure, treasury, coordinates

  ### players
  - One player per country (for multiplayer or AI)
  - Linked to Supabase auth.users

  ### armies
  - Movement and combat system
  - Tracks source/target provinces, departure/arrival times

  ### resource_transactions
  - Ledger for all economic activity

  ### notifications
  - In-game newspaper & alert system

  ### rankings
  - Cached leaderboard updated each tick

  ## Security
  - RLS enabled on all tables
  - Public read for countries/provinces (game world data)
  - Players can only manage their own data
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
  lat numeric NOT NULL DEFAULT 0,
  lng numeric NOT NULL DEFAULT 0,
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
-- INDEXES
-- =========================================
CREATE INDEX IF NOT EXISTS idx_provinces_country_id ON provinces(country_id);
CREATE INDEX IF NOT EXISTS idx_provinces_owner ON provinces(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_armies_owner ON armies(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_armies_status ON armies(status);
CREATE INDEX IF NOT EXISTS idx_notifications_global ON notifications(is_global, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_score ON rankings(score DESC);
