import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { RotateCcw, CheckCircle, XCircle, HelpCircle, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

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

  const { questions: dbQuestions, loading: questionsLoading, error: questionsError } =
    useQuizQuestions(language);

  // ---------- Session storage ----------
  const saveQuizSession = (currentIdx: number, savedAnswers: AnswerState[], startTime: number) => {
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
  const activeQuestions = useMemo(() => {
    const filtered = selectedQuizNo
      ? dbQuestions.filter((q: any) => (q?.quiz_no ?? 1) === selectedQuizNo)
      : dbQuestions;

    if (!filtered.length || !schoolName) return filtered;

    const seed = schoolName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
  }, [dbQuestions, schoolName, selectedQuizNo]);

  const totalQuestions = activeQuestions.length;

  // ✅ currentIndex is controlled by URL (:qNo is 1-based)
  const desiredIndexFromUrl = useMemo(() => {
    if (!totalQuestions) return 0;
    return clamp(urlQNo - 1, 0, totalQuestions - 1);
  }, [urlQNo, totalQuestions]);

  const [currentIndex, setCurrentIndex] = useState(desiredIndexFromUrl);

  // Answers array sized to question count
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    Array.from({ length: totalQuestions }, () => ({ selectedOptionId: null }))
  );

  const [isFinished, setIsFinished] = useState(false);

  // Resize answers when question count changes
  useEffect(() => {
    if (restoringSession) return;
    setAnswers(Array.from({ length: totalQuestions }, () => ({ selectedOptionId: null })));
    setCurrentIndex(desiredIndexFromUrl);
    setIsFinished(false);
    setCompromised(false);
    setCopyAttempts(0);
    setPrivacyBlur(false);
  }, [totalQuestions, desiredIndexFromUrl, restoringSession]);

  const currentQuestion = activeQuestions[currentIndex] as any;
  const currentAnswer = answers[currentIndex]?.selectedOptionId ?? null;

  const isLast = currentIndex === totalQuestions - 1;
  const hasQuestions = totalQuestions > 0;

  const hasCorrectAnswers = useMemo(
    () => activeQuestions.every((q) => Boolean(q.correctOptionId)),
    [activeQuestions]
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
      const targetIndex = clamp(savedSession.currentIndex ?? desiredIndexFromUrl, 0, restoreTotal - 1);
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
        const restoredAnswers = Array.isArray(savedSession.answers) ? savedSession.answers : [];
        setAnswers(
          restoredAnswers.length === restoreTotal
            ? restoredAnswers
            : Array.from({ length: restoreTotal }, () => ({ selectedOptionId: null }))
        );
        // restore index from saved session fallback to URL-derived
        setCurrentIndex(targetIndex);

        if (remainingTime === 0) {
          setIsFinished(true);
          setCanViewReview(true);
        }

        toast.info(language === "ta" ? "வினாடிவினா மீட்டெடுக்கப்பட்டது" : "Quiz session restored");
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
  }, [quizStarted, quizStartTime, isFinished, language, currentIndex, answers, schoolName]);

  // Persist current position immediately when it changes so refresh stays on the same question
  useEffect(() => {
    if (!quizStarted || !quizStartTime || !schoolName) return;
    saveQuizSession(currentIndex, answers, quizStartTime);
  }, [currentIndex, quizStarted, quizStartTime, schoolName, answers]);

  // ---------- Select / clear option ----------
  const selectOption = (optionId: string) => {
    if (isFinished) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { selectedOptionId: optionId };
      return next;
    });
  };

  const clearSelection = () => {
    if (isFinished) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { selectedOptionId: null };
      return next;
    });
  };

  // ---------- Result ----------
  const computeResult = () => {
    if (!hasCorrectAnswers) return { correct: 0, wrong: 0, notAnswered: 0, score: 0 };

    let correct = 0;
    let wrong = 0;
    let notAnswered = 0;

    activeQuestions.forEach((q, idx) => {
      const picked = answers[idx]?.selectedOptionId ?? null;
      if (picked === null) notAnswered += 1;
      else if (picked === q.correctOptionId) correct += 1;
      else wrong += 1;
    });

    // Scoring: +2 for correct, -1 for wrong, 0 for not answered
    const score = correct * 2 + wrong * -1 + notAnswered * 0;
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
    setAnswers(Array.from({ length: totalQuestions }, () => ({ selectedOptionId: null })));
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
    // Prevent multiple clicks
    if (checkingAttempt) {
      return;
    }

    if (!schoolName.trim()) {
      toast.error(language === "ta" ? "பள்ளியின் பெயரை உள்ளிடவும்" : "Please enter school name");
      return;
    }

    if (!quizPassword.trim()) {
      toast.error(language === "ta" ? "கடவுச்சொல்லை உள்ளிடவும்" : "Please enter password");
      return;
    }

    setCheckingAttempt(true);
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from("app_settings" as any)
        .select("quiz_password_1, quiz_password_2, quiz_password")
        .single();

      if (settingsError) throw settingsError;

      const inputPwd = quizPassword.trim();
      const settings = settingsData as {
        quiz_password_1?: string | null;
        quiz_password_2?: string | null;
        quiz_password?: string | null;
      };
      const pwd1 = settings?.quiz_password_1 || "";
      const pwd2 = settings?.quiz_password_2 || "";
      const legacyPwd = settings?.quiz_password || "";

      const match1 = pwd1 && inputPwd === pwd1.trim();
      const match2 = pwd2 && inputPwd === pwd2.trim();

      let matchedQuizNo: number | null = null;
      if (match1) matchedQuizNo = 1;
      else if (match2) matchedQuizNo = 2;
      else if (!pwd1 && !pwd2 && legacyPwd && inputPwd === legacyPwd.trim()) matchedQuizNo = 1;

      if (!matchedQuizNo) {
        setIncorrectPassword(true);
        toast.error(language === "ta" ? "தவறான கடவுச்சொல்" : "Incorrect password");
        setCheckingAttempt(false);
        return;
      }

      setIncorrectPassword(false);
      setSelectedQuizNo(matchedQuizNo);

      // Check for duplicate attempt
      const { data, error } = (await (supabase
        .from("school_quiz_results" as any)
        .select("id")
        .eq("school_name", schoolName.trim())
        .eq("language", language)
        .eq("quiz_no", matchedQuizNo))) as any;

      if (error) {
        console.error("Error checking attempts:", error);
        toast.error(language === "ta" ? "சோதனையில் பிழை" : "Error checking attempts");
        setCheckingAttempt(false);
        return;
      }

      // If any results found for this school, they've already attempted
      if (data && data.length > 0) {
        toast.error(
          language === "ta"
            ? "இந்த பள்ளி ஏற்கனவே வினாடிவினாவை முயற்சித்துள்ளது"
            : "This school has already attempted the quiz"
        );
        setCheckingAttempt(false);
        return;
      }

      setShowSchoolDialog(false);
      setQuizStarted(true);

      const start = Date.now();
      setQuizStartTime(start);
      setTimeRemaining(60);
      setCanViewReview(false);

      // ✅ UPDATED: start on the current URL question (default 1)
      // So if user opens /quiz/3?school=ABC and then starts, it stays on 3.
      setUrl(urlQNo, schoolName.trim(), true);

      toast.success(language === "ta" ? "வினாடிவினா தொடங்குகிறது!" : "Quiz starting!");
      
      // Reset checking flag after successful quiz start
      setCheckingAttempt(false);
    } catch (err) {
      console.error("Error:", err);
      toast.error(language === "ta" ? "சோதனையில் பிழை" : "Error checking attempts");
      setCheckingAttempt(false);
    }
  };

  // ---------- Save results ----------
  const saveQuizResults = async () => {
    try {
      // Save summary results
      const { error } = await supabase.from("school_quiz_results").insert({
        school_name: schoolName,
        total_questions: totalQuestions,
        correct_answers: result.correct,
        wrong_answers: result.wrong,
        not_answered: result.notAnswered,
        final_score: result.score,
        language: language,
        quiz_no: selectedQuizNo ?? 1,
      });

      if (error) {
        // Check if it's a unique constraint violation (duplicate attempt)
        if (error.code === "23505") {
          console.warn("Duplicate submission attempt:", error);
          toast.error(
            language === "ta"
              ? "இந்த பள்ளி ஏற்கனவே வினாடிவினாவை முயற்சித்துள்ளது"
              : "This school has already submitted the quiz"
          );
          clearQuizSession(schoolName);
          return;
        } else {
          console.error("Error saving quiz results:", error);
          toast.error(language === "ta" ? "முடிவுகளை சேமிக்க முடியவில்லை" : "Failed to save results");
          return;
        }
      }

      // Save individual answers to school_quiz_answers table
      // Map answers array to q1, q2, q3... columns
      const answersData: any = {
        school_name: schoolName,
        quiz_no: selectedQuizNo ?? 1,
        language: language,
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

      toast.success(language === "ta" ? "முடிவுகள் சேமிக்கப்பட்டன" : "Results saved successfully");
      clearQuizSession(schoolName);
    } catch (error) {
      console.error("Error saving quiz results:", error);
      toast.error(language === "ta" ? "முடிவுகளை சேமிக்க முடியவில்லை" : "Failed to save results");
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
      const key = e.key.toLowerCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd && (key === "c" || key === "x" || key === "a" || key === "p" || key === "s")) {
        e.preventDefault();
        punishCopyAttempt();
      }

      if (e.key === "PrintScreen" || (e as any).keyCode === 44) {
        e.preventDefault();
        setPrivacyBlur(true);
        punishCopyAttempt();
        toast.error(language === "ta" ? "ஸ்க்ரீன்ஷாட் அனுமதிக்கப்படவில்லை!" : "Screenshots are not allowed!");
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
              ✦ {language === "ta" ? "1993 முதல் ஆற்றல் சேர்ப்பு" : "Empowering Future Leaders Since 1993"}
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
              {language === "ta" ? "உங்கள் அறிவை சோதித்து வெற்றி பெறுங்கள்" : "Test your knowledge and win prizes"}
            </motion.p>
          </motion.div>
        </section>
      )}

      {/* Quiz section */}
      <section className="relative py-16 md:py-24">
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Landing */}
            {showSchoolDialog && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Card className="overflow-hidden border border-border">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
                      <div className="bg-gradient-to-br from-cyan-500/20 via-cyan-400/10 to-transparent p-6 flex items-center justify-center">
                        <div className="h-40 w-full rounded-2xl overflow-hidden border border-border bg-white/60 flex items-center justify-center">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-4">
                              <div className="bg-cyan-500/20 rounded-2xl p-4">
                                <div className="w-20 h-20 text-cyan-600" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 md:p-8 flex flex-col justify-center gap-4">
                        <div>
                          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">Pentathlon 2026</h2>
                          <p className="text-muted-foreground mt-2">
                            {language === "ta"
                              ? "விண்ணப்ப படிவத்தை நிரப்பி நுழைவு தேர்விற்கு பதிவு செய்யுங்கள்"
                              : "Sign up for the entrance examination by filling out the application form"}
                          </p>
                        </div>

                        {!showSchoolInput ? (
                          <div>
                            {loadingQuizStatus ? (
                              <Button variant="donate" className="px-10" disabled>
                                {language === "ta" ? "ஏற்றுகிறது..." : "Loading..."}
                              </Button>
                            ) : !isQuizEnabled ? (
                              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                                <p className="text-destructive font-semibold text-center">
                                  {language === "ta" ? "வினாடிவினா போட்டி தற்போது மூடப்பட்டுள்ளது" : "Quiz Competition is Currently Closed"}
                                </p>
                              </div>
                            ) : (
                              <Button onClick={() => setShowSchoolInput(true)} variant="donate" className="px-10">
                                {language === "ta" ? "வினாடிவினாவைத் தொடங்கு" : "Start Quiz"}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="school-name" className="block text-sm font-semibold text-foreground mb-2">
                                {language === "ta" ? "பள்ளியின் பெயர்" : "School Name"}
                              </Label>
                              <Input
                                id="school-name"
                                value={schoolName}
                                onChange={(e) => setSchoolName(e.target.value)}
                                placeholder={language === "ta" ? "உங்கள் பள்ளியின் பெயரை உள்ளீடு செய்யவும்" : "Enter your school name"}
                              />
                            </div>

                            <div>
                              <Label htmlFor="quiz-password" className="block text-sm font-semibold text-foreground mb-2">
                                {language === "ta" ? "கடவுச்சொல்" : "Password"}
                              </Label>
                              <div className="relative">
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
                                  placeholder={language === "ta" ? "வினாடிவினா கடவுச்சொல்லை உள்ளீடு செய்யவும்" : "Enter quiz password"}
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((v) => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none outline-none cursor-pointer p-0"
                                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                                  {language === "ta" ? "தவறான கடவுச்சொல்" : "Incorrect password"}
                                </p>
                              </div>
                            )}

                            <Button onClick={handleStartQuiz} variant="donate" className="px-10 w-full" disabled={checkingAttempt}>
                              {checkingAttempt ? (language === "ta" ? "சரிபார்க்கிறது..." : "Checking...") : language === "ta" ? "தொடரவும்" : "Continue"}
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
                <div className={privacyBlur ? "blur-xl select-none pointer-events-none" : ""}>
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8 text-center"
                  >
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-2">
                      {language === "ta" ? "ஆன்லைன் MCQ வினாடிவினா" : "Online MCQ Quiz"}
                    </h1>
                  </motion.div>

                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-foreground/70">{language === "ta" ? "முன்னேற்றம்" : "Progress"}</span>
                      <span className="text-sm font-bold text-primary">
                        {Math.min(currentIndex + 1, totalQuestions)}/{totalQuestions}
                      </span>
                    </div>
                    <Progress value={progressValue} className="h-2" />
                  </div>

                  {questionsLoading ? (
                    <Card className="border-primary/20 shadow-lg mb-8">
                      <CardContent className="py-10 text-center">
                        <div className="text-sm text-foreground/70">Loading questions...</div>
                      </CardContent>
                    </Card>
                  ) : questionsError ? (
                    <Card className="border-primary/20 shadow-lg mb-8">
                      <CardContent className="py-10 text-center">
                        <div className="text-sm text-red-500">{questionsError}</div>
                      </CardContent>
                    </Card>
                  ) : !hasQuestions || !currentQuestion ? (
                    <Card className="border-primary/20 shadow-lg mb-8">
                      <CardContent className="py-10 text-center">
                        <div className="text-sm text-foreground/70">No quiz questions available.</div>
                      </CardContent>
                    </Card>
                  ) : !isFinished ? (
                    <motion.div
                      key={currentIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="border-primary/20 shadow-lg mb-8 relative overflow-hidden">
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
                            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                          </div>
                        </div>

                        <CardHeader className="border-b border-primary/10">
                          <div className="flex gap-4">
                            <p
                              className="flex-1 text-lg font-medium text-foreground mt-4 leading-relaxed select-none"
                              style={{ userSelect: "none", WebkitUserSelect: "none" }}
                              onCopy={(e) => {
                                e.preventDefault();
                                punishCopyAttempt();
                              }}
                            >
                              <span className="font-bold">{currentIndex + 1}. </span>
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
                                  <span className="text-foreground font-medium">{opt.text}</span>
                                </motion.button>
                              );
                            })}
                          </div>

                          <div className="flex justify-between items-center gap-4">
                            <Button variant="outline" onClick={clearSelection} disabled={currentAnswer === null} className="gap-2">
                              <RotateCcw className="w-4 h-4" />
                              {language === "ta" ? "நீக்கு" : "Clear"}
                            </Button>

                            <div className="flex-1 text-center">
                              <p className="text-sm text-foreground/70">{isLast ? (language === "ta" ? "கடைசி கேள்வி" : "Last") : language === "ta" ? "தொடர்க" : "Continue"}</p>
                            </div>

                            <Button onClick={goNext} className="gap-2 bg-primary hover:bg-primary/90">
                              {isLast ? (language === "ta" ? "முடிக்கவும்" : "Finish") : language === "ta" ? "அடுத்தது →" : "Next →"}
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
                            { label: language === "ta" ? "சரி" : "Correct", value: result.correct, icon: CheckCircle, cls: "text-green-500" },
                            { label: language === "ta" ? "தவறு" : "Wrong", value: result.wrong, icon: XCircle, cls: "text-red-500" },
                            { label: language === "ta" ? "பதில் இல்லை" : "Not Answered", value: result.notAnswered, icon: HelpCircle, cls: "text-yellow-500" },
                          ].map((s, i) => {
                            const Icon = s.icon;
                            return (
                              <div key={i} className="rounded-xl p-4 border border-primary/20 bg-card">
                                <Icon className={`w-6 h-6 ${s.cls} mx-auto mb-2`} />
                                <p className="text-2xl font-bold text-foreground text-center">{s.value}</p>
                                <p className="text-xs text-foreground/60 text-center mt-1">{s.label}</p>
                              </div>
                            );
                          })}
                        </div>

                        {canViewReview && hasCorrectAnswers && (
                          <div className="border-t border-primary/10 pt-6">
                            <h3 className="text-lg font-bold mb-4">{language === "ta" ? "விவரம்" : "Review"}</h3>
                            <div className="space-y-3">
                              {activeQuestions.map((q, idx) => {
                                const picked = answers[idx]?.selectedOptionId ?? null;
                                const isCorrect = picked && picked === q.correctOptionId;
                                const pickedText = getOptionText(q, picked);
                                const correctText = getOptionText(q, q.correctOptionId);

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
                                          {language === "ta" ? "பதில் அளிக்கப்படவில்லை" : "Not answered"}
                                        </div>
                                      ) : isCorrect ? (
                                        <div className="text-green-600 font-medium">
                                          {language === "ta" ? "சரியான பதில்" : "Correct"}
                                        </div>
                                      ) : (
                                        <>
                                          <div className="text-red-600 font-medium">
                                            {language === "ta" ? "தவறான பதில்" : "Wrong answer"}
                                          </div>
                                          {pickedText && (
                                            <div>
                                              {language === "ta" ? "நீங்கள் தேர்ந்தெடுத்தது: " : "Your answer: "}
                                              <span className="font-semibold text-foreground">{pickedText}</span>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {correctText && (
                                        <div>
                                          {language === "ta" ? "சரியான பதில்: " : "Correct answer: "}
                                          <span className="font-semibold text-foreground">{correctText}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

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
