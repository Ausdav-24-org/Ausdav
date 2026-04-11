import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  HelpCircle,
  Eye,
  EyeOff,
  List,
  Star,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { SchoolCombobox } from "@/components/ui/SchoolCombobox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuizQuestions } from "@/hooks/useQuizQuestions";
import { useQuizPresenceTracker } from "@/hooks/useQuizPresence";
import { supabase } from "@/integrations/supabase/client";
import { renderCyanTail } from "@/utils/text";
import BG1 from "@/assets/AboutUs/BG1.jpg";

// Markdown + KaTeX for rendering math equations in questions/options
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import PentathlonCard from "@/assets/Exam/pentathlon-card.jpg";
import PartyConfetti from "@/components/PartyConfetti";

// ✅ IMPORTANT: add router imports
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

type Option = {
  id: string;
  text: string;
};

type Question = {
  id: string;
  question: string; // Tamil
  options: Option[];
  correctOptionId: string;
  image_path?: string | null;
  [key: string]: any;
};

type AnswerState = {
  selectedOptionId: string | null; // null = not answered
  secondsTaken?: number;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const getOptionText = (question: Question, optId: string | null) => {
  if (!optId) return null;
  const opt = question.options.find((o) => o.id === optId);
  return opt?.text ?? null;
};

/**
 * ✅ ROUTE SETUP (React Router v6)
 *
 * In your routes file:
 *
 * <Route path="/quiz/:qNo" element={<QuizTamilMCQ />} />
 *
 * This component will use:
 * - URL param :qNo  (1-based question number)
 * - Query param ?school=YourSchoolName  (to restore session on refresh)
 *
 * Example URLs:
 * /quiz/1?school=ABC%20School
 * /quiz/2?school=ABC%20School
 */

const QuizTamilMCQ: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const params = useParams<{ qNo?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------- URL helpers ----------
  const urlQNo = useMemo(() => {
    const n = Number(params.qNo);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }, [params.qNo]);

  const urlSchool = useMemo(() => {
    return (searchParams.get("school") ?? "").trim();
  }, [searchParams]);

  // Track scroll position to prevent page jump on question change
  const lastScrollRef = useRef(0);

  // ✅ Updated: URL setter with preventScrollReset (no other change)
  const setUrl = (qNo: number, school: string, replace = false) => {
    const q = Math.max(1, qNo);
    const sp = new URLSearchParams(searchParams);
    if (school) sp.set("school", school);
    else sp.delete("school");

    setSearchParams(sp, { replace: true });

    // Remember current scroll so navigation does not jump to top
    lastScrollRef.current = window.scrollY;

    // ✅ prevent page jump to top/navbar when URL changes
    navigate(`/quiz/${q}?${sp.toString()}`, {
      replace,
      preventScrollReset: true as any, // safe even if router version ignores it
    } as any);
  };

  // ---------- School name and quiz start control ----------
  const [showSchoolDialog, setShowSchoolDialog] = useState(true);
  const [showSchoolInput, setShowSchoolInput] = useState(false);
  const [schoolName, setSchoolName] = useState(urlSchool || "");
  const [quizPassword, setQuizPassword] = useState("");
  const [quizPasswordId, setQuizPasswordId] = useState<number | null>(null); // Store quizPasswordId
  const [passwordIsTest, setPasswordIsTest] = useState(false);
  const [passwordIsQuiz, setPasswordIsQuiz] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [incorrectPassword, setIncorrectPassword] = useState(false);
  const [selectedQuizNo, setSelectedQuizNo] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [checkingAttempt, setCheckingAttempt] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [quizDurationSeconds, setQuizDurationSeconds] = useState(60); // dynamic quiz duration (seconds)
  const [canViewReview, setCanViewReview] = useState(false);
  const [restoringSession, setRestoringSession] = useState(false);

  // ---------- Quiz availability ----------
  const [isQuizEnabled, setIsQuizEnabled] = useState(false);
  const [loadingQuizStatus, setLoadingQuizStatus] = useState(true);


  const {
    questions: dbQuestions,
    loading: questionsLoading,
    error: questionsError,
  } = useQuizQuestions(language);

  // ---------- Session storage ----------
  const saveQuizSession = (
    currentIdx: number,
    savedAnswers: AnswerState[],
    startTime: number,
    // optional override so callers can persist an immediately-set questionStartTime
    overrideQuestionStartTime?: number | null,
    bonus?: number,
  ) => {
    const session: any = {
      schoolName,
      currentIndex: currentIdx,
      answers: savedAnswers,
      startTime: startTime,
      quizNo: selectedQuizNo,
      // persist password-based quiz info so refresh restores the same quiz
      quizPasswordId: quizPasswordId ?? null,
      quizDurationSeconds: quizDurationSeconds ?? null,
      quizStarted: quizStarted ?? false,
      // persist per-question visible start so time-bonus doesn't reset on refresh
      questionStartTime:
        typeof overrideQuestionStartTime === "number"
          ? overrideQuestionStartTime
          : questionStartTime ?? null,
      // store the current live bonus so reloads can restore exactly
      timeBonus:
        typeof bonus === "number" ? bonus : _bonusRemaining,
      savedAt: Date.now(),
    };
    localStorage.setItem(`quiz_session_${schoolName}`, JSON.stringify(session));
  };

  const getQuizSession = (school: string) => {
    const session = localStorage.getItem(`quiz_session_${school}`);
    return session ? JSON.parse(session) : null;
  };

  const clearQuizSession = (school: string) => {
    localStorage.removeItem(`quiz_session_${school}`);
  };

  // ✅ keep schoolName in URL query so refresh restores it
  useEffect(() => {
    if (!schoolName) return;
    const sp = new URLSearchParams(searchParams);
    if (sp.get("school") !== schoolName) {
      sp.set("school", schoolName);
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolName]);

  // ---------- Check quiz enabled ----------
  useEffect(() => {
    const checkQuizEnabled = async () => {
      try {
        setLoadingQuizStatus(true);
        const { data, error } = await supabase
          .from("app_settings")
          .select("allow_exam_applications")
          .single();

        if (error) throw error;
        setIsQuizEnabled(data?.allow_exam_applications || false);
      } catch (error) {
        console.error("Error checking quiz status:", error);
        setIsQuizEnabled(false);
      } finally {
        setLoadingQuizStatus(false);
      }
    };
    checkQuizEnabled();
  }, []);

  // ---------- Shuffle questions by school ----------
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const questionsToRender =
    quizStarted && quizQuestions.length > 0 ? quizQuestions : dbQuestions;

  // explicit per-client question stack (shuffled) used for quiz order
  const [questionStack, setQuestionStack] = useState<Question[]>([]);
  const activeQuestions = questionStack; // alias for readability

  // Set question stack when questions are ready
  // handleStartQuiz already handles shuffle order creation/loading for password quizzes
  // This effect just ensures activeQuestions is always in sync with questionsToRender
  useEffect(() => {
    if (questionsToRender.length > 0) {
      console.log(`✓ Setting question stack: ${questionsToRender.length} questions ready`);
      setQuestionStack(questionsToRender);
    }
  }, [questionsToRender]);

  // periodically refresh quizQuestions from server cache when password is known
  useEffect(() => {
    let timer: number | null = null;
    const refresh = async () => {
      if (!quizPasswordId) return;
      try {
        const { data: cacheRowRaw } = await supabase
          .from("quiz_cache" as any)
          .select("payload, expires_at")
          .eq("quiz_password_id", quizPasswordId)
          .maybeSingle();
        const cacheRow: any = cacheRowRaw;
        if (
          cacheRow?.payload &&
          cacheRow.expires_at &&
          new Date(cacheRow.expires_at) > new Date()
        ) {
          const payload = cacheRow.payload as any[];
          // convert to Question type
          const serverQs = payload.map((q: any) => ({
            id: q.id.toString(),
            question: q.question_text,
            options: [
              { id: "a", text: q.option_a },
              { id: "b", text: q.option_b },
              { id: "c", text: q.option_c },
              { id: "d", text: q.option_d },
            ],
            correctOptionId: q.correct_answer,
            image_path: q.image_path ?? null,
            imageUrl: q.image_path
              ? supabase.storage
                  .from("quiz-question-images")
                  .getPublicUrl(q.image_path).data.publicUrl
              : null,
          }));
          // replace local cache if different length or contents
          if (
            serverQs.length !== quizQuestions.length ||
            serverQs.some((sq, i) => sq.id !== quizQuestions[i]?.id)
          ) {
            setQuizQuestions(serverQs);
          }
        }
      } catch (e) {
        console.warn("failed to refresh server cache", e);
      }
    };
    refresh();
    timer = window.setInterval(refresh, 60_000);
    return () => {
      if (timer != null) clearInterval(timer);
    };
  }, [quizPasswordId, dbQuestions]);

  const totalQuestions = activeQuestions.length;

  // ✅ currentIndex is controlled by URL (:qNo is 1-based)
  const desiredIndexFromUrl = useMemo(() => {
    if (!totalQuestions) return 0;
    return clamp(urlQNo - 1, 0, totalQuestions - 1);
  }, [urlQNo, totalQuestions]);

  const [currentIndex, setCurrentIndex] = useState(desiredIndexFromUrl);

  // Answers array sized to question count
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    Array.from({ length: totalQuestions }, () => ({ selectedOptionId: null })),
  );

  const [isFinished, setIsFinished] = useState(false);

  // ---------- Presence tracking for admin live monitor ----------
  const { updatePresence, untrack: untrackPresence } = useQuizPresenceTracker(
    quizPasswordId,
    schoolName,
    quizStarted && !isFinished,
  );

  // After restoration completes, re-send presence so any bonus calculations
  // that relied on freshly-restored state are reflected in the database.
  useEffect(() => {
    if (!quizStarted || restoringSession || !schoolName || !quizPasswordId) return;
    if (
      typeof answers[currentIndex]?.secondsTaken !== "number" &&
      typeof questionStartTime !== "number"
    ) {
      return;
    }
    const extras = { question_times: answers.map((a) => a.secondsTaken ?? null) };
    // compute same bonus logic used elsewhere (live in case _bonusRemaining hasn't
    // been recomputed yet by React render when this effect runs)
    const BONUS_MAX = 60;
    const elapsedForBonus =
      answers[currentIndex]?.secondsTaken ??
      (questionStartTime ? Math.floor((Date.now() - questionStartTime) / 1000) : 0);
    const bonusVal = clamp(BONUS_MAX - elapsedForBonus, 0, BONUS_MAX);
    updatePresence({ time_bonus: bonusVal, extras });
  }, [restoringSession, quizStarted, schoolName, quizPasswordId, answers, currentIndex, questionStartTime, updatePresence]);

  // Toggle for question index panel (shows small card with question numbers)
  const [showQuestionPanel, setShowQuestionPanel] = useState(false);

  // Auto-hide timer for question index panel
  const questionPanelTimeoutRef = useRef<number | null>(null);

  const scheduleHideQuestionPanel = () => {
    if (questionPanelTimeoutRef.current !== null) {
      window.clearTimeout(questionPanelTimeoutRef.current);
    }
    questionPanelTimeoutRef.current = window.setTimeout(() => {
      setShowQuestionPanel(false);
      questionPanelTimeoutRef.current = null;
    }, 5000);
  };

  const openQuestionPanel = () => {
    setShowQuestionPanel(true);
    scheduleHideQuestionPanel();
  };

  const toggleQuestionPanel = () => {
    setShowQuestionPanel((prev) => {
      const next = !prev;
      if (next) {
        scheduleHideQuestionPanel();
      } else if (questionPanelTimeoutRef.current !== null) {
        window.clearTimeout(questionPanelTimeoutRef.current);
        questionPanelTimeoutRef.current = null;
      }
      return next;
    });
  };

  // Show the question panel briefly (5s) when quiz questions first load
  useEffect(() => {
    if (!quizStarted) return;
    if (totalQuestions <= 1) return;
    openQuestionPanel();
    return () => {
      if (questionPanelTimeoutRef.current !== null) {
        window.clearTimeout(questionPanelTimeoutRef.current);
        questionPanelTimeoutRef.current = null;
      }
    };
  }, [quizStarted, totalQuestions]);
  // Show a one-click warning when user presses Next without answering —
  // user must press Next again to confirm moving on (question marked unanswered)
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);

  // Resize answers only when the question *count* changes —
  // do NOT reset answers when `desiredIndexFromUrl` changes (prevents
  // wiping stored per-question timestamps when navigating between questions).
  useEffect(() => {
    if (restoringSession) return;
    setAnswers(
      Array.from({ length: totalQuestions }, () => ({
        selectedOptionId: null,
      })),
    );
    // currentIndex is updated from the URL in a separate effect; do not touch it here
    setIsFinished(false);
  }, [totalQuestions, restoringSession]);

  const currentQuestion = activeQuestions[currentIndex] as any;
  const currentAnswer = answers[currentIndex]?.selectedOptionId ?? null;

  // Reset per-question timer when the user navigates between questions (but DO NOT
  // overwrite a restored `questionStartTime` during session restore).
  // NOTE: depend only on `currentIndex` so toggling `restoringSession` does not
  // re-run this effect and accidentally clear a restored timestamp.
  useEffect(() => {
    if (restoringSession) return; // keep restored questionStartTime intact
    // clear the per-question start so the next effect can set a fresh timestamp
    setQuestionStartTime(null);
  }, [currentIndex]);

  // Start per-question timer when a question becomes visible. Do nothing if we're
  // restoring a session or if the question already has a recorded `secondsTaken` or
  // an existing `questionStartTime` (prevents override of restored value).
  useEffect(() => {
    if (!quizStartTime) return;
    if (restoringSession) return;
    if (typeof questionStartTime === "number") return; // already set (maybe restored)
    if (!answers[currentIndex]?.secondsTaken) {
      const ts = Date.now();
      setQuestionStartTime(ts);
      // persist immediately so a refresh RIGHT AFTER this will still have the timestamp
      if (schoolName) saveQuizSession(currentIndex, answers, quizStartTime ?? Date.now(), ts, _bonusRemaining);
    }
  }, [currentIndex, quizStartTime, restoringSession, answers, questionStartTime, schoolName]);

  // Start the overall quiz timer only when the first question card is visible to the user
  useEffect(() => {
    if (!quizStarted) return;
    if (quizStartTime) return; // already started (or restored)
    if (!currentQuestion) return; // wait until a question is rendered

    // mark quiz start at the moment the first question is shown
    setQuizStartTime(Date.now());
    // ensure displayed remaining time matches configured quiz duration
    setTimeRemaining(quizDurationSeconds);
  }, [quizStarted, quizStartTime, currentQuestion, quizDurationSeconds]);

  // Per-question bonus calculation — max 60 pts, single 60s window per question
  // If the user spends more than 60s on the question the bonus becomes zero and
  // cannot be re-earned by waiting (no cycling).
  const BONUS_MAX = 60;
  const _takenForBonus =
    answers[currentIndex]?.secondsTaken ??
    (questionStartTime ? Math.floor((Date.now() - questionStartTime) / 1000) : 0);
  // Bonus decreases linearly from 60 -> 0 across the first 60s; clamp to 0 afterwards
  const _bonusRemaining = clamp(BONUS_MAX - _takenForBonus, 0, BONUS_MAX);
  const bonusProgressPct = Math.round((_bonusRemaining / BONUS_MAX) * 100);
  const bonusTextColorClass = _bonusRemaining <= 10 ? "text-red-500" : _bonusRemaining <= 20 ? "text-yellow-600" : "text-green-600";
  // Battery-style: filled portion = colored (green/yellow/red), empty track = white
  const bonusIndicatorClassName = _bonusRemaining <= 10 ? "bg-red-500" : _bonusRemaining <= 20 ? "bg-yellow-400" : "bg-green-500";

  const isLast = currentIndex === totalQuestions - 1; 
  const hasQuestions = totalQuestions > 0;

  const hasCorrectAnswers = useMemo(
    () => activeQuestions.every((q) => Boolean(q.correctOptionId)),
    [activeQuestions],
  );

  // progressValue and visual progress bar removed per design request

  // ✅ When URL changes (refresh/back/forward), update currentIndex accordingly
  useEffect(() => {
    if (!hasQuestions) return;
    setCurrentIndex(desiredIndexFromUrl);
  }, [desiredIndexFromUrl, hasQuestions]);

  // Auto-hide the unanswered-warning when the user selects an answer or when
  // the question changes.
  useEffect(() => {
    if (showUnansweredWarning && currentAnswer !== null) setShowUnansweredWarning(false);
  }, [currentAnswer, showUnansweredWarning]);

  useEffect(() => {
    if (showUnansweredWarning) setShowUnansweredWarning(false);
  }, [currentIndex]);

  // Restore scroll position after question changes to avoid jumping to top
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: lastScrollRef.current, behavior: "auto" });
    });
  }, [currentIndex]);

  // ---------- Restore session if URL has school ----------
  useEffect(() => {
    if (!schoolName) return;

    const savedSession = getQuizSession(schoolName);
    if (!savedSession || savedSession.schoolName !== schoolName) return;

    (async () => {
      // --- 1) If the saved session was created from a password-based quiz, restore that specific quiz ---
      if (savedSession.quizPasswordId) {
        setRestoringSession(true);
        try {
          const pwdId = savedSession.quizPasswordId;
          let syncedBonus: number | null =
            typeof savedSession.timeBonus === "number"
              ? clamp(savedSession.timeBonus, 0, BONUS_MAX)
              : null;

          // fetch quiz password metadata (duration / mode)
          const { data: pwdData } = await supabase
            .from("quiz_passwords" as any)
            .select("id, duration_minutes, is_test, is_quiz")
            .eq("id", pwdId)
            .maybeSingle();

          // attempt to sync bonus from live progress row as well
          try {
            const { data: progRow } = await supabase
              .from('quiz_live_progress' as any)
              .select('time_bonus, current_question_index, answers, is_finished')
              .eq('school_name', schoolName.trim())
              .eq('quiz_password_id', pwdId)
              .maybeSingle() as any;
            if (progRow && !progRow.is_finished && typeof progRow.time_bonus === 'number') {
              // Prefer server bonus; but if server just got a transient 0 on refresh,
              // keep a higher local value so we don't incorrectly refill/drain bonus.
              const localBonus = typeof savedSession.timeBonus === 'number' ? savedSession.timeBonus : null;
              const serverBonus = progRow.time_bonus;
              const chosen =
                serverBonus === 0 && localBonus != null && localBonus > 0
                  ? localBonus
                  : serverBonus;
              syncedBonus = clamp(chosen, 0, BONUS_MAX);
              savedSession.timeBonus = syncedBonus;
              localStorage.setItem(`quiz_session_${schoolName}`, JSON.stringify(savedSession));
            }
          } catch (e) {
            console.warn('bonus sync fetch failed', e);
          }

          // fetch questions through server-side cache
          // (old edge function path removed; caching handled directly below)
          let questionsData: any[] = [];
          let cacheErr: any = null;
          try {
            const { data: cacheRowRaw, error } = await supabase
              .from("quiz_cache" as any)
              .select("payload, expires_at")
              .eq("quiz_password_id", pwdId)
              .maybeSingle();
            cacheErr = error;
            const cacheRow: any = cacheRowRaw;
            if (cacheErr) console.warn("cache select error", cacheErr);
            if (
              cacheRow?.payload &&
              cacheRow.expires_at &&
              new Date(cacheRow.expires_at) > new Date()
            ) {
              questionsData = cacheRow.payload as any[];
            }
          } catch (e) {
            console.warn("cache table fetch failed", e);
          }

          if (!questionsData || questionsData.length === 0) {
            const { data: fresh, error: qErr } = await supabase
              .from("quiz_mcq" as any)
              .select("id, quiz_password_id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_path")
              .eq("quiz_password_id", pwdId)
              .order("created_at", { ascending: true });
            if (qErr || !fresh || fresh.length === 0) {
              toast.error(
                language === "ta"
                  ? "இந்த வினாடிவினாவிற்கான கேள்விகள் இல்லை"
                  : "No questions found for this quiz",
              );
              return;
            }
            questionsData = fresh;
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            await supabase
              .from("quiz_cache" as any)
              .upsert({ quiz_password_id: pwdId, payload: questionsData, updated_at: new Date().toISOString(), expires_at: expiresAt });
          }

          if (cacheErr || !questionsData || !Array.isArray(questionsData) || questionsData.length === 0) {
            // nothing to restore
            clearQuizSession(schoolName);
            setRestoringSession(false);
            return;
          }

          // format questions (same structure as handleStartQuiz)
          const formattedQuestions = (questionsData as any[]).map((q: any) => ({
            id: q.id.toString(),
            question: q.question_text,
            options: [
              { id: "a", text: q.option_a },
              { id: "b", text: q.option_b },
              { id: "c", text: q.option_c },
              { id: "d", text: q.option_d },
            ],
            correctOptionId: q.correct_answer,
            image_path: q.image_path ?? null,
            imageUrl: q.image_path
              ? supabase.storage
                  .from("quiz-question-images")
                  .getPublicUrl(q.image_path).data.publicUrl
              : null,
          }));

          // apply persisted school-specific ordering if available
          let orderedQuestions: Question[] = formattedQuestions;
          try {
            const { data: orderRow } = await supabase
              .from('school_quiz_order' as any)
              .select('order_ids')
              .eq('school_name', schoolName)
              .eq('quiz_password_id', pwdId)
              .maybeSingle();
            if (orderRow && (orderRow as any).order_ids) {
              const idList: string[] = (orderRow as any).order_ids as string[];
              orderedQuestions = idList
                .map((id) => formattedQuestions.find((q) => q.id === id))
                .filter(Boolean) as Question[];
            }
          } catch (e) {
            console.warn('restore order fail', e);
          }


          setQuizQuestions(orderedQuestions);

          // determine configured duration (prefer savedSession if present)
          const durationFromPwd = (pwdData as any)?.duration_minutes && typeof (pwdData as any).duration_minutes === "number" && (pwdData as any).duration_minutes > 0
            ? (pwdData as any).duration_minutes * 60
            : undefined;
          const durationSeconds = savedSession.quizDurationSeconds ?? durationFromPwd ?? 60;

          const elapsed = typeof savedSession.startTime === "number"
            ? Math.floor((Date.now() - savedSession.startTime) / 1000)
            : Number.POSITIVE_INFINITY;
          const remaining = Math.max(0, durationSeconds - elapsed);

          // only restore if quiz hasn't expired yet
          if (elapsed < durationSeconds) {
            const restoredAnswers = Array.isArray(savedSession.answers)
              ? savedSession.answers
              : [];
            const targetIndex = clamp(
              savedSession.currentIndex ?? desiredIndexFromUrl,
              0,
              formattedQuestions.length - 1,
            );
            const restoredBonus =
              typeof restoredAnswers[targetIndex]?.secondsTaken === "number"
                ? clamp(BONUS_MAX - restoredAnswers[targetIndex].secondsTaken, 0, BONUS_MAX)
                : typeof savedSession.questionStartTime === "number"
                  ? clamp(
                      BONUS_MAX -
                        Math.floor((Date.now() - savedSession.questionStartTime) / 1000),
                      0,
                      BONUS_MAX,
                    )
                  : typeof syncedBonus === "number"
                    ? clamp(syncedBonus, 0, BONUS_MAX)
                    : BONUS_MAX;

            setShowSchoolDialog(false);
            setShowSchoolInput(false);
            setQuizStarted(true);
            setQuizStartTime(savedSession.startTime);
            // restore per-question visible start so bonus bar keeps its state
            if (typeof savedSession.questionStartTime === "number") {
              setQuestionStartTime(savedSession.questionStartTime);
            }
            // derive from restored state to avoid accidental refill on refresh
            setQuestionStartTime(Date.now() - (BONUS_MAX - restoredBonus) * 1000);
            setQuizPasswordId(pwdId);
            setPasswordIsTest(Boolean((pwdData as any)?.is_test));
            setPasswordIsQuiz(Boolean((pwdData as any)?.is_quiz));
            setQuizDurationSeconds(durationSeconds);
            setTimeRemaining(remaining);
            setCanViewReview(elapsed >= 60);

            // restore answers (validate length)
            setAnswers(
              restoredAnswers.length === formattedQuestions.length
                ? restoredAnswers
                : Array.from({ length: formattedQuestions.length }, () => ({ selectedOptionId: null })),
            );

            // ensure URL matches saved index (covers cases where URL lacked qNo)
            setUrl(targetIndex + 1, schoolName, true);
            setCurrentIndex(targetIndex);

            if (remaining === 0) {
              setIsFinished(true);
              setCanViewReview(true);
            } else {
              // Re-register with live progress tracker so admin sees this participant after page refresh
              const answeredCount = (Array.isArray(savedSession.answers) ? savedSession.answers : []).filter(
                (a: any) => a?.selectedOptionId !== null
              ).length;
              const extras = { question_times: (Array.isArray(savedSession.answers) ? savedSession.answers : []).map((a: any) => a?.secondsTaken ?? null) };
              // compute accurate bonus based on restored start time or recorded answer time
              const now = Date.now();
              let bonusForRestore = BONUS_MAX;
              if (Array.isArray(savedSession.answers) && savedSession.answers[targetIndex]?.secondsTaken != null) {
                const sec = savedSession.answers[targetIndex].secondsTaken;
                bonusForRestore = clamp(BONUS_MAX - sec, 0, BONUS_MAX);
              } else if (typeof savedSession.questionStartTime === 'number') {
                const elapsed = Math.floor((now - savedSession.questionStartTime) / 1000);
                bonusForRestore = clamp(BONUS_MAX - elapsed, 0, BONUS_MAX);
              }
              updatePresence({
                school_name: schoolName,
                quiz_password_id: pwdId,
                quiz_name: '',
                current_question_index: targetIndex,
                total_questions: formattedQuestions.length,
                answered_count: answeredCount,
                answers: savedSession.answers ?? [],
                time_bonus: restoredBonus,
                extras,
                started_at: savedSession.startTime
                  ? new Date(savedSession.startTime).toISOString()
                  : new Date().toISOString(),
                is_finished: false,
              });
            }

            toast.info(language === "ta" ? "வினாடிவினா மீட்டெடுக்கப்பட்டது" : "Quiz session restored");
          } else {
            clearQuizSession(schoolName);
          }

          setRestoringSession(false);
          return;
        } catch (err) {
          console.error("Error restoring password quiz session:", err);
          clearQuizSession(schoolName);
          setRestoringSession(false);
          return;
        }
      }

      // --- 2) fallback: existing restore logic for non-password (quizNo) sessions ---
      const restoredQuizNo = savedSession.quizNo ?? null;
      if (restoredQuizNo) setSelectedQuizNo(restoredQuizNo);

      const questionsForRestore = restoredQuizNo
        ? dbQuestions.filter((q: any) => (q?.quiz_no ?? 1) === restoredQuizNo)
        : dbQuestions;
      const restoreTotal = questionsForRestore.length;
      const targetIndex = clamp(
        savedSession.currentIndex ?? desiredIndexFromUrl,
        0,
        restoreTotal - 1,
      );
      // ensure URL matches saved index (covers cases where URL lacked qNo)
      setUrl(targetIndex + 1, schoolName, true);

      // prefer duration saved in session (if any), otherwise fall back to state value
      const sessionDuration = savedSession.quizDurationSeconds ?? quizDurationSeconds;
      const elapsed = typeof savedSession.startTime === "number" ? Math.floor((Date.now() - savedSession.startTime) / 1000) : Number.POSITIVE_INFINITY;
      const remainingTime = Math.max(0, sessionDuration - elapsed);

      // restore while quiz not expired; previously used a 120s hard cutoff — use configured duration instead
      if (elapsed < sessionDuration) {
        const restoredAnswers = Array.isArray(savedSession.answers)
          ? savedSession.answers
          : [];
        const restoredBonus =
          typeof restoredAnswers[targetIndex]?.secondsTaken === "number"
            ? clamp(BONUS_MAX - restoredAnswers[targetIndex].secondsTaken, 0, BONUS_MAX)
            : typeof savedSession.questionStartTime === "number"
              ? clamp(
                  BONUS_MAX -
                    Math.floor((Date.now() - savedSession.questionStartTime) / 1000),
                  0,
                  BONUS_MAX,
                )
              : typeof savedSession.timeBonus === "number"
                ? clamp(savedSession.timeBonus, 0, BONUS_MAX)
                : BONUS_MAX;

        setRestoringSession(true);
        setShowSchoolDialog(false);
        setShowSchoolInput(false);
        setQuizStarted(true);
        setQuizStartTime(savedSession.startTime);
        // restore per-question visible start so bonus bar keeps its state
        if (typeof savedSession.questionStartTime === "number") {
          setQuestionStartTime(savedSession.questionStartTime);
        }
        setQuestionStartTime(Date.now() - (BONUS_MAX - restoredBonus) * 1000);
        setQuizDurationSeconds(sessionDuration);
        setTimeRemaining(remainingTime);
        setCanViewReview(elapsed >= 60);

        // restore answers
        setAnswers(
          restoredAnswers.length === restoreTotal
            ? restoredAnswers
            : Array.from({ length: restoreTotal }, () => ({
                selectedOptionId: null,
              })),
        );
        // restore index from saved session fallback to URL-derived
        setCurrentIndex(targetIndex);

        if (remainingTime === 0) {
          setIsFinished(true);
          setCanViewReview(true);
        }

        toast.info(
          language === "ta"
            ? "வினாடிவினா மீட்டெடுக்கப்பட்டது"
            : "Quiz session restored",
        );
      } else {
        clearQuizSession(schoolName);
      }

      setRestoringSession(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbQuestions.length, schoolName]);

  // ---------- Timer countdown ----------
  useEffect(() => {
    if (!quizStarted || !quizStartTime) return;

    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
      const remaining = Math.max(0, quizDurationSeconds - elapsed);
      setTimeRemaining(remaining);

        // save every second so refresh returns to same URL question
      if (schoolName && !isFinished) {
        if (
          typeof answers[currentIndex]?.secondsTaken !== "number" &&
          typeof questionStartTime !== "number"
        ) {
          return;
        }
        const liveTakenForBonus =
          answers[currentIndex]?.secondsTaken ??
          (questionStartTime ? Math.floor((Date.now() - questionStartTime) / 1000) : 0);
        const liveBonus = clamp(BONUS_MAX - liveTakenForBonus, 0, BONUS_MAX);
        saveQuizSession(currentIndex, answers, quizStartTime, questionStartTime ?? null, liveBonus);
      }

      if (remaining === 0 && !isFinished) {
        setIsFinished(true);
        setCanViewReview(true);
        saveQuizResults();
        toast.info(language === "ta" ? "நேரம் முடிந்தது!" : "Time's up!");
      }

      if (elapsed >= quizDurationSeconds) setCanViewReview(true);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [
    quizStarted,
    quizStartTime,
    isFinished,
    quizDurationSeconds,
    language,
    currentIndex,
    answers,
    questionStartTime,
    schoolName,
  ]);

  // Persist current position immediately when it changes so refresh stays on the same question
  useEffect(() => {
    if (!quizStarted || !quizStartTime || !schoolName) return;
    saveQuizSession(currentIndex, answers, quizStartTime, questionStartTime ?? null, _bonusRemaining);
  }, [currentIndex, quizStarted, quizStartTime, schoolName, answers, questionStartTime]);

  // ---------- Select / clear option ----------
  // NOTE: selecting an option records the per-question elapsed time for *that selection*.
  // We overwrite `secondsTaken` on every selection so the UI shows the time-bonus for
  // the most recent selection. Clearing an answer removes the recorded `secondsTaken`
  // so the live per-question timer (based on `questionStartTime`) continues to run.
  const selectOption = (optionId: string) => {
    if (isFinished) return;
    // Per-question elapsed time (seconds since this question was shown)
    const elapsed = questionStartTime ? Math.floor((Date.now() - questionStartTime) / 1000) : 0;

    setAnswers((prev) => {
      const next = [...prev];
      // overwrite secondsTaken for this question each time the user selects an option
      next[currentIndex] = {
        selectedOptionId: optionId,
        secondsTaken: elapsed,
      };
      // Update presence with new answered count
      const answeredCount = next.filter((a) => a.selectedOptionId !== null).length;
      const extras = { question_times: next.map((a) => a.secondsTaken ?? null) };
      updatePresence({ answered_count: answeredCount, current_question_index: currentIndex, answers, time_bonus: _bonusRemaining, extras });
      return next;
    });
  };

  const clearSelection = () => {
    if (isFinished) return;
    setAnswers((prev) => {
      const next = [...prev];
      // Remove any recorded `secondsTaken` when the user clears their selection so
      // the live per-question timer continues to run and the time-bonus keeps decreasing.
      next[currentIndex] = {
        selectedOptionId: null,
        secondsTaken: undefined,
      };
      return next;
    });
  };

  // ---------- Result ----------
  const computeResult = () => {
    if (!hasCorrectAnswers)
      return { correct: 0, wrong: 0, notAnswered: 0, score: 0 };

    let correct = 0;
    let wrong = 0;
    let notAnswered = 0;
    let score = 0;

    activeQuestions.forEach((q, idx) => {
      const picked = answers[idx]?.selectedOptionId ?? null;
      // Assume each question has a startTime and answerTime in answers[idx] (if not, fallback to quizStartTime)
      // For now, use quizStartTime and timeRemaining for bonus calculation
      if (picked === null) {
        notAnswered += 1;
        // No points for not answered
      } else if (picked === q.correctOptionId) {
        correct += 1;
        // 100 points for correct
        score += 100;
        // Bonus: per-question time bonus = max(0, 60 - secondsTaken)
        // Use recorded per-question secondsTaken if available; otherwise no bonus
        let secondsTaken: number | null = null;
        if (typeof answers[idx]?.secondsTaken === 'number') secondsTaken = answers[idx].secondsTaken;
        const BONUS_CAP = 60;
        const bonus = secondsTaken == null ? 0 : Math.max(0, BONUS_CAP - secondsTaken);
        score += bonus;
      } else {
        wrong += 1;
        // -50 points for wrong
        score -= 50;
      }
    });

    return { correct, wrong, notAnswered, score };
  };

  const result = useMemo(() => computeResult(), [answers, activeQuestions]);

  // Helper: skip current question as unanswered and move forward
  const skipCurrentQuestion = () => {
    if (isFinished) return;
    if (currentAnswer !== null) return;

    // persist unanswered state defensively
    if (schoolName && quizStartTime) {
      saveQuizSession(
        currentIndex,
        answers,
        quizStartTime,
        questionStartTime ?? null,
        _bonusRemaining,
      );
    }

    setShowUnansweredWarning(false);

    if (!isLast) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setUrl(nextIndex + 1, schoolName, false);
      // update presence because we moved to next question without answering
      const answeredCount = answers.filter((a) => a.selectedOptionId !== null).length;
      const extras = { question_times: answers.map((a) => a.secondsTaken ?? null) };
      updatePresence({ current_question_index: nextIndex, answered_count: answeredCount, answers, time_bonus: _bonusRemaining, extras });
      return;
    }

    setIsFinished(true);
    setCanViewReview(true);
    // Mark as finished in presence and untrack
    const extrasFinish = { question_times: answers.map((a) => a.secondsTaken ?? null) };
    updatePresence({ is_finished: true, answers, time_bonus: _bonusRemaining, extras: extrasFinish });
    untrackPresence();
    saveQuizResults();
  };

  // ✅ Next: update URL so each question has different URL
  const goNext = () => {
    if (isFinished) return;

    // If unanswered, show a one-click warning first (do not navigate).
    if (currentAnswer === null) {
      if (!showUnansweredWarning) {
        setShowUnansweredWarning(true);
        return; // block first click
      }

      // If warning already shown (fallback path), treat as confirm skip
      skipCurrentQuestion();
      return;
    }

    if (!isLast) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      // push url
      setUrl(nextIndex + 1, schoolName, false);
      // Update presence with new question index
      const extras = { question_times: answers.map((a) => a.secondsTaken ?? null) };
      updatePresence({ current_question_index: nextIndex, answers, time_bonus: _bonusRemaining, extras });
      return;
    }

    setIsFinished(true);
    setCanViewReview(true);
    // Mark as finished in presence and untrack
    const extrasFinish2 = { question_times: answers.map((a) => a.secondsTaken ?? null) };
    updatePresence({ is_finished: true, answers, time_bonus: _bonusRemaining, extras: extrasFinish2 });
    untrackPresence();
    saveQuizResults();
  }; 

  const resetQuiz = () => {
    const schoolToReset = schoolName;

    setCurrentIndex(0);
    setAnswers(
      Array.from({ length: totalQuestions }, () => ({
        selectedOptionId: null,
      })),
    );
    setIsFinished(false);
    setShowSchoolDialog(true);
    setShowSchoolInput(false);
    setSchoolName("");
    setQuizPassword("");
    setShowPassword(false);
    setIncorrectPassword(false);
    setQuizStarted(false);
    setQuizStartTime(null);
    setTimeRemaining(60);
    setQuizDurationSeconds(60);
    setPasswordIsTest(false);
    setPasswordIsQuiz(false);
    setCanViewReview(false);
    setSelectedQuizNo(null);

    if (schoolToReset) clearQuizSession(schoolToReset);

    // reset URL back to /quiz/1 (no school)
    navigate("/quiz/1", { replace: true });
  };

  // ---------- Start quiz ----------
  const handleStartQuiz = async () => {
    if (!quizPassword.trim()) {
      toast.error(
        language === "ta" ? "கடவுச்சொல்லை உள்ளிடவும்" : "Please enter password",
      );
      return;
    }

    // show loading state while we check password / fetch questions
    setCheckingAttempt(true);
    try {
      // Check password in quiz_passwords table
      const { data: passwordData, error: passwordError } = await supabase
        .from("quiz_passwords" as any)
        .select("id, quiz_name, password, duration_minutes, is_test, is_quiz")
        .eq("password", quizPassword.trim())
        .maybeSingle();
      if (
        passwordError ||
        !passwordData ||
        typeof passwordData !== "object" ||
        passwordData === null ||
        typeof (passwordData as any).id !== "number"
      ) {
        toast.error(
          language === "ta" ? "தவறான கடவுச்சொல்" : "Incorrect password",
        );
        return;
      }

      // Fetch questions for quiz_password_id (matching AdminQuizPage logic)
      const passwordId = (passwordData as any).id;
      setQuizPasswordId(passwordId); // Store in state
      const isQuizMode = !!(passwordData as any).is_quiz;
      const isTestMode = !!(passwordData as any).is_test;
      setPasswordIsTest(isTestMode);
      setPasswordIsQuiz(isQuizMode);

      // In quiz mode, block duplicate school entries.  Normalize the school
      // name to guard against trivial variations in whitespace or case (which
      // would also be handled by the database constraint added below).
      if (isQuizMode && !isTestMode && schoolName) {
        const normalized = schoolName.trim();
        // update state / URL to the normalized value so later operations use it
        if (normalized !== schoolName) {
          setSchoolName(normalized);
          setUrl(currentIndex + 1, normalized, true);
        }
        const { data: existingAttempt } = await supabase
          .from("school_quiz_results" as any)
          .select("id")
          // Postgres text comparisons are case‑sensitive by default; use ilike
          // so "SCHOOL" and "school" count as the same.
          .ilike("school_name", normalized)
          .eq("quiz_password_id", passwordId)
          .maybeSingle();
        if (existingAttempt) {
          toast.error(
            language === "ta"
              ? "இந்த பள்ளி ஏற்கனவே இந்த வினாடிவினாவை முயற்சித்துள்ளது"
              : "This school has already attempted this quiz",
          );
          return;
        }
      }

      // attempt to preload progress for cross-device resume
      let preloadIdx: number | null = null;
      let preloadAnswers: any[] | null = null;
      if (schoolName) {
        const { data: prog } = await supabase
          .from('quiz_live_progress' as any)
          .select('current_question_index, answers, is_finished, time_bonus, extras')
          .eq('school_name', schoolName.trim())
          .eq('quiz_password_id', passwordId)
          .maybeSingle() as any;
        if (prog && !prog.is_finished) {
          if (typeof prog.current_question_index === 'number') preloadIdx = prog.current_question_index;
          if (Array.isArray(prog.answers)) preloadAnswers = prog.answers;
          // sync client bonus to server value by adjusting questionStartTime
          if (typeof prog.time_bonus === 'number') {
            const elapsed = BONUS_MAX - prog.time_bonus;
            setQuestionStartTime(Date.now() - elapsed * 1000);
          }
        }
      }

      // try server-side cache table first
      let questionsData: any[] = [];
      try {
        const { data: cacheRowRaw, error: cacheErr } = await supabase
          .from("quiz_cache" as any)
          .select("payload, expires_at")
          .eq("quiz_password_id", passwordId)
          .maybeSingle();
        const cacheRow: any = cacheRowRaw;
        if (cacheErr) console.warn("cache select error", cacheErr);
        if (
          cacheRow?.payload &&
          cacheRow.expires_at &&
          new Date(cacheRow.expires_at) > new Date()
        ) {
          questionsData = cacheRow.payload as any[];
        }
      } catch (e) {
        console.warn("cache table fetch failed", e);
      }

      if (!questionsData || questionsData.length === 0) {
        // fall back to fresh read from quiz_mcq
        const { data: fresh, error: qErr } = await supabase
          .from("quiz_mcq" as any)
          .select(
            "id, quiz_password_id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_path",
          )
          .eq("quiz_password_id", passwordId)
          .order("created_at", { ascending: true });
        if (qErr || !fresh || fresh.length === 0) {
          toast.error(
            language === "ta"
              ? "இந்த வினாடிவினாவிற்கான கேள்விகள் இல்லை"
              : "No questions found for this quiz",
          );
          return;
        }
        questionsData = fresh;

        // update cache row
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await supabase
          .from("quiz_cache" as any)
          .upsert({ quiz_password_id: passwordId, payload: questionsData, updated_at: new Date().toISOString(), expires_at: expiresAt });
      }

      // Format questions to match Question type
      const formattedQuestions: Question[] = questionsData.map((q: any) => ({
        id: q.id.toString(),
        question: q.question_text,
        options: [
          { id: "a", text: q.option_a },
          { id: "b", text: q.option_b },
          { id: "c", text: q.option_c },
          { id: "d", text: q.option_d },
        ],
        correctOptionId: q.correct_answer,
        image_path: q.image_path ?? null,
        imageUrl: q.image_path
          ? supabase.storage
              .from("quiz-question-images")
              .getPublicUrl(q.image_path).data.publicUrl
          : null,
      }));

      // --------- per-school order logic ---------
      // Only shuffle if in QUIZ mode. Test mode uses same order for all schools.
      let orderedQuestions: Question[] = formattedQuestions;
      if (isQuizMode) {
        try {
          const { data: orderRow } = await supabase
            .from('school_quiz_order' as any)
            .select('order_ids')
            .eq('school_name', schoolName)
            .eq('quiz_password_id', passwordId)
            .maybeSingle();

          if (orderRow && (orderRow as any).order_ids) {
            const idList: string[] = (orderRow as any).order_ids as string[];
            orderedQuestions = idList
              .map((id) => formattedQuestions.find((q) => q.id === id))
              .filter(Boolean) as Question[];
            console.log(`✓ Loaded existing shuffle for school: ${schoolName}`);
          } else {
            // generate new order and persist it
            const ids = formattedQuestions.map((q) => q.id);
            // simple Fisher-Yates shuffle seeded by school name
            const shuffledIds = [...ids];
            let random = schoolName
              .split('')
              .reduce((acc, c) => acc + c.charCodeAt(0), 0);
            const seededRandom = () => {
              random = (random * 9301 + 49297) % 233280;
              return random / 233280;
            };
            for (let i = shuffledIds.length - 1; i > 0; i--) {
              const j = Math.floor(seededRandom() * (i + 1));
              [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
            }
            await supabase.from('school_quiz_order' as any).insert({
              school_name: schoolName,
              quiz_password_id: passwordId,
              order_ids: shuffledIds,
            });
            orderedQuestions = shuffledIds
              .map((id) => formattedQuestions.find((q) => q.id === id))
              .filter((q): q is Question => !!q);
            console.log(`✓ Created new shuffle for school: ${schoolName} (${shuffledIds.length} questions)`);
          }
        } catch (e) {
          console.warn('could not load/save school order, falling back:', e);
        }
      } else {
        // Test mode: no shuffle, all schools get same question order
        console.log(`Test mode: using original question order (no shuffle)`);
      }

      setQuizQuestions(orderedQuestions);

      setQuizStarted(true);
      setShowSchoolDialog(false);
      setShowSchoolInput(false);
      // Do NOT start the quiz timer here — start when the first question card is visible to the user
      // Use duration from quiz_passwords if present (minutes -> seconds), otherwise fallback to 60s
      const durationMinutes = (passwordData as any).duration_minutes;
      const initialSeconds = (typeof durationMinutes === 'number' && durationMinutes > 0) ? durationMinutes * 60 : 60;
      setQuizDurationSeconds(initialSeconds);
      setTimeRemaining(initialSeconds);
      setCanViewReview(false);
      setCurrentIndex(0);
      let initialAnswers = Array.from({ length: formattedQuestions.length }, () => ({ selectedOptionId: null }));
      if (preloadAnswers && Array.isArray(preloadAnswers)) {
        // merge any preloaded answers (matching length)
        initialAnswers = preloadAnswers.length === formattedQuestions.length ? preloadAnswers : initialAnswers;
      }
      setAnswers(initialAnswers);
      // if we preloaded an index from another device, jump there
      if (preloadIdx !== null && preloadIdx >= 0 && preloadIdx < formattedQuestions.length) {
        setCurrentIndex(preloadIdx);
        setUrl(preloadIdx + 1, schoolName, false);
      }
      // persist session immediately so refresh during the landing -> first-question transition restores correctly
      if (schoolName) saveQuizSession(currentIndex, initialAnswers, Date.now(), undefined, _bonusRemaining);
      setSelectedQuizNo(null); // Not needed for this logic

      // Broadcast initial presence for admin live monitor (also include persisted answers)
      const extras = { question_times: (initialAnswers as any).map((a: any) => a.secondsTaken ?? null) };
      updatePresence({
        school_name: schoolName,
        quiz_password_id: passwordId,
        quiz_name: (passwordData as any).quiz_name ?? '',
        current_question_index: 0,
        total_questions: formattedQuestions.length,
        answered_count: 0,
        answers: initialAnswers,
        time_bonus: _bonusRemaining,
        extras,
        started_at: new Date().toISOString(),
        is_finished: false,
      });

      toast.success(
        language === "ta" ? "வினாடிவினா தொடங்குகிறது!" : "Quiz starting!",
      );
    } catch (err) {
      console.error("Error starting quiz:", err);
      toast.error(
        language === "ta"
          ? "வினாடிவினாவைத் தொடங்க முடியவில்லை"
          : "Failed to start quiz",
      );
    } finally {
      setCheckingAttempt(false);
    }
  };

  // ---------- Save results ----------
  const retryFetch = async <T,>(fn: () => PromiseLike<T> | Promise<T>, retries = 3, delay = 1500): Promise<T> => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
      }
    }
    throw new Error("Retry exhausted");
  };

  const saveQuizResults = async () => {
    // Type and null checks for all required fields
    // normalize/trimming school name before saving results (ensures
    // constraint works reliably)
    const cleanSchool = schoolName?.trim();
    if (!cleanSchool || typeof cleanSchool !== "string") {
      toast.error("School name missing or invalid.");
      return;
    }
    // use cleaned value below
    if (
      typeof totalQuestions !== "number" ||
      typeof result.correct !== "number" ||
      typeof result.wrong !== "number" ||
      typeof result.notAnswered !== "number" ||
      typeof result.score !== "number"
    ) {
      toast.error("Quiz result numbers missing or invalid.");
      return;
    }
    if (!language || typeof language !== "string") {
      toast.error("Language missing or invalid.");
      return;
    }
    if (!quizPasswordId || typeof quizPasswordId !== "number") {
      toast.error("Quiz password ID missing. Please restart the quiz.");
      return;
    }

    const insertObj: any = {
      school_name: cleanSchool,
      total_questions: totalQuestions,
      correct_answers: result.correct,
      wrong_answers: result.wrong,
      not_answered: result.notAnswered,
      final_score: result.score,
      language: language,
      quiz_password_id: quizPasswordId,
    };
    // Remove quiz_no if present (defensive)
    if ("quiz_no" in insertObj) delete insertObj.quiz_no;
    console.log("Inserting school_quiz_results:", insertObj);
    if (!quizPasswordId || typeof quizPasswordId !== "number") {
      toast.error("Quiz password ID missing. Please restart the quiz.");
      return;
    }
    try {
      // Save summary results (with retry for transient failures)
      const { error } = await retryFetch(() =>
        Promise.resolve(supabase.from("school_quiz_results").insert(insertObj))
      );

      if (error) {
        // Check if it's a unique constraint violation (duplicate attempt)
        if (error.code === "23505") {
          console.warn("Duplicate submission attempt:", error);
          toast.error(
            language === "ta"
              ? "இந்த பள்ளி ஏற்கனவே வினாடிவினாவை முயற்சித்துள்ளது"
              : "This school has already submitted the quiz",
          );
          clearQuizSession(schoolName);
          return;
        } else {
          console.error("Error saving quiz results:", error);
          toast.error(
            language === "ta"
              ? "முடிவுகளை சேமிக்க முடியவில்லை"
              : "Failed to save results",
          );
          return;
        }
      }

      // Save individual answers to school_quiz_answers table
      // Persist per-question selections in `choice_meta` (question-id -> selected option)
      // Keep `answers_meta` for per-question timing/bonus (used by admin/details views)
      const answersData: any = {
        school_name: schoolName,
        language: language,
        quiz_password_id: quizPasswordId,
      };

      // Build answers_meta (secondsTaken + bonus) for each question — keys use `quiz_mcq.id` as string
      const answersMeta: Record<string, { secondsTaken?: number | null; bonus?: number | null }> = {};
      const choiceMeta: Record<string, string | null> = {};

      // Map each answer to choice_meta using the question id; populate answers_meta keyed by question id
      answers.forEach((ans, index) => {
        const q = activeQuestions[index] as any;
        const qId = q?.id?.toString() ?? `${index + 1}`;
        choiceMeta[qId] = ans.selectedOptionId ?? null; // 'a'|'b'|'c'|'d'|null

        const seconds = typeof ans.secondsTaken === "number" ? ans.secondsTaken : null;
        // per-question bonus uses 60s cap (higher bonus for faster answers). store null if unknown
        const BONUS_CAP = 60;
        const bonus = seconds === null ? null : Math.max(0, BONUS_CAP - seconds);
        // store timing keyed by the question's DB id (string) for stability
        answersMeta[qId] = { secondsTaken: seconds, bonus };
      });

      // Attach choice_meta and answers_meta so admin/details can show user selections and timing later
      answersData.choice_meta = choiceMeta;
      answersData.answers_meta = answersMeta;

      console.log("Saving answers data:", answersData);

      const { error: answersError } = await retryFetch(() =>
        Promise.resolve(supabase.from("school_quiz_answers" as any).insert(answersData))
      );

      if (answersError) {
        console.error("Error saving individual answers:", answersError);
        // Don't show error to user since main results were saved
      } else {
        console.log("Individual answers saved successfully");
      }

      // Clear cached quiz questions on server so next attempt refetches fresh
      try {
        await supabase.functions.invoke("quiz-cache", {
          method: "DELETE",
          body: { quiz_password_id: quizPasswordId },
        });
      } catch (cacheDeleteErr) {
        console.warn("quiz-cache delete failed", cacheDeleteErr);
      }

      toast.success(
        language === "ta"
          ? "முடிவுகள் சேமிக்கப்பட்டன"
          : "Results saved successfully",
      );
      clearQuizSession(schoolName);
    } catch (error) {
      console.error("Error saving quiz results:", error);
      toast.error(
        language === "ta"
          ? "முடிவுகளை சேமிக்க முடியவில்லை"
          : "Failed to save results",
      );
    }
  };


  const displayedQuestion = useMemo(() => {
    if (!currentQuestion) return "";
    return currentQuestion.question;
  }, [currentQuestion]);

  const Watermark = () => (
    <div className="pointer-events-none select-none absolute inset-0 overflow-hidden rounded-xl">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
        <img
          src="/Watermark.png"
          alt="Watermark"
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero (hidden after quiz starts) */}
      {!quizStarted && (
        <section
          className="relative min-h-screen bg-cover bg-center flex items-center justify-center"
          style={{
            backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url('${BG1}')`,
            backgroundAttachment: "fixed",
          }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-full"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center z-10 px-4"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-cyan-400 text-sm font-semibold mb-4 uppercase tracking-widest"
              >
                ✦{" "}
                {language === "ta"
                  ? "1993 முதல் ஆற்றல் சேர்ப்பு"
                  : "Empowering Future Leaders Since 1993"}
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
              >
                {language === "ta" ? (
                  renderCyanTail("வினாடிவினா போட்டி")
                ) : (
                  <>
                    Penta<span className="text-cyan-400">thlon</span>
                  </>
                )}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto"
              >
                {language === "ta"
                  ? "உங்கள் அறிவை சோதித்து வெற்றி பெறுங்கள்"
                  : "Test your knowledge and win prizes"}
              </motion.p>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1"
            >
              <motion.div className="w-1.5 h-3 bg-primary rounded-full" />
            </motion.div>
          </motion.div>
        </section>
      )}

      {/* Quiz section */}
      <section className="relative py-16 md:py-24">
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Landing */}
            {showSchoolDialog && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >

                  <Card className="overflow-hidden relative z-0 rounded-2xl gradient-border card-effect-neon card-glass"
                    style={{
                      ["--edge-runner-color" as any]: "hsl(var(--electric-blue) / 1)",
                      ["--edge-runner-thickness" as any]: "1px",
                      ["--edge-runner-speed" as any]: "9s",
                      ["--edge-runner-glow" as any]: "1px",
                      ["--edge-runner-opacity" as any]: "0.95",
                      ["--border-glow" as any]: "18px",
                    }}
                  >
                    <CardContent className="p-0 relative overflow-visible">
                      {/* colored blurred accents behind content */}
                      <div className="glass-accent-blobs pointer-events-none" aria-hidden />
                      <div className="relative z-10 flex flex-col md:flex-row gap-2">
                        {/* Image on the left (stacks on small screens) */}
                        <div className="w-full md:w-1/2 overflow-hidden bg-black/10 rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none">
                          <img
                            src={PentathlonCard}
                            alt="Pentathlon card"
                            className="w-full h-44 md:h-full object-cover md:min-h-[220px] md:max-h-[360px] rounded-t-2xl md:rounded-l-2xl"
                          />
                        </div>

                        {/* Content on the right */}
                        <div className="px-4 py-4 md:py-6 flex-1 flex flex-col justify-center gap-3 rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none">
                          <div>
                            <h2 className="text-2xl md:text-3xl font-sans font-bold text-foreground">
                              Pentathlon 3.0
                            </h2>


                            {!showSchoolInput ? (
                              <p className="text-sm text-muted-foreground mt-4">
                                {language === "ta"
                                  ? "முன்னதாக குறிப்பிடப்பட்டுள்ள வினாடிவினா விதிமுறைகள் மற்றும் நெறிமுறைகளை கடுமையாகப் பின்பற்றவும், உங்கள் திறமைகளைப் பயன்படுத்தி இந்த வினாடிவினாவை எளிதாக்குங்கள்."
                                  : "Strictly follow the rules and regulations of the quiz as mentioned before, and use your skills to make this quiz easier."}
                              </p>
                            ) : null}

                            {showSchoolInput ? (
                              <p className="text-muted-foreground mt-2">
                                {language === "ta"
                                  ? "விண்ணப்ப படிவத்தை நிரப்பி நுழைவு தேர்விற்கு பதிவு செய்யுங்கள்"
                                  : "Enter your school name and the provided password to join the competition."}
                              </p>
                            ) : null}
                          </div>

                          {/* Start Quiz button (visible by default) */}
                          {!showSchoolInput ? (
                            <div className="flex justify-center md:justify-start">
                              {loadingQuizStatus ? (
                                <Button
                                  variant="donate"
                                  className="px-10"
                                  disabled
                                >
                                  {language === "ta"
                                    ? "ஏற்றுகிறது..."
                                    : "Loading..."}
                                </Button>
                              ) : !isQuizEnabled ? (
                                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 w-full text-center md:text-left">
                                  <p className="text-destructive font-semibold">
                                    {language === "ta"
                                      ? "வினாடிவினா போட்டி தற்போது மூடப்பட்டுள்ளது"
                                      : "Quiz Competition is Currently Closed"}
                                  </p>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => setShowSchoolInput(true)}
                                  variant="donate"
                                  className="px-10"
                                >
                                  {language === "ta"
                                    ? "Start Quiz"
                                    : "Start Quiz"}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex flex-col md:flex-row md:items-center md:gap-4">
                                <Label
                                  htmlFor="school-name"
                                  className="block text-sm font-semibold text-foreground mb-2 md:mb-0 md:w-40"
                                >
                                  {language === "ta"
                                    ? "பள்ளியின் பெயர்"
                                    : "School Name"}
                                </Label>

                                <div className="flex-1">
                                  <SchoolCombobox
                                    value={schoolName}
                                    onChange={setSchoolName}
                                    options={[
                                      "V/Vavuniya Tamil Madhya Maha Vidyalayam",
                                      "V/Rambaikulam Girls' Maha Vidyalayam",
                                      "V/Vipulanantha College",
                                      "V/Koomankulam Sithivinayakar Vidyalayam",
                                      "V/Saivapragasa ladies college",
                                      "V/ Vavuniya Hindu College",
                                      "V/Nelukkulam Kalaimagal Maha Vidyalayam",
                                      "V/Velikkulam Junior High Vidyalayam",
                                      "V/Kanagarayankulam Maha Vidyalayam",
                                      "V/Nochchimoddai Junior Secondary Vidyalayam",
                                      "V/Omanthai Central College",
                                      "V/Puliyankulam Hindu College",
                                      "V/Panrikkeithakulam Government Tamil Mixed School",
                                      "V/Puthukkulam Maha Vidyalayam",
                                      "V/Vavuniya Muslim Maha Vidyalayam",

                                    ]}
                                    placeholder={
                                      language === "ta"
                                        ? "பள்ளியைத் தேர்ந்தெடுக்கவும்"
                                        : "Select your school"
                                    }
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col md:flex-row md:items-center md:gap-4">
                                <Label
                                  htmlFor="quiz-password"
                                  className="block text-sm font-semibold text-foreground mb-2 md:mb-0 md:w-40"
                                >
                                  {language === "ta"
                                    ? "கடவுச்சொல்"
                                    : "Password"}
                                </Label>

                                <div className="flex-1 relative">
                                  <Input
                                    id="quiz-password"
                                    type={showPassword ? "text" : "password"}
                                    value={quizPassword}
                                    onChange={(e) => {
                                      setQuizPassword(e.target.value);
                                      setIncorrectPassword(false);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleStartQuiz();
                                    }}
                                    placeholder={
                                      language === "ta"
                                        ? "வினாடிவினா கடவுச்சொல்லை உள்ளீடு செய்யவும்"
                                        : "Enter quiz password"
                                    }
                                    className="pr-10"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none outline-none cursor-pointer p-0"
                                    aria-label={
                                      showPassword
                                        ? "Hide password"
                                        : "Show password"
                                    }
                                  >
                                    {showPassword ? (
                                      <EyeOff className="w-5 h-5" />
                                    ) : (
                                      <Eye className="w-5 h-5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {incorrectPassword && (
                                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                                  <p className="text-destructive text-sm font-semibold">
                                    {language === "ta"
                                      ? "தவறான கடவுச்சொல்"
                                      : "Incorrect password"}
                                  </p>
                                </div>
                              )}

                              <Button
                                onClick={handleStartQuiz}
                                variant="donate"
                                className="px-10 w-full"
                                disabled={checkingAttempt}
                              >
                                {checkingAttempt
                                  ? language === "ta"
                                    ? "சரிபார்க்கிறது..."
                                    : "Checking..."
                                  : language === "ta"
                                    ? "தொடரவும்"
                                    : "Continue"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
              </motion.div>
            )}

            {/* Quiz */}
            {quizStarted && (
              <div>
                {/* Centered skip-warning popup */}
                {showUnansweredWarning && !isFinished && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="max-w-md mx-4 rounded-xl bg-red-600 text-white shadow-2xl p-4 md:p-5 text-center space-y-3">
                      <h2 className="text-lg md:text-xl font-semibold">
                        {language === "ta"
                          ? "பதில் இல்லை எச்சரிக்கை"
                          : "Unanswered Question"}
                      </h2>
                        <p className="text-sm md:text-base">
                        {language === "ta"
                          ? "இந்த கேள்விக்கு நீங்கள் பதிலை தேர்ந்தெடுக்கவில்லை. மீண்டும் Skip அழுத்தினால், இது 'பதில் இல்லை' எனக் கணக்கிடப்படும்."
                          : "You haven't selected an answer for this question. If you press Skip, it will be marked as not answered."}
                        </p>
                        <p className="text-xs md:text-sm opacity-80">
                        {language === "ta"
                          ? "பதிலளிக்க விரும்பினால் மூடு பொத்தானை அழுத்தவும்"
                          : "Press the Close button if you want to answer this question."}
                      </p>

                      <div className="mt-3 flex justify-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white"
                          onClick={() => setShowUnansweredWarning(false)}
                        >
                          {language === "ta" ? "மூடு" : "Close"}
                        </Button>
                        <Button
                          type="button"
                          className="bg-white text-red-700 hover:bg-slate-100"
                          onClick={skipCurrentQuestion}
                        >
                          {language === "ta" ? "இந்த கேள்வியை தவிர்க்கவும்" : "Skip this question"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className={
                    ""
                  }
                >
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8 text-center"
                  >
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-2">
                      {language === "ta"
                        ? "ஆன்லைன் MCQ வினாடிவினா"
                        : "Online MCQ Quiz"}
                    </h1>
                  </motion.div>

                  {/* Per-question time-bonus (moved above question card) */}
                  {!isFinished && (
                  <div className="mb-8" aria-live="polite">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-foreground/70">Time bonus</div>

                      <div className="flex items-center gap-3">
                        <div className={`text-sm font-semibold ${bonusTextColorClass}`}>
                          +{_bonusRemaining} pts
                        </div>

                        {/* Toggle button to show question index panel (mobile) */}
                        {totalQuestions > 1 && (
                          <button
                            type="button"
                            aria-expanded={showQuestionPanel}
                            aria-label={showQuestionPanel ? 'Hide question index' : 'Show question index'}
                            onClick={toggleQuestionPanel}
                            className="p-1 rounded-md hover:bg-primary/5 active:scale-95 md:hidden"
                          >
                            <List className="w-4 h-4 text-foreground/70" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* progress value: percentage of remaining bonus */}
                    <Progress
                      value={bonusProgressPct}
                      className="h-2 rounded-full bg-white/10 border border-white/10"
                      indicatorClassName={bonusIndicatorClassName}
                    />

                    {/* Question index panel (non-overlapping, appears below progress on mobile) */}
                    {showQuestionPanel && totalQuestions > 1 && (
                      <div className="mt-3 md:hidden">
                        <div className="grid grid-cols-3 gap-2 py-1">
                          {Array.from({ length: totalQuestions }).map((_, i) => {
                            const isActive = i === currentIndex;
                            const isVisited = i <= currentIndex;
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled
                                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-medium border ${
                                  isActive
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : isVisited
                                    ? 'bg-primary/20 text-primary border-primary/20'
                                    : 'bg-card/20 text-foreground/60 border-transparent'
                                }`}
                                aria-current={isActive ? 'true' : undefined}
                                aria-disabled="true"
                              >
                                {i + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {questionsLoading ? (
                    <Card className="border-primary/20 shadow-lg mb-8">
                      <CardContent className="py-10 text-center">
                        <div className="text-sm text-foreground/70">
                          Loading questions...
                        </div>
                      </CardContent>
                    </Card>
                  ) : questionsError ? (
                    <Card className="border-primary/20 shadow-lg mb-8">
                      <CardContent className="py-10 text-center">
                        <div className="text-sm text-red-500">
                          {questionsError}
                        </div>
                      </CardContent>
                    </Card>
                  ) : !hasQuestions || !currentQuestion ? (
                    <Card className="border-primary/20 shadow-lg mb-8">
                      <CardContent className="py-10 text-center">
                        <div className="text-sm text-foreground/70">
                          No quiz questions available.
                        </div>
                      </CardContent>
                    </Card>
                  ) : !isFinished ? (
                    <motion.div
                      key={currentIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Floating right-side index toggle (desktop only) */}
                      {totalQuestions > 1 && (
                        <>
                          <button
                            onClick={toggleQuestionPanel}
                            aria-expanded={showQuestionPanel}
                            aria-label={showQuestionPanel ? 'Hide question index' : 'Show question index'}
                            className="hidden md:flex items-center justify-center fixed right-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg"
                          >
                            <List className="w-5 h-5" />
                          </button>

                          <div
                            className={`hidden md:block fixed right-14 top-1/2 -translate-y-1/2 z-30 w-auto max-w-[420px] p-3 bg-muted/90 border border-primary/10 rounded-lg shadow-lg transition-transform duration-200 ${showQuestionPanel ? 'translate-x-0' : 'translate-x-6 opacity-0 pointer-events-none'}`}
                          >

                            <div className="grid grid-cols-3 gap-2 py-1">
                              {Array.from({ length: totalQuestions }).map((_, i) => {
                                const isActive = i === currentIndex;
                                const isVisited = i <= currentIndex;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    disabled
                                    className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-medium border ${
                                      isActive
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : isVisited
                                        ? 'bg-primary/20 text-primary border-primary/20'
                                        : 'bg-card/20 text-foreground/60 border-transparent'
                                    }`}
                                    aria-current={isActive ? 'true' : undefined}
                                    aria-disabled="true"
                                  >
                                    {i + 1}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                      <Card
                        className="border-primary/20 shadow-lg mb-8 relative overflow-hidden select-none"
                        onCopy={(e) => { e.preventDefault(); }}
                        onContextMenu={(e) => { e.preventDefault(); }}
                        style={{ userSelect: "none", WebkitUserSelect: "none" }}
                      >
                        <Watermark />

                        <CardHeader className="border-b border-primary/10">
                          {/* Timer on its own first row */}
                          <div className="flex justify-end">
                            <div
                              className={`px-4 py-2 rounded-lg font-bold text-lg ${
                                timeRemaining <= 10
                                  ? "bg-red-500/20 text-red-500 animate-pulse"
                                  : timeRemaining <= 30
                                    ? "bg-yellow-500/20 text-yellow-600"
                                    : "bg-primary/20 text-primary"
                              }`}
                              aria-live="polite"
                            >
                              {Math.floor(timeRemaining / 60)}:
                              {(timeRemaining % 60).toString().padStart(2, "0")}
                            </div>
                          </div>

                          {/* Question row (starts on the next line) */}
                          <div className="flex gap-2 mt-2 items-start">
                            {/* fixed-width question number column so wrapped lines align */}
                            <div className="flex-shrink-0 w1-1031 text-2xl md:text-3xl font-bold text-foreground mt-4 text-right  select-none">
                              {currentIndex + 1}⟩
                            </div>

                            <div
                              className="flex-1 prose max-w-none text-2xl md:text-2.5xl font-medium text-foreground mt-4 leading-relaxed select-none whitespace-normal break-words"
                              style={{
                                userSelect: "none",
                                WebkitUserSelect: "none",
                              }}
                              onCopy={(e) => {
                                e.preventDefault();
                              }}
                            >
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {displayedQuestion}
                              </ReactMarkdown>
                            </div>

                            {/* Display question image in top right corner if exists */}
                            {currentQuestion?.imageUrl && (
                              <div className="flex-shrink md:flex-shrink-0 mt-2 md:mt-0">
                                <img
                                  src={currentQuestion.imageUrl}
                                  alt="Question image"
                                  className="w-28 h-20 sm:w-40 sm:h-32 md:w-52 md:h-40 rounded-lg object-contain border border-primary/20 bg-card/60 shadow-sm"
                                />
                              </div>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="pt-8">
                          <div className="space-y-4 mb-8">
                            {currentQuestion.options.map((opt, idx) => {
                              const checkedOpt = currentAnswer === opt.id;
                              return (
                                <motion.button
                                  key={opt.id}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => selectOption(opt.id)}
                                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 flex items-center gap-4 group select-none ${
                                    checkedOpt
                                      ? "border-primary bg-primary/10 shadow-lg"
                                      : "border-primary/20 bg-card hover:border-primary/40 hover:bg-primary/5"
                                  }`}
                                >
                                  <div
                                    className={`flex-shrink-0 w-10 h-10 rounded-lg font-bold flex items-center justify-center text-base md:text-lg transition-all ${
                                      checkedOpt
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-primary/20 text-primary group-hover:bg-primary/30"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + idx)}
                                  </div>
                                  <span className="text-foreground font-medium text-lg md:text-xl select-none prose max-w-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                      {opt.text}
                                    </ReactMarkdown>
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>

                          {/* progress bar removed — progressValue no longer used */}

                          <div className="flex justify-between items-center gap-4">
                            <Button
                              variant="outline"
                              onClick={clearSelection}
                              disabled={currentAnswer === null}
                              className="gap-2"
                            >
                              <RotateCcw className="w-4 h-4" />
                              {language === "ta" ? "நீக்கு" : "Clear"}
                            </Button>

                            <div className="flex-1 text-center">
                              {isLast ? (
                                <p className="text-sm text-foreground/70">
                                  {language === "ta" ? "கடைசி கேள்வி" : "Last"}
                                </p>
                              ) : (
                                <div />
                              )}
                            </div>

                            <Button
                              onClick={goNext}
                              className="gap-2 bg-primary hover:bg-primary/90"
                            >
                              {isLast
                                ? language === "ta"
                                  ? "முடிக்கவும்"
                                  : "Finish"
                                : language === "ta"
                                  ? "அடுத்தது →"
                                  : "Next →"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : passwordIsQuiz && !passwordIsTest ? (
                    <div className="relative">
                      <PartyConfetti active={true} count={40} />
                      <Card className="border-primary/20 shadow-xl mb-8 relative overflow-hidden">
                        <Watermark />
                        <CardContent className="pt-12 pb-12 text-center">
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          >
                            <div className="text-6xl mb-6">
                              🎉
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-cyan-400 to-primary/60 bg-clip-text text-transparent mb-4">
                              {language === "ta" ? "வாழ்த்துக்கள்!" : "Congratulations!"}
                            </h2>
                            <p className="text-lg md:text-xl text-foreground/80 max-w-md mx-auto mb-2">
                              {language === "ta"
                                ? "நீங்கள் போட்டியை வெற்றிகரமாக முடித்தீர்கள்"
                                : "You Successfully Finished the Competition"}
                            </p>
                            <p className="text-base text-foreground/60 max-w-sm mx-auto">
                              {language === "ta"
                                ? "முடிவுகளுக்காக காத்திருங்கள்"
                                : "Wait for the Results"}
                            </p>
                          </motion.div>

                          <div className="mt-8">
                            <Button
                              onClick={() => navigate('/', { replace: true })}
                              variant="outline"
                              className="px-6"
                            >
                              {language === "ta" ? "முகப்புக்கு" : "Back to Home"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card className="border-primary/20 shadow-xl mb-8 relative overflow-hidden">
                      <Watermark />
                      <CardHeader className="border-b border-primary/10 text-center">
                        <CardTitle className="text-3xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                          {language === "ta" ? "முடிவுகள்" : "Results"}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="pt-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                          {[
                            {
                              label: language === "ta" ? "மொத்த மதிப்பெண்" : "Score",
                              value: result.score,
                              icon: Star,
                              cls: "text-yellow-500",
                            },
                            {
                              label: language === "ta" ? "சரி" : "Correct",
                              value: result.correct,
                              icon: CheckCircle,
                              cls: "text-green-500",
                            },
                            {
                              label: language === "ta" ? "தவறு" : "Wrong",
                              value: result.wrong,
                              icon: XCircle,
                              cls: "text-red-500",
                            },
                            {
                              label:
                                language === "ta"
                                  ? "பதில் இல்லை"
                                  : "Not Answered",
                              value: result.notAnswered,
                              icon: HelpCircle,
                              cls: "text-yellow-500",
                            },
                          ].map((s, i) => {
                            const Icon = s.icon;
                            return (
                              <div
                                key={i}
                                className="rounded-xl p-4 border border-primary/20 bg-card"
                              >
                                <Icon
                                  className={`w-6 h-6 ${s.cls} mx-auto mb-2`}
                                />
                                <p className="text-2xl font-bold text-foreground text-center">
                                  {s.value}
                                </p>
                                <p className="text-xs text-foreground/60 text-center mt-1">
                                  {s.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {canViewReview && hasCorrectAnswers && (
                          <div className="border-t border-primary/10 pt-6">
                            <h3 className="text-lg font-bold mb-4">
                              {language === "ta" ? "விவரம்" : "Review"}
                            </h3>
                            <div className="space-y-3">
                              {activeQuestions.map((q, idx) => {
                                const picked =
                                  answers[idx]?.selectedOptionId ?? null;
                                const isCorrect =
                                  picked && picked === q.correctOptionId;
                                const pickedText = getOptionText(q, picked);
                                const correctText = getOptionText(
                                  q,
                                  q.correctOptionId,
                                );

                                return (
                                  <div
                                    key={q.id}
                                    className={`rounded-lg border p-4 ${
                                      picked === null
                                        ? "border-yellow-500/30 bg-yellow-500/5"
                                        : isCorrect
                                          ? "border-green-500/30 bg-green-500/5"
                                          : "border-red-500/30 bg-red-500/5"
                                    }`}
                                  >
                                    <div className="font-semibold">
                                      {idx + 1}. {q.question}
                                    </div>

                                    <div className="mt-2 space-y-1 text-sm text-foreground/80">
                                      {picked === null ? (
                                        <div className="text-yellow-600 font-medium">
                                          {language === "ta"
                                            ? "பதில் அளிக்கப்படவில்லை"
                                            : "Not answered"}
                                        </div>
                                      ) : isCorrect ? (
                                        <div className="text-green-600 font-medium">
                                          {language === "ta"
                                            ? "சரியான பதில்"
                                            : "Correct"}
                                        </div>
                                      ) : (
                                        <>
                                          <div className="text-red-600 font-medium">
                                            {language === "ta"
                                              ? "தவறான பதில்"
                                              : "Wrong answer"}
                                          </div>
                                          {pickedText && (
                                            <div>
                                              {language === "ta"
                                                ? "நீங்கள் தேர்ந்தெடுத்தது: "
                                                : "Your answer: "}
                                              <span className="font-semibold text-foreground">
                                                {pickedText}
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {correctText && (
                                        <div>
                                          {language === "ta"
                                            ? "சரியான பதில்: "
                                            : "Correct answer: "}
                                          <span className="font-semibold text-foreground">
                                            {correctText}
                                          </span>
                                        </div>
                                      )}

                                      {/* per-question scoring breakdown */}
                                      {(() => {
                                        // compute same way as computeResult
                                        let baseScore = 0;
                                        let bonusScore = 0;

                                        if (picked !== null) {
                                          if (picked === q.correctOptionId) {
                                            baseScore = 100;
                                            const secondsTaken =
                                              typeof answers[idx]?.secondsTaken === 'number'
                                                ? answers[idx]!
                                                    .secondsTaken!
                                                : null;
                                            const BONUS_CAP = 60;
                                            bonusScore =
                                              secondsTaken == null
                                                ? 0
                                                : Math.max(
                                                    0,
                                                    BONUS_CAP - secondsTaken,
                                                  );
                                          } else {
                                            // wrong answer gets penalty
                                            baseScore = -50;
                                            bonusScore = 0;
                                          }
                                        }

                                        const totalScore = baseScore + bonusScore;

                                        return (
                                          <div className="mt-2 text-sm text-foreground/80">
                                            <div className="flex flex-wrap gap-4 items-center">
                                              <span>
                                                {language === 'ta'
                                                  ? 'வினா மதிப்பெண்கள்:'
                                                  : 'Question points:'}{' '}
                                                <span className="font-semibold">
                                                  {baseScore}
                                                </span>
                                              </span>

                                              <span>
                                                {language === 'ta'
                                                  ? 'நேர போனஸ்:'
                                                  : 'Time bonus:'}{' '}
                                                <span className="font-semibold">
                                                  {bonusScore}
                                                </span>
                                              </span>

                                              <span>
                                                {language === 'ta'
                                                  ? 'மொத்தம்:'
                                                  : 'Total:'}{' '}
                                                <span className="font-semibold">
                                                  {totalScore}
                                                </span>
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="mt-6 flex justify-center">
                          <Button
                            onClick={() => navigate('/', { replace: true })}
                            variant="outline"
                            className="px-6"
                            aria-label={language === "ta" ? "முகப்புக்கு செல்ல" : "Go to home"}
                          >
                            {language === "ta" ? "முகப்புக்கு" : "Back to Home"}
                          </Button>
                        </div>

                        {/* Reset button removed per request */}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default QuizTamilMCQ;
