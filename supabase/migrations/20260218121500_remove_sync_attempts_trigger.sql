-- Remove broken trigger/function that references non-existent school_quiz_question_attempts column
-- This migration is safe and idempotent: it only drops the trigger and function if they exist.

begin;

-- Drop trigger on school_quiz_answers if present
drop trigger if exists trg_sync_school_quiz_answers_to_attempts on public.school_quiz_answers;

-- Drop the trigger function if present
drop function if exists public.fn_sync_school_quiz_answers_to_attempts() cascade;

commit;
