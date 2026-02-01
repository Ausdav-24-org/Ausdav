-- Create school_quiz_answers table to store individual question answers
create table if not exists public.school_quiz_answers (
  id bigserial primary key,
  school_name text not null,
  quiz_no integer not null default 1,
  language text not null default 'ta',
  -- Store answers as JSON for flexibility
  -- Each key is q1, q2, q3, etc. with value being a, b, c, d, or null (not answered)
  q1 text,
  q2 text,
  q3 text,
  q4 text,
  q5 text,
  q6 text,
  q7 text,
  q8 text,
  q9 text,
  q10 text,
  q11 text,
  q12 text,
  q13 text,
  q14 text,
  q15 text,
  q16 text,
  q17 text,
  q18 text,
  q19 text,
  q20 text,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS on school_quiz_answers (make it private)
alter table public.school_quiz_answers enable row level security;

-- Policy: Only authenticated admins can view answers
create policy "Only admins can view school quiz answers"
on public.school_quiz_answers
for select
to authenticated
using (
  exists (
    select 1 from public.members
    where members.auth_user_id = auth.uid()
    and members.role in ('admin', 'super_admin')
  )
);

-- Policy: Allow insert for public (quiz submissions)
create policy "Allow insert school quiz answers"
on public.school_quiz_answers
for insert
to public
with check (true);

-- Create indexes for better query performance
create index idx_school_quiz_answers_school_name on public.school_quiz_answers(school_name);
create index idx_school_quiz_answers_quiz_no on public.school_quiz_answers(quiz_no);
create index idx_school_quiz_answers_completed_at on public.school_quiz_answers(completed_at desc);
