-- Prevent duplicate quiz mode entries by enforcing a case-insensitive
-- unique key on (school_name, quiz_password_id).  We use a unique index on
-- lower(school_name) so "ABC" and "abc" are treated identically.
--
-- If the simple constraint already exists (from a previous run), drop it first.
ALTER TABLE public.school_quiz_results
  DROP CONSTRAINT IF EXISTS uq_school_quiz_results_school_password;

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_quiz_results_school_password
  ON public.school_quiz_results (lower(school_name), quiz_password_id);

-- The client code already handles 23505 errors, but this server-side rule
-- guarantees duplicates are impossible regardless of whitespace/casing.
