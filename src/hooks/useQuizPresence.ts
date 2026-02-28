import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/*
 * ══════════════════════════════════════════════════════════════
 *  DATABASE-BACKED QUIZ LIVE PROGRESS TRACKING
 * ══════════════════════════════════════════════════════════════
 *
 *  Uses a `quiz_live_progress` table so the admin can see
 *  live participant state via postgres_changes (the same
 *  mechanism that already works for completed submissions).
 *
 *  ──── REQUIRED SQL (run once in Supabase SQL Editor) ────
 *
 *  CREATE TABLE public.quiz_live_progress (
 *    id            BIGSERIAL PRIMARY KEY,
 *    school_name   TEXT NOT NULL,
 *    quiz_password_id INTEGER NOT NULL,
 *    quiz_name     TEXT DEFAULT '',
 *    current_question_index INTEGER DEFAULT 0,
 *    total_questions INTEGER DEFAULT 0,
 *    answered_count INTEGER DEFAULT 0,
 *    started_at    TIMESTAMPTZ DEFAULT now(),
 *    updated_at    TIMESTAMPTZ DEFAULT now(),
 *    is_finished   BOOLEAN DEFAULT FALSE,
 *    UNIQUE(school_name, quiz_password_id)
 *  );
 *
 *  ALTER TABLE public.quiz_live_progress ENABLE ROW LEVEL SECURITY;
 *
 *  CREATE POLICY "Allow all on quiz_live_progress"
 *    ON public.quiz_live_progress FOR ALL
 *    USING (true) WITH CHECK (true);
 *
 *  ALTER PUBLICATION supabase_realtime
 *    ADD TABLE public.quiz_live_progress;
 *
 * ══════════════════════════════════════════════════════════════
 */

/**
 * Progress state for a single quiz participant.
 */
export interface QuizPresenceState {
  school_name: string;
  quiz_password_id: number;
  quiz_name?: string;
  current_question_index: number;
  total_questions: number;
  answered_count: number;
  answers?: any;          // optional JSON of answers for resume
  // new: live bonus/metrics that admin may want to view
  time_bonus?: number;    // remaining bonus or current bonus points
  extras?: any;           // arbitrary additional details (stored as JSONB)

  started_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  is_finished: boolean;
}

// How often tracker bumps `updated_at` so the admin knows it's alive (ms)
const HEARTBEAT_INTERVAL = 10_000;

// Entries with updated_at older than this are treated as stale (ms)
const STALE_THRESHOLD = 60_000;

// Debounce writes (ms) — prevents flooding DB on rapid question navigation
const WRITE_DEBOUNCE = 400;

// ──────────────────────────────────────────────
// 1) TRACKER — quiz-taker side
// ──────────────────────────────────────────────

/**
 * Writes quiz progress to the `quiz_live_progress` table.
 * Call `updatePresence(partial)` whenever quiz state changes.
 * Call `untrack()` when the quiz finishes.
 */
export function useQuizPresenceTracker(
  quizPasswordId: number | null,
  schoolName: string,
  enabled: boolean,
) {
  const stateRef = useRef<Partial<QuizPresenceState>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Flush current stateRef to database via UPSERT
  const flushToDb = useCallback(async () => {
    const s = stateRef.current;
    const name = s.school_name ? s.school_name.trim() : s.school_name;
    const qpId = s.quiz_password_id;
    if (!name || !qpId) return;

    try {
      const payload: any = {
        school_name: name,
        quiz_password_id: qpId,
        quiz_name: s.quiz_name ?? '',
        current_question_index: s.current_question_index ?? 0,
        total_questions: s.total_questions ?? 0,
        answered_count: s.answered_count ?? 0,
        started_at: s.started_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_finished: s.is_finished ?? false,
      };
      if (s.answers) payload.answers = s.answers;
      if (typeof s.time_bonus === 'number') payload.time_bonus = s.time_bonus;
      if (s.extras) payload.extras = s.extras;

      const { error } = await supabase
        .from('quiz_live_progress' as any)
        .upsert(payload, { onConflict: 'school_name,quiz_password_id' });
      if (error) console.warn('[QuizProgress] upsert error:', error.message);
    } catch (err) {
      console.warn('[QuizProgress] upsert exception:', err);
    }
  }, []);

  // Public API: merge payload and schedule a debounced DB write
  const updatePresence = useCallback(
    async (payload: Partial<QuizPresenceState>) => {
      stateRef.current = { ...stateRef.current, ...payload };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushToDb, WRITE_DEBOUNCE);
    },
    [flushToDb],
  );

  // Public API: mark finished immediately (no debounce)
  const untrack = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    stateRef.current = { ...stateRef.current, is_finished: true };
    await flushToDb();
  }, [flushToDb]);

  // When enabled turns on, seed stateRef with identity params so the heartbeat always has data
  useEffect(() => {
    if (!enabled) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    // Ensure identity fields are populated (critical after page refresh / session restore)
    if (quizPasswordId && !stateRef.current.quiz_password_id) {
      stateRef.current.quiz_password_id = quizPasswordId;
    }
    if (schoolName && !stateRef.current.school_name) {
      stateRef.current.school_name = schoolName.trim();
    }

    // Do NOT flush immediately; wait for first updatePresence caller so we
    // have a meaningful time_bonus value before inserting the row. This avoids
    // an initial 0 default that later overwrote a valid bonus on refresh.
    // flushToDb();

    heartbeatRef.current = setInterval(flushToDb, HEARTBEAT_INTERVAL);
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [enabled, quizPasswordId, schoolName, flushToDb]);

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { updatePresence, untrack };
}

