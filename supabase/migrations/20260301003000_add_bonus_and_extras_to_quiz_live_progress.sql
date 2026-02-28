-- Add time_bonus integer and extras JSONB to quiz_live_progress
ALTER TABLE public.quiz_live_progress
  ADD COLUMN IF NOT EXISTS time_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}'::jsonb;

-- index on time_bonus may help sorting/filtering in admin UI
CREATE INDEX IF NOT EXISTS quiz_live_progress_time_bonus_idx
  ON public.quiz_live_progress (time_bonus);
