-- Memoria: queue + RLS hardening for photo review pipeline
-- Run in Supabase SQL Editor after add_co_user_phone.sql and fix_rls_policies.sql

ALTER TABLE flag_queue ENABLE ROW LEVEL SECURITY;

-- Read queue rows for linked patient
DROP POLICY IF EXISTS "co_users_select_flag_queue" ON flag_queue;
CREATE POLICY "co_users_select_flag_queue" ON flag_queue
  FOR SELECT
  USING (
    user_id IN (SELECT user_id FROM co_users WHERE auth_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Update queue rows for linked patient (approve/reject/hide)
DROP POLICY IF EXISTS "co_users_update_flag_queue" ON flag_queue;
CREATE POLICY "co_users_update_flag_queue" ON flag_queue
  FOR UPDATE
  USING (
    user_id IN (SELECT user_id FROM co_users WHERE auth_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    user_id IN (SELECT user_id FROM co_users WHERE auth_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Read/update media_people rows so verification and briefing fallbacks can work
DROP POLICY IF EXISTS "co_users_select_media_people" ON media_people;
CREATE POLICY "co_users_select_media_people" ON media_people
  FOR SELECT
  USING (
    media_id IN (
      SELECT id FROM media
      WHERE user_id IN (SELECT user_id FROM co_users WHERE auth_id = auth.uid())
      OR user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "co_users_update_media_people" ON media_people;
CREATE POLICY "co_users_update_media_people" ON media_people
  FOR UPDATE
  USING (
    media_id IN (
      SELECT id FROM media
      WHERE user_id IN (SELECT user_id FROM co_users WHERE auth_id = auth.uid())
      OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    media_id IN (
      SELECT id FROM media
      WHERE user_id IN (SELECT user_id FROM co_users WHERE auth_id = auth.uid())
      OR user_id = auth.uid()
    )
  );

-- Backfill missing pending queue items for pending media
INSERT INTO flag_queue (user_id, flag_type, reference_id, description, status)
SELECT
  m.user_id,
  'media',
  m.id,
  'Photo is pending verification. Please review and approve.',
  'pending'
FROM media m
LEFT JOIN flag_queue fq
  ON fq.reference_id = m.id
  AND fq.flag_type = 'media'
  AND fq.status = 'pending'
WHERE m.file_type = 'photo'
  AND m.verification_status = 'pending'
  AND fq.id IS NULL;
