-- Add per-quiz mode flags to quiz_passwords so admin can mark a password as Test / Quiz
BEGIN;

ALTER TABLE IF EXISTS public.quiz_passwords
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.quiz_passwords
  ADD COLUMN IF NOT EXISTS is_quiz boolean NOT NULL DEFAULT false;

COMMIT;
