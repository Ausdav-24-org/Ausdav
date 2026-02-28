-- allow storing participant answers for resume functionality
ALTER TABLE public.quiz_live_progress
  ADD COLUMN IF NOT EXISTS answers JSONB;

-- optional index for faster lookup by school/quiz
CREATE INDEX IF NOT EXISTS quiz_live_progress_school_quiz_idx
  ON public.quiz_live_progress (school_name, quiz_password_id);
