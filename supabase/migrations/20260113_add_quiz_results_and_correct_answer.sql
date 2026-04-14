-- Add correct_answer column to quiz_mcq table
alter table public.quiz_mcq
add column if not exists correct_answer text check (correct_answer in ('a', 'b', 'c', 'd'));

-- Update existing rows to have a correct answer (you'll need to set these manually or via data migration)
-- Example: update public.quiz_mcq set correct_answer = 'a' where id = 1;

-- Create school_quiz_results table (private table)
create table if not exists public.school_quiz_results (
  id bigserial primary key,
  school_name text not null,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  not_answered integer not null default 0,
  final_score numeric(10, 2) not null default 0.00,
  language text not null default 'ta',
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS on school_quiz_results (make it private)
alter table public.school_quiz_results enable row level security;

-- Policy: Only authenticated users can view results (admin only)
-- You can modify this based on your requirements
create policy "Only admins can view school quiz results"
on public.school_quiz_results
for select
to authenticated
using (
  exists (
    select 1 from public.members
    where members.auth_user_id = auth.uid()
    and members.role in ('admin', 'super_admin')
  )
);

-- Policy: Allow insert for authenticated users (or public if needed)
-- This allows the quiz to save results
create policy "Allow insert school quiz results"
on public.school_quiz_results
for insert
to public
with check (true);

-- Create indexes for better query performance
create index idx_school_quiz_results_school_name on public.school_quiz_results(school_name);
create index idx_school_quiz_results_completed_at on public.school_quiz_results(completed_at desc);
create index idx_school_quiz_results_language on public.school_quiz_results(language);

-- Create a view for aggregated school performance (optional, for analytics)
create or replace view public.school_quiz_performance as
select 
  school_name,
  language,
  count(*) as total_attempts,
  avg(final_score) as avg_score,
  max(final_score) as best_score,
  min(final_score) as lowest_score,
  sum(correct_answers) as total_correct,
  sum(wrong_answers) as total_wrong,
  sum(not_answered) as total_not_answered
from public.school_quiz_results
group by school_name, language;

-- Enable RLS on the view
alter view public.school_quiz_performance set (security_invoker = on);

