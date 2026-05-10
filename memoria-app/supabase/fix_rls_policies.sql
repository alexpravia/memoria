-- ============================================================================
-- Memoria — RLS Policy Fix for Co-User Photo Import
-- ============================================================================
-- Problem: Co-users are authenticated with their own auth.uid(), but insert
-- into media/storage with user_id set to the patient's UUID. Default RLS
-- policies (auth.uid() = user_id) reject this.
--
-- Run this SQL in the Supabase Dashboard SQL Editor.
--
-- Prerequisites:
--   - RLS must be enabled on these tables. If not, uncomment the ALTER TABLE
--     lines below.
--   - Existing conflicting policies are dropped before recreation.
-- ============================================================================

-- Ensure RLS is enabled (safe to run even if already enabled)
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_people ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE flag_queue ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 1. media table — INSERT
-- ============================================================================
-- Allow co-users to insert media for their linked patient,
-- and allow patients to insert their own media.

DROP POLICY IF EXISTS "co_users_insert_media" ON media;

CREATE POLICY "co_users_insert_media" ON media
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT user_id FROM co_users WHERE auth_id = auth.uid()
    )
    OR user_id = auth.uid()
  );


-- ============================================================================
-- 2. media table — SELECT
-- ============================================================================
-- Allow co-users to read media for their linked patient,
-- and allow patients to read their own media.

DROP POLICY IF EXISTS "co_users_select_media" ON media;

CREATE POLICY "co_users_select_media" ON media
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM co_users WHERE auth_id = auth.uid()
    )
    OR user_id = auth.uid()
  );


-- ============================================================================
-- 3. media table — UPDATE
-- ============================================================================
-- Allow co-users to update media for their linked patient.

DROP POLICY IF EXISTS "co_users_update_media" ON media;

CREATE POLICY "co_users_update_media" ON media
  FOR UPDATE
  USING (
    user_id IN (
      SELECT user_id FROM co_users WHERE auth_id = auth.uid()
    )
    OR user_id = auth.uid()
  );


-- ============================================================================
-- 4. media table — DELETE
-- ============================================================================
-- Allow co-users to delete media for their linked patient.

DROP POLICY IF EXISTS "co_users_delete_media" ON media;

CREATE POLICY "co_users_delete_media" ON media
  FOR DELETE
  USING (
    user_id IN (
      SELECT user_id FROM co_users WHERE auth_id = auth.uid()
    )
    OR user_id = auth.uid()
  );


-- ============================================================================
-- 5. media_people table — INSERT
-- ============================================================================
-- Allow co-users to insert media_people rows for media belonging to their
-- linked patient (used by photo processing / tagging).

DROP POLICY IF EXISTS "co_users_insert_media_people" ON media_people;

CREATE POLICY "co_users_insert_media_people" ON media_people
  FOR INSERT
  WITH CHECK (
    media_id IN (
      SELECT id FROM media WHERE user_id IN (
        SELECT user_id FROM co_users WHERE auth_id = auth.uid()
      )
    )
  );


-- ============================================================================
-- 6. flag_queue table — INSERT
-- ============================================================================
-- Allow co-users to insert flag_queue entries for their linked patient
-- (used when photo processing flags content for review).

DROP POLICY IF EXISTS "co_users_insert_flag_queue" ON flag_queue;

CREATE POLICY "co_users_insert_flag_queue" ON flag_queue
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT user_id FROM co_users WHERE auth_id = auth.uid()
    )
    OR user_id = auth.uid()
  );


-- ============================================================================
-- 7. Storage bucket — photos
-- ============================================================================
-- Allow any authenticated user to upload to and read from the photos bucket.
-- (Run in Supabase Dashboard > Storage > Policies if the SQL below doesn't
-- apply — storage.objects policies sometimes need the Dashboard UI.)

DROP POLICY IF EXISTS "authenticated_upload_photos" ON storage.objects;

CREATE POLICY "authenticated_upload_photos" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "authenticated_read_photos" ON storage.objects;

CREATE POLICY "authenticated_read_photos" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
  );
