-- Add answers_meta column to school_quiz_answers to store per-question secondsTaken/bonus
alter table if exists public.school_quiz_answers
  add column if not exists answers_meta jsonb;

-- Add a GIN index for queries that may inspect answers_meta
create index if not exists idx_school_quiz_answers_answers_meta_gin on public.school_quiz_answers using gin (answers_meta);
