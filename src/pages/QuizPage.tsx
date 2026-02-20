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
import { supabase } from "@/integrations/supabase/client";
import { renderCyanTail } from "@/utils/text";
import BG1 from "@/assets/AboutUs/BG1.jpg";
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

  // ---------- Anti-copy / anti-screenshot ----------
  const [copyAttempts, setCopyAttempts] = useState(0);
  const [compromised, setCompromised] = useState(false);
  const [privacyBlur, setPrivacyBlur] = useState(false);

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

  const activeQuestions = useMemo(() => {
    const filtered = selectedQuizNo
      ? questionsToRender.filter(
          (q: any) => (q?.quiz_no ?? 1) === selectedQuizNo,
        )
      : questionsToRender;

    if (!filtered.length || !schoolName) return filtered;

    const seed = schoolName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const shuffled = [...filtered];

    let random = seed;
    const seededRandom = () => {
      random = (random * 9301 + 49297) % 233280;
      return random / 233280;
    };

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }, [questionsToRender, schoolName, selectedQuizNo]);

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
  // Toggle for question index panel (shows small card with question numbers)
  const [showQuestionPanel, setShowQuestionPanel] = useState(false);
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
    setCompromised(false);
    setCopyAttempts(0);
    setPrivacyBlur(false);
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
      if (schoolName) saveQuizSession(currentIndex, answers, quizStartTime ?? Date.now(), ts);
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

          // fetch quiz password metadata (duration / mode)
          const { data: pwdData } = await supabase
            .from("quiz_passwords" as any)
            .select("id, duration_minutes, is_test, is_quiz")
            .eq("id", pwdId)
            .maybeSingle();

          // fetch only the questions for this quiz_password_id
          const { data: questionsData, error: questionsError } = await supabase
            .from("quiz_mcq" as any)
            .select("*")
            .eq("quiz_password_id", pwdId)
            .order("created_at", { ascending: true });

          if (questionsError || !questionsData || questionsData.length === 0) {
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

          setQuizQuestions(formattedQuestions);

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
            setShowSchoolDialog(false);
            setShowSchoolInput(false);
            setQuizStarted(true);
            setQuizStartTime(savedSession.startTime);
            // restore per-question visible start so bonus bar keeps its state
            if (typeof savedSession.questionStartTime === "number") {
              setQuestionStartTime(savedSession.questionStartTime);
            }
            setQuizPasswordId(pwdId);
            setPasswordIsTest(Boolean((pwdData as any)?.is_test));
            setPasswordIsQuiz(Boolean((pwdData as any)?.is_quiz));
            setQuizDurationSeconds(durationSeconds);
            setTimeRemaining(remaining);
            setCanViewReview(elapsed >= 60);

            // restore answers (validate length)
            const restoredAnswers = Array.isArray(savedSession.answers) ? savedSession.answers : [];
            setAnswers(
              restoredAnswers.length === formattedQuestions.length
                ? restoredAnswers
                : Array.from({ length: formattedQuestions.length }, () => ({ selectedOptionId: null })),
            );

            const targetIndex = clamp(
              savedSession.currentIndex ?? desiredIndexFromUrl,
              0,
              formattedQuestions.length - 1,
            );

            // ensure URL matches saved index (covers cases where URL lacked qNo)
            setUrl(targetIndex + 1, schoolName, true);
            setCurrentIndex(targetIndex);

            if (remaining === 0) {
              setIsFinished(true);
              setCanViewReview(true);
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
        setRestoringSession(true);
        setShowSchoolDialog(false);
        setShowSchoolInput(false);
        setQuizStarted(true);
        setQuizStartTime(savedSession.startTime);
        // restore per-question visible start so bonus bar keeps its state
        if (typeof savedSession.questionStartTime === "number") {
          setQuestionStartTime(savedSession.questionStartTime);
        }
        setQuizDurationSeconds(sessionDuration);
        setTimeRemaining(remainingTime);
        setCanViewReview(elapsed >= 60);

        // restore answers
        const restoredAnswers = Array.isArray(savedSession.answers)
          ? savedSession.answers
          : [];
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
        saveQuizSession(currentIndex, answers, quizStartTime, questionStartTime ?? null);
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
    language,
    currentIndex,
    answers,
    schoolName,
  ]);

  // Persist current position immediately when it changes so refresh stays on the same question
  useEffect(() => {
    if (!quizStarted || !quizStartTime || !schoolName) return;
    saveQuizSession(currentIndex, answers, quizStartTime, questionStartTime ?? null);
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

  // ✅ Next: update URL so each question has different URL
  const goNext = () => {
    if (isFinished) return;

    // If unanswered, show a one-click warning first (do not navigate).
    if (currentAnswer === null) {
      if (!showUnansweredWarning) {
        setShowUnansweredWarning(true);
        return; // block first click
      }

      // second click: persist unanswered state (defensive) and continue
      if (schoolName && quizStartTime) {
        saveQuizSession(currentIndex, answers, quizStartTime, questionStartTime ?? null);
      }
      // reset the warning so it doesn't linger on the next question
      setShowUnansweredWarning(false);
    }

    if (!isLast) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      // push url
      setUrl(nextIndex + 1, schoolName, false);
      return;
    }

    setIsFinished(true);
    setCanViewReview(true);
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
    setCompromised(false);
    setCopyAttempts(0);
    setPrivacyBlur(false);
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

      // In quiz mode, block duplicate school entries
      if (isQuizMode && !isTestMode && schoolName) {
        const { data: existingAttempt } = await supabase
          .from("school_quiz_results" as any)
          .select("id")
          .eq("school_name", schoolName.trim())
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

      const { data: questionsData, error: questionsError } = await supabase
        .from("quiz_mcq" as any)
        .select("*")
        .eq("quiz_password_id", passwordId);
      if (questionsError || !questionsData || questionsData.length === 0) {
        toast.error(
          language === "ta"
            ? "இந்த வினாடிவினாவிற்கான கேள்விகள் இல்லை"
            : "No questions found for this quiz",
        );
        return;
      }

      // Format questions to match Question type
      const formattedQuestions = questionsData.map((q: any) => ({
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

      setQuizQuestions(formattedQuestions);
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
      const initialAnswers = Array.from({ length: formattedQuestions.length }, () => ({ selectedOptionId: null }));
      setAnswers(initialAnswers);
      // persist session immediately so refresh during the landing -> first-question transition restores correctly
      if (schoolName) saveQuizSession(0, initialAnswers, Date.now());
      setSelectedQuizNo(null); // Not needed for this logic
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
    if (!schoolName || typeof schoolName !== "string") {
      toast.error("School name missing or invalid.");
      return;
    }
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
      school_name: schoolName,
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

  // ---------- Anti-copy ----------
  const punishCopyAttempt = () => {
    setCopyAttempts((n) => n + 1);
    setCompromised(true);
  };

  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      punishCopyAttempt();
    };

    const onCut = (e: ClipboardEvent) => {
      e.preventDefault();
      punishCopyAttempt();
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      punishCopyAttempt();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && ["c", "x", "a", "p", "s"].includes(key)) {
        e.preventDefault();
        punishCopyAttempt();
      }
      if (key === "printscreen" || (e as any).keyCode === 44) {
        e.preventDefault();
        setPrivacyBlur(true);
        punishCopyAttempt();
        toast.error(
          language === "ta"
            ? "ஸ்க்ரீன்ஷாட் அனுமதிக்கப்படவில்லை!"
            : "Screenshots are not allowed!",
        );
        setTimeout(() => setPrivacyBlur(false), 1000);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) setPrivacyBlur(true);
      else setPrivacyBlur(false);
    };

    const onWindowBlur = () => setPrivacyBlur(true);
    const onWindowFocus = () => setPrivacyBlur(false);

    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [language]);

  const displayedQuestion = useMemo(() => {
    if (!currentQuestion) return "";
    if (!compromised) return currentQuestion.question;
    return language === "ta"
      ? "⚠️ Copy முயற்சி காரணமாக கேள்வி மறைக்கப்பட்டது."
      : "⚠️ Question hidden due to copy attempt.";
  }, [compromised, currentQuestion, language]);

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
                                      "Vavuniya Tamil Madhya Maha Vidyalayam",
                                      "V/Rambaikkulam Girls Maha Vidyalayam",
                                      "Vipulanantha College Vavuniya",
                                      "Vavuniya Nelukkulam Kalaimakal Maha Vidyalayam",
                                      "Vavuniya Muslim Maha Vidyalayam",
                                      "Saivapragasa Ladies College",
                                      "Koomankulam Sithivinayakar Vidyalayam",
                                      "Vavuniya Hindu College",
                                      "Kanakarayankulam Maha Vidyalayam",
                                      "V/Puliyankulam Hindu college",
                                      "Nochchimoddai Junior Secondary Vidyalayam",
                                      "Omanthai Central College",
                                      "Panrikkeithakulam school in vavuniya",
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
                <div
                  className={
                    privacyBlur ? "blur-xl select-none pointer-events-none" : ""
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
                            onClick={() => setShowQuestionPanel((s) => !s)}
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
                      <div className="mt-3 p-3 bg-muted/30 border border-primary/10 rounded-lg md:hidden">

                        <div className="grid grid-cols-3 gap-2 py-1">
                          {Array.from({ length: totalQuestions }).map((_, i) => {
                            const isActive = i === currentIndex;
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled
                                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-medium border ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card/20 text-foreground/60 border-transparent'}`}
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
                            onClick={() => setShowQuestionPanel((s) => !s)}
                            aria-expanded={showQuestionPanel}
                            aria-label={showQuestionPanel ? 'Hide question index' : 'Show question index'}
                            className="hidden md:flex items-center justify-center fixed right-4 top-[15%] -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg"
                          >
                            <List className="w-5 h-5" />
                          </button>

                          <div
                            className={`hidden md:block fixed right-14 top-[20%] -translate-y-1/2 z-30 w-auto max-w-[420px] p-3 bg-muted/90 border border-primary/10 rounded-lg shadow-lg transition-transform duration-200 ${showQuestionPanel ? 'translate-x-0' : 'translate-x-6 opacity-0 pointer-events-none'}`}
                          >

                            <div className="grid grid-cols-3 gap-2 py-1">
                              {Array.from({ length: totalQuestions }).map((_, i) => {
                                const isActive = i === currentIndex;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    disabled
                                    className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-medium border ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card/20 text-foreground/60 border-transparent'}`}
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
                        onCopy={(e) => { e.preventDefault(); punishCopyAttempt(); }}
                        onContextMenu={(e) => { e.preventDefault(); punishCopyAttempt(); }}
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

                            <p
                              className="flex-1 text-2xl md:text-2.5xl font-medium text-foreground mt-4 leading-relaxed select-none whitespace-normal break-words"
                              style={{
                                userSelect: "none",
                                WebkitUserSelect: "none",
                              }}
                              onCopy={(e) => {
                                e.preventDefault();
                                punishCopyAttempt();
                              }}
                            >
                              {displayedQuestion}
                            </p>

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
                                  <span className="text-foreground font-medium text-lg md:text-xl select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
                                    {opt.text}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>

                          {/* progress bar removed — progressValue no longer used */}

                          {showUnansweredWarning && (
                            <p role="alert" className="w-full mb-2 text-sm text-red-500">
                              {language === "ta"
                                ? "இந்த கேள்விக்கு நீங்கள் பதிலை தேர்ந்தெடுக்கவில்லை. மீண்டும் Next அழுத்தவும்; இது 'பதில் இல்லை' எனக் கணக்கிடப்படும்."
                                : "You haven't selected an answer for this question. Click Next again to continue — this will be marked as unanswered."}
                            </p>
                          )}

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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                          {[
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
