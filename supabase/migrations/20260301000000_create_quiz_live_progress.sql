-- Create quiz_live_progress table for real-time quiz participant monitoring
CREATE TABLE public.quiz_live_progress (
  id                    BIGSERIAL PRIMARY KEY,
  school_name           TEXT NOT NULL,
  quiz_password_id      INTEGER NOT NULL,
  quiz_name             TEXT DEFAULT '',
  current_question_index INTEGER DEFAULT 0,
  total_questions       INTEGER DEFAULT 0,
  answered_count        INTEGER DEFAULT 0,
  started_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  is_finished           BOOLEAN DEFAULT FALSE,
  UNIQUE(school_name, quiz_password_id)
);

-- Enable full replica identity for reliable Realtime UPDATE events
ALTER TABLE public.quiz_live_progress REPLICA IDENTITY FULL;

-- Enable RLS with open policy (quiz takers are anonymous)
ALTER TABLE public.quiz_live_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on quiz_live_progress"
  ON public.quiz_live_progress FOR ALL
  USING (true) WITH CHECK (true);

-- Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_live_progress;
