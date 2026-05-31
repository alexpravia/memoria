-- Add emergency contact phone support for co-users
-- Safe to run in Supabase SQL Editor

ALTER TABLE co_users
ADD COLUMN IF NOT EXISTS phone text;
