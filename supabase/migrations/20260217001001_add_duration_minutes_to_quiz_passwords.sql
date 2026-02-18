-- Add duration_minutes column to quiz_passwords so admin can set quiz duration per password
BEGIN;

ALTER TABLE IF EXISTS public.quiz_passwords
  ADD COLUMN IF NOT EXISTS duration_minutes integer NULL;

COMMIT;