// ──────────────────────────────────────────────
// 2) LISTENER — admin monitoring side
// ──────────────────────────────────────────────

/**
 * Reads from `quiz_live_progress` and subscribes to postgres_changes
 * so the admin sees real-time participant state.
 * Returns the same API shape as before for drop-in compatibility.
 */
export function useQuizPresenceListener(
  _quizPasswordIds: number[],
  enabled: boolean,
) {
  const [participants, setParticipants] = useState<
    Record<string, QuizPresenceState>
  >({});
  const [isConnected, setIsConnected] = useState(false);

  // Fetch all active (non-stale, non-finished) rows
  const fetchActive = useCallback(async () => {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD).toISOString();
    try {
      const { data, error } = await supabase
        .from('quiz_live_progress' as any)
        .select('*')
        .eq('is_finished', false)
        .gte('updated_at', cutoff);

      if (error) {
        console.warn('[QuizProgress] fetch error:', error.message);
        return;
      }
      if (data) {
        const map: Record<string, QuizPresenceState> = {};
        (data as any[]).forEach((row) => {
          const key = `${row.school_name}_${row.quiz_password_id}`;
          map[key] = {
            school_name: row.school_name,
            quiz_password_id: row.quiz_password_id,
            quiz_name: row.quiz_name ?? '',
            current_question_index: row.current_question_index ?? 0,
            total_questions: row.total_questions ?? 0,
            answered_count: row.answered_count ?? 0,
            time_bonus: row.time_bonus ?? 0,
            extras: row.extras ?? {},
            started_at: row.started_at ?? '',
            updated_at: row.updated_at ?? '',
            is_finished: false,
          };
        });
        setParticipants(map);
      }
    } catch (err) {
      console.warn('[QuizProgress] fetch exception:', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setParticipants({});
      return;
    }

    // Initial load
    fetchActive();

    // Listen for INSERT / UPDATE / DELETE via postgres_changes
    const channel = supabase
      .channel('quiz-live-progress-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_live_progress' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as any;
            if (old?.school_name && old?.quiz_password_id != null) {
              const key = `${old.school_name}_${old.quiz_password_id}`;
              setParticipants((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }
            return;
          }

          // INSERT or UPDATE
          const row = payload.new as any;
          if (!row?.school_name) return;
          const key = `${row.school_name}_${row.quiz_password_id}`;

          if (row.is_finished) {
            // Finished — remove from active map
            setParticipants((prev) => {
              if (!prev[key]) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
          } else {
            // Active — add / update
            setParticipants((prev) => ({
              ...prev,
              [key]: {
                school_name: row.school_name,
                quiz_password_id: row.quiz_password_id,
                quiz_name: row.quiz_name ?? '',
                current_question_index: row.current_question_index ?? 0,
                total_questions: row.total_questions ?? 0,
                answered_count: row.answered_count ?? 0,
                time_bonus: row.time_bonus ?? 0,
                extras: row.extras ?? {},
                started_at: row.started_at ?? '',
                updated_at: row.updated_at ?? '',
                is_finished: false,
              },
            }));
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true);
      });

    // Periodic full refresh every 30s to catch missed updates & prune stale
    const refreshInterval = setInterval(fetchActive, 30_000);

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [enabled, fetchActive]);

  return { participants, isConnected, refreshParticipants: fetchActive };
}
