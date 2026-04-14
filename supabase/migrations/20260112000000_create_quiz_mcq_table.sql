-- Create quiz_mcq table for storing multiple choice questions
create table if not exists public.quiz_mcq (
  id bigserial primary key,
  question_text text not null,
  language text not null default 'ta',

  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,

  created_at timestamptz not null default now()
);

-- Add RLS policies
alter table public.quiz_mcq enable row level security;

-- Allow anyone to read quiz questions
create policy "Allow public read access to quiz_mcq"
  on public.quiz_mcq
  for select
  using (true);

-- Allow only authenticated users to insert (admin)
create policy "Allow authenticated users to insert quiz_mcq"
  on public.quiz_mcq
  for insert
  with check (auth.role() = 'authenticated');

-- Allow only authenticated users to update (admin)
create policy "Allow authenticated users to update quiz_mcq"
  on public.quiz_mcq
  for update
  using (auth.role() = 'authenticated');

-- Allow only authenticated users to delete (admin)
create policy "Allow authenticated users to delete quiz_mcq"
  on public.quiz_mcq
  for delete
  using (auth.role() = 'authenticated');
