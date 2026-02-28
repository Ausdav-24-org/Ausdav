-- Cache quiz questions server-side to reduce repeated DB reads
CREATE TABLE IF NOT EXISTS public.quiz_cache (
  quiz_password_id INTEGER PRIMARY KEY REFERENCES public.quiz_passwords(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Optional: index on expiration for pruning jobs
CREATE INDEX IF NOT EXISTS quiz_cache_expires_at_idx ON public.quiz_cache (expires_at);

-- RLS (service role bypasses; enable open policy to allow anon via function if needed)
ALTER TABLE public.quiz_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow cache access" ON public.quiz_cache
  FOR ALL USING (true) WITH CHECK (true);
