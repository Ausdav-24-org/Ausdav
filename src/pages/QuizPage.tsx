import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  HelpCircle,
  Eye,
  EyeOff,
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
  const [showPassword, setShowPassword] = useState(false);
  const [incorrectPassword, setIncorrectPassword] = useState(false);
  const [selectedQuizNo, setSelectedQuizNo] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [checkingAttempt, setCheckingAttempt] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
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
  ) => {
    const session = {
      schoolName,
      currentIndex: currentIdx,
      answers: savedAnswers,
      startTime: startTime,
      quizNo: selectedQuizNo,
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

  // Resize answers when question count changes
  useEffect(() => {
    if (restoringSession) return;
    setAnswers(
      Array.from({ length: totalQuestions }, () => ({
        selectedOptionId: null,
      })),
    );
    setCurrentIndex(desiredIndexFromUrl);
    setIsFinished(false);
    setCompromised(false);
    setCopyAttempts(0);
    setPrivacyBlur(false);
  }, [totalQuestions, desiredIndexFromUrl, restoringSession]);

  const currentQuestion = activeQuestions[currentIndex] as any;
  const currentAnswer = answers[currentIndex]?.selectedOptionId ?? null;

  // Per-question bonus calculation used by progress and color logic
  const _takenForBonus =
    answers[currentIndex]?.secondsTaken ??
    (quizStartTime ? Math.floor((Date.now() - quizStartTime) / 1000) : 60 - timeRemaining);
  const _bonusRemaining = clamp(60 - (_takenForBonus ?? 0), 0, 60);
  const bonusProgressPct = Math.round((_bonusRemaining / 60) * 100);
  const bonusTextColorClass = _bonusRemaining <= 10 ? "text-red-500" : _bonusRemaining <= 30 ? "text-yellow-600" : "text-green-600";
  // Battery-style: filled portion = colored (green/yellow/red), empty track = white
  const bonusIndicatorClassName = _bonusRemaining <= 10 ? "bg-red-500" : _bonusRemaining <= 30 ? "bg-yellow-400" : "bg-green-500";

  const isLast = currentIndex === totalQuestions - 1; 
  const hasQuestions = totalQuestions > 0;

  const hasCorrectAnswers = useMemo(
    () => activeQuestions.every((q) => Boolean(q.correctOptionId)),
    [activeQuestions],
  );

  const progressValue = totalQuestions
    ? (Math.min(currentIndex + 1, totalQuestions) / totalQuestions) * 100
    : 0;

  // ✅ When URL changes (refresh/back/forward), update currentIndex accordingly
  useEffect(() => {
    if (!hasQuestions) return;
    setCurrentIndex(desiredIndexFromUrl);
  }, [desiredIndexFromUrl, hasQuestions]);

  // Restore scroll position after question changes to avoid jumping to top
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: lastScrollRef.current, behavior: "auto" });
    });
  }, [currentIndex]);

  // ---------- Restore session if URL has school ----------
  useEffect(() => {
    if (!dbQuestions.length) return;
    if (!schoolName) return;

    const savedSession = getQuizSession(schoolName);
    if (savedSession && savedSession.schoolName === schoolName) {
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

      const elapsed = Math.floor((Date.now() - savedSession.startTime) / 1000);
      const remainingTime = Math.max(0, 60 - elapsed);

      if (elapsed < 120) {
        setRestoringSession(true);
        setShowSchoolDialog(false);
        setShowSchoolInput(false);
        setQuizStarted(true);
        setQuizStartTime(savedSession.startTime);
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
    }
    setRestoringSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbQuestions.length, schoolName]);

  // ---------- Timer countdown ----------
  useEffect(() => {
    if (!quizStarted || !quizStartTime) return;

    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);

      // save every second so refresh returns to same URL question
      if (schoolName && !isFinished) {
        saveQuizSession(currentIndex, answers, quizStartTime);
      }

      if (remaining === 0 && !isFinished) {
        setIsFinished(true);
        setCanViewReview(true);
        saveQuizResults();
        toast.info(language === "ta" ? "நேரம் முடிந்தது!" : "Time's up!");
      }

      if (elapsed >= 60) setCanViewReview(true);
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
    saveQuizSession(currentIndex, answers, quizStartTime);
  }, [currentIndex, quizStarted, quizStartTime, schoolName, answers]);

  // ---------- Select / clear option ----------
  const selectOption = (optionId: string) => {
    if (isFinished) return;
    const elapsed = quizStartTime
      ? Math.floor((Date.now() - quizStartTime) / 1000)
      : Math.max(0, 60 - (timeRemaining ?? 0));

    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { selectedOptionId: optionId, secondsTaken: elapsed };
      return next;
    });
  };

  const clearSelection = () => {
    if (isFinished) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { selectedOptionId: null, secondsTaken: undefined };
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
        // Bonus: if answered within 60s, add (60 - seconds taken)
        // For now, estimate seconds taken as (60 - timeRemaining) if available
        // If you track answer time per question, use that instead
        let secondsTaken = 60;
        if (answers[idx]?.secondsTaken != null) {
          secondsTaken = answers[idx].secondsTaken;
        } else if (typeof timeRemaining === "number") {
          secondsTaken = 60 - timeRemaining;
        }
        let bonus = 60 - secondsTaken;
        if (bonus < 0) bonus = 0;
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
        .select("id, quiz_name, password")
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
      setQuizStartTime(Date.now());
      setTimeRemaining(60);
      setCanViewReview(false);
      setCurrentIndex(0);
      setAnswers(
        Array.from({ length: formattedQuestions.length }, () => ({
          selectedOptionId: null,
        })),
      );
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
      // Save summary results
      const { error } = await supabase
        .from("school_quiz_results")
        .insert(insertObj);

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
      // Map answers array to q1, q2, q3... columns
      const answersData: any = {
        school_name: schoolName,
        language: language,
        quiz_password_id: quizPasswordId, // Add quiz_password_id to answers
      };

      // Map each answer to its corresponding question column (q1, q2, q3, etc.)
      answers.forEach((ans, index) => {
        const columnName = `q${index + 1}`;
        answersData[columnName] = ans.selectedOptionId; // Will be 'a', 'b', 'c', 'd', or null
      });

      console.log("Saving answers data:", answersData);

      const { error: answersError } = await supabase
        .from("school_quiz_answers" as any)
        .insert(answersData);

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
                    Quiz <span className="text-cyan-400">Competition</span>
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
                      <div className="relative z-10 flex flex-col gap-2">
                        {/* Full-width image at top of the card */}
                        <div className="w-full overflow-hidden rounded-t-2xl bg-black/10">
                          <img
                            src={BG1}
                            alt="Pentathlon banner"
                            className="w-full h-44 md:h-56 object-cover rounded-t-2xl"
                          />
                        </div>

                        <div className="px-4 py-3 md:py-4 flex flex-col justify-center gap-3">
                          <div>
                            <h2 className="text-2xl md:text-3xl font-sans font-bold text-foreground">
                              Pentathlon 2026
                            </h2>
                            <p className="text-muted-foreground mt-2">
                              {language === "ta"
                                ? "விண்ணப்ப படிவத்தை நிரப்பி நுழைவு தேர்விற்கு பதிவு செய்யுங்கள்"
                                : "Enter your school name and the provided password to join the competition."}
                            </p>
                          </div>

                          {/* Start Quiz button (visible by default below image) */}
                          {!showSchoolInput ? (
                            <div className="flex justify-center">
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
                                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 w-full text-center">
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

                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-foreground/70">
                        {language === "ta" ? "முன்னேற்றம்" : "Progress"}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {Math.min(currentIndex + 1, totalQuestions)}/
                        {totalQuestions}
                      </span>
                    </div>
                    <Progress value={progressValue} className="h-2" />
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
                      <Card
                        className="border-primary/20 shadow-lg mb-8 relative overflow-hidden select-none"
                        onCopy={(e) => { e.preventDefault(); punishCopyAttempt(); }}
                        onContextMenu={(e) => { e.preventDefault(); punishCopyAttempt(); }}
                        style={{ userSelect: "none", WebkitUserSelect: "none" }}
                      >
                        <Watermark />

                        <div className="absolute top-4 right-4 z-10">
                          <div
                            className={`px-4 py-2 rounded-lg font-bold text-lg ${
                              timeRemaining <= 10
                                ? "bg-red-500/20 text-red-500 animate-pulse"
                                : timeRemaining <= 30
                                  ? "bg-yellow-500/20 text-yellow-600"
                                  : "bg-primary/20 text-primary"
                            }`}
                          >
                            {Math.floor(timeRemaining / 60)}:
                            {(timeRemaining % 60).toString().padStart(2, "0")}
                          </div>
                        </div>

                        <CardHeader className="border-b border-primary/10">
                          <div className="flex gap-4">
                            <p
                              className="flex-1 text-lg font-medium text-foreground mt-4 leading-relaxed select-none"
                              style={{
                                userSelect: "none",
                                WebkitUserSelect: "none",
                              }}
                              onCopy={(e) => {
                                e.preventDefault();
                                punishCopyAttempt();
                              }}
                            >
                              <span className="font-bold">
                                {currentIndex + 1}.{" "}
                              </span>
                              {displayedQuestion}
                            </p>

                            {/* Display question image in top right corner if exists */}
                            {currentQuestion?.imageUrl && (
                              <div className="flex-shrink-0 mt-2 md:mt-0">
                                <img
                                  src={currentQuestion.imageUrl}
                                  alt="Question image"
                                  className="w-40 h-32 md:w-52 md:h-40 rounded-lg object-contain border border-primary/20 bg-card/60 shadow-sm"
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
                                    className={`flex-shrink-0 w-10 h-10 rounded-lg font-bold flex items-center justify-center text-sm transition-all ${
                                      checkedOpt
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-primary/20 text-primary group-hover:bg-primary/30"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + idx)}
                                  </div>
                                  <span className="text-foreground font-medium select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
                                    {opt.text}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>

                          {/* Per-question time-bonus progress (below all answers) */}
                          <div className="mb-4 mt-2" aria-live="polite">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm text-foreground/70">Time bonus</div>
                              <div className={`text-sm font-semibold ${bonusTextColorClass}`}>
                                +{_bonusRemaining} pts
                              </div>
                            </div>

                            {/* progress value: percentage of remaining bonus */}
                            <Progress
                              value={bonusProgressPct}
                              className="h-2 rounded-full bg-white/10 border border-white/10"
                              indicatorClassName={bonusIndicatorClassName}
                            />
                          </div>

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
                              <p className="text-sm text-foreground/70">
                                {isLast
                                  ? language === "ta"
                                    ? "கடைசி கேள்வி"
                                    : "Last"
                                  : language === "ta"
                                    ? "தொடர்க"
                                    : "Continue"}
                              </p>
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
