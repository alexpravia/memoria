-- ============================================================================
-- Memoria — Ensure `photos` Storage Bucket + RLS Policies
-- ============================================================================
-- Idempotent. Safe to run multiple times.
--
-- Creates the `photos` bucket (public read) if missing and (re)installs
-- storage.objects RLS policies allowing any authenticated user to upload
-- to and read from it.
--
-- Run in the Supabase Dashboard SQL Editor.
-- ============================================================================

-- 1. Create the bucket (public so unauthenticated reads also resolve the
--    public URL — uploads still require authentication via the policy below).
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;


-- 2. INSERT policy — any authenticated user can upload to `photos`.
DROP POLICY IF EXISTS "authenticated_upload_photos" ON storage.objects;

CREATE POLICY "authenticated_upload_photos" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
  );


-- 3. SELECT policy — any authenticated user can read from `photos`.
--    (The bucket is also public, so anonymous reads via the public URL work.)
DROP POLICY IF EXISTS "authenticated_read_photos" ON storage.objects;

CREATE POLICY "authenticated_read_photos" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
  );
