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

-- Enable RLS
alter table public.quiz_mcq enable row level security;

-- Create policy to allow reading quiz questions
create policy "Allow public read access to quiz_mcq"
on public.quiz_mcq
for select
to public
using (true);

-- Create indexes for better query performance
create index idx_quiz_mcq_language on public.quiz_mcq(language);
create index idx_quiz_mcq_created_at on public.quiz_mcq(created_at);
