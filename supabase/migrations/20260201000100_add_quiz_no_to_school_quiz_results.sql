-- Add quiz_no column to school_quiz_results table
alter table public.school_quiz_results
add column if not exists quiz_no integer not null default 1;

-- Create index on quiz_no
create index if not exists idx_school_quiz_results_quiz_no on public.school_quiz_results(quiz_no);
