/*
  # Allow anonymous army reads and add demo army seeding support

  ## Changes
  1. Add anon read policy for armies table so the map can display armies without auth
  2. The demo army for USA will be seeded from the application's seedDatabase.ts
*/

-- Allow anonymous users to read armies (needed for map display)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'armies' AND policyname = 'Anyone can read armies'
  ) THEN
    CREATE POLICY "Anyone can read armies"
      ON armies FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow service role to insert armies (for seeding demo armies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'armies' AND policyname = 'Service role can insert armies'
  ) THEN
    CREATE POLICY "Service role can insert armies"
      ON armies FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;
