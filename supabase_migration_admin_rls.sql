-- Admin darf beliebige Profile updaten (profiles-Tabelle)
-- Ausführen im Supabase SQL-Editor
CREATE POLICY "admin_can_update_any_profile" ON profiles
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
