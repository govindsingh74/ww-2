/*
  # Add Unit Production System

  ## Overview
  Adds complete military unit system with production, research levels, and resource consumption.

  ## New Tables

  ### unit_templates
  - Base definitions for all 28 unit types
  - Includes emoji, base power, production time, resource type, daily consumption

  ### unit_production
  - Tracks active unit production in provinces
  - Links to provinces and players
  - Tracks research level (1-7) per unit type per province
  - Completion time for current production batch

  ### unit_research
  - Country-level research tracking for each unit type
  - Research levels 1-7
  - Completion timestamp for each level

  ### unit_inventory
  - Current unit counts per province per type
  - Updated in real-time as units are produced/consumed

  ## Security
  - RLS enabled on all tables
  - Players can only manage their own units
  - Resource checks enforced at application level
*/

-- Unit Templates (base definitions for all unit types)
CREATE TABLE IF NOT EXISTS unit_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text UNIQUE NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL,
  base_power numeric NOT NULL DEFAULT 10,
  resource_type text NOT NULL,
  production_ticks integer NOT NULL DEFAULT 60,
  daily_consumption numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Unit Inventory (units stationed in provinces)
CREATE TABLE IF NOT EXISTS unit_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid REFERENCES provinces(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  research_level integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

-- Unit Production (active production queues)
CREATE TABLE IF NOT EXISTS unit_production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid REFERENCES provinces(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  research_level integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'idle',
  completion_time timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(province_id, unit_type, status)
);

-- Unit Research (country-level tech progress)
CREATE TABLE IF NOT EXISTS unit_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid REFERENCES countries(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 7),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(country_id, unit_type)
);

-- RLS Policies
ALTER TABLE unit_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read unit templates"
  ON unit_templates FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE unit_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read unit inventory"
  ON unit_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update owned provinces inventory"
  ON unit_inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM provinces
      WHERE provinces.id = unit_inventory.province_id
      AND provinces.owner_player_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provinces
      WHERE provinces.id = unit_inventory.province_id
      AND provinces.owner_player_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert unit inventory"
  ON unit_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provinces
      WHERE provinces.id = unit_inventory.province_id
      AND provinces.owner_player_id = auth.uid()
    )
  );

ALTER TABLE unit_production ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read unit production"
  ON unit_production FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage own province production"
  ON unit_production FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provinces
      WHERE provinces.id = unit_production.province_id
      AND provinces.owner_player_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update own province production"
  ON unit_production FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM provinces
      WHERE provinces.id = unit_production.province_id
      AND provinces.owner_player_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provinces
      WHERE provinces.id = unit_production.province_id
      AND provinces.owner_player_id = auth.uid()
    )
  );

ALTER TABLE unit_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read unit research"
  ON unit_research FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage own country research"
  ON unit_research FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.user_id = auth.uid()
      AND players.country_id = unit_research.country_id
    )
  );

CREATE POLICY "Authenticated users can update own country research"
  ON unit_research FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.user_id = auth.uid()
      AND players.country_id = unit_research.country_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.user_id = auth.uid()
      AND players.country_id = unit_research.country_id
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unit_inventory_province ON unit_inventory(province_id);
CREATE INDEX IF NOT EXISTS idx_unit_production_province ON unit_production(province_id);
CREATE INDEX IF NOT EXISTS idx_unit_production_status ON unit_production(status);
CREATE INDEX IF NOT EXISTS idx_unit_research_country ON unit_research(country_id);

-- Insert unit templates
INSERT INTO unit_templates (type, name, emoji, base_power, resource_type, production_ticks, daily_consumption) VALUES
('infantry', 'Infantry', '🪖', 5, 'food', 20, 0.5),
('militia', 'Militia', '👥', 3, 'food', 10, 0.3),
('motorized_infantry', 'Motorized Infantry', '🚗', 7, 'oil', 25, 1.0),
('mechanized_infantry', 'Mechanized Infantry', '🛡️', 9, 'steel', 30, 1.2),
('commandos', 'Commandos', '⚡', 12, 'food', 40, 0.8),
('paratroopers', 'Paratroopers', '🪂', 10, 'food', 35, 0.7),
('marines', 'Marines', '🌊', 11, 'food', 35, 0.9),
('snipers', 'Snipers', '🎯', 14, 'food', 50, 0.4),
('armored_car', 'Armored Car', '🚙', 8, 'oil', 30, 0.6),
('light_tank', 'Light Tank', '🅣', 15, 'steel', 45, 1.5),
('medium_tank', 'Medium Tank', '🔥', 20, 'steel', 60, 2.0),
('heavy_tank', 'Heavy Tank', '⚔️', 28, 'steel', 80, 2.5),
('tank_destroyer', 'Tank Destroyer', '💣', 22, 'steel', 65, 2.0),
('interceptor', 'Interceptor', '✈️', 16, 'oil', 50, 1.2),
('tactical_bomber', 'Tactical Bomber', '🛩️', 18, 'oil', 55, 1.4),
('strategic_bomber', 'Strategic Bomber', '🚁', 24, 'oil', 70, 1.8),
('naval_bomber', 'Naval Bomber', '🛸', 20, 'oil', 60, 1.5),
('attack_bomber', 'Attack Bomber', '💨', 19, 'oil', 58, 1.4),
('destroyer', 'Destroyer', '⚓', 17, 'steel', 55, 1.3),
('submarine', 'Submarine', '🌀', 16, 'steel', 60, 0.8),
('battleship', 'Battleship', '🛳️', 32, 'steel', 100, 2.5),
('carrier', 'Carrier', '🚢', 25, 'steel', 90, 2.2),
('nuclear_bomber', 'Nuclear Bomber', '☢️', 40, 'oil', 150, 2.0),
('missile_1', 'Missile-1', '🚀', 18, 'steel', 70, 0.5),
('nuclear_missile', 'Nuclear Missile', '☢️🚀', 50, 'steel', 200, 0.3),
('rocket_artillery', 'Rocket Artillery', '🎆', 21, 'steel', 65, 1.2),
('artillery', 'Artillery', '🔫', 13, 'steel', 40, 0.9),
('anti_tank', 'Anti-Tank Gun', '🎯', 14, 'steel', 45, 0.7),
('anti_air', 'Anti-Air Gun', '📡', 12, 'steel', 42, 0.6)
ON CONFLICT (type) DO NOTHING;
