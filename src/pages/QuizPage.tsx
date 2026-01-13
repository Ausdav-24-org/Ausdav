import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useQuizQuestions } from "@/hooks/useQuizQuestions";

type Option = {
  id: string;
  text: string;
};

type Question = {
  id: string;
  question: string; // Tamil
  options: Option[];
  correctOptionId: string;
};

type AnswerState = {
  selectedOptionId: string | null; // null = not answered
};

const QuizTamilMCQ: React.FC = () => {
  const { language } = useLanguage();

  // Anti-copy / anti-screenshot (best-effort deterrents)
  const [copyAttempts, setCopyAttempts] = useState(0);
  const [compromised, setCompromised] = useState(false); // if copy attempt happens, show altered/blurred question
  const [privacyBlur, setPrivacyBlur] = useState(false); // blur when tab hidden or window loses focus

  const { questions: dbQuestions, loading: questionsLoading, error: questionsError } =
    useQuizQuestions(language);
  const activeQuestions = dbQuestions;

  const [currentIndex, setCurrentIndex] = useState(0);

  const [answers, setAnswers] = useState<AnswerState[]>(
    () => Array.from({ length: activeQuestions.length }, () => ({ selectedOptionId: null }))
  );

  const [isFinished, setIsFinished] = useState(false);
  const [showReview, setShowReview] = useState(true);

  const currentQuestion = activeQuestions[currentIndex];
  const currentAnswer = answers[currentIndex]?.selectedOptionId ?? null;

  const isLast = currentIndex === activeQuestions.length - 1;
  const hasQuestions = activeQuestions.length > 0;
  const hasCorrectAnswers = useMemo(
    () => activeQuestions.every((q) => Boolean(q.correctOptionId)),
    [activeQuestions]
  );
  const totalQuestions = activeQuestions.length;
  const progressValue = totalQuestions
    ? (Math.min(currentIndex + 1, totalQuestions) / totalQuestions) * 100
    : 0;

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers(Array.from({ length: activeQuestions.length }, () => ({ selectedOptionId: null })));
    setIsFinished(false);
    setCompromised(false);
    setCopyAttempts(0);
    setPrivacyBlur(false);
  }, [activeQuestions.length]);

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

  const computeResult = () => {
    if (!hasCorrectAnswers) {
      return { correct: 0, wrong: 0, notAnswered: 0, score: 0 };
    }
    let correct = 0;
    let wrong = 0;
    let notAnswered = 0;

    activeQuestions.forEach((q, idx) => {
      const picked = answers[idx]?.selectedOptionId ?? null;
      if (picked === null) notAnswered += 1;
      else if (picked === q.correctOptionId) correct += 1;
      else wrong += 1;
    });

    const score = correct * 1 + notAnswered * 0 + wrong * -0.5;
    return { correct, wrong, notAnswered, score };
  };

  const result = useMemo(() => computeResult(), [answers, activeQuestions]);

  const goNext = () => {
    if (isFinished) return;

    if (!isLast) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    setIsFinished(true);
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setAnswers(Array.from({ length: activeQuestions.length }, () => ({ selectedOptionId: null })));
    setIsFinished(false);
    setCompromised(false);
    setCopyAttempts(0);
    setPrivacyBlur(false);
  };

  // --- Anti-copy / Anti-screenshot (deterrent) ---
  const punishCopyAttempt = () => {
    setCopyAttempts((n) => n + 1);
    setCompromised(true);
  };

  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      // Block copying from the page
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

      // Block common copy/select/print shortcuts
      if (ctrlOrCmd && (key === "c" || key === "x" || key === "a" || key === "p" || key === "s")) {
        e.preventDefault();
        punishCopyAttempt();
      }

      // Attempt to detect PrintScreen (not reliable across all browsers/OS)
      if (e.key === "PrintScreen") {
        e.preventDefault();
        punishCopyAttempt();
      }

      // Optional: block F12 / DevTools shortcuts (deterrent only)
      if (e.key === "F12") {
        e.preventDefault();
        punishCopyAttempt();
      }
      if (ctrlOrCmd && e.shiftKey && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        punishCopyAttempt();
      }
    };

    const onVisibilityChange = () => {
      // If user switches tab/app, blur content to deter screenshots
      setPrivacyBlur(document.hidden);
      if (document.hidden) {
        toast.warning(language === "ta" ? "Tab மாற்றப்பட்டது. உள்ளடக்கம் மறைக்கப்பட்டது." : "Tab changed. Content hidden.");
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Change how question appears if compromised (copy attempt)
  const displayedQuestion = useMemo(() => {
    if (!currentQuestion) return "";
    if (!compromised) return currentQuestion.question;
    // Make it "different" / obfuscated after copy attempt:
    return language === "ta"
      ? "⚠️ Copy முயற்சி காரணமாக கேள்வி மறைக்கப்பட்டது."
      : "⚠️ Question hidden due to copy attempt.";
  }, [compromised, currentQuestion, language]);

  // Watermark overlay (deterrent only)
  const Watermark = () => (
    <div className="pointer-events-none select-none absolute inset-0 overflow-hidden rounded-xl">
      <div className="absolute inset-0 opacity-[0.06] rotate-[-20deg] flex items-center justify-center">
        <div className="text-6xl md:text-7xl font-black whitespace-nowrap">
          PENTATHLON
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="container mx-auto max-w-4xl relative">
        {/* If user switches tabs / window loses focus, blur the whole quiz area */}
        <div className={privacyBlur ? "blur-xl select-none pointer-events-none" : ""}>
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-4">
              {language === "ta" ? "ஆன்லைன் MCQ வினாடிவினா" : "Online MCQ Quiz"}
            </h1>
            <p className="text-lg text-foreground/70 mb-2">
              {language === "ta"
                ? "ஒவ்வொரு கேள்வியும் ஒன்றன்பின் ஒன்றாக வரும். Back இல்லை."
                : "Answer one by one. No going back."}
            </p>
            {copyAttempts > 0 && (
              <p className="text-sm text-red-500 font-semibold">
                {language === "ta"
                  ? `Copy/Screenshot முயற்சிகள்: ${copyAttempts}`
                  : `Copy/Screenshot attempts: ${copyAttempts}`}
              </p>
            )}
          </motion.div>

          {/* Progress Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-foreground/70">
                {language === "ta" ? "முன்னேற்றம்" : "Progress"}
              </span>
              <span className="text-sm font-bold text-primary">
              {Math.min(currentIndex + 1, totalQuestions)}/{totalQuestions}
              </span>
            </div>
            <Progress
              value={progressValue}
              className="h-2"
            />
          </motion.div>

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
          ) : !hasQuestions ? (
            <Card className="border-primary/20 shadow-lg mb-8">
              <CardContent className="py-10 text-center">
                <div className="text-sm text-foreground/70">No quiz questions available.</div>
              </CardContent>
            </Card>
          ) : !currentQuestion ? (
            <Card className="border-primary/20 shadow-lg mb-8">
              <CardContent className="py-10 text-center">
                <div className="text-sm text-foreground/70">Loading question...</div>
              </CardContent>
            </Card>
          ) : !isFinished ? (
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-primary/20 shadow-lg mb-8 relative overflow-hidden">
                <Watermark />

                <CardHeader className="border-b border-primary/10">
                  {/* Question text: make it non-selectable */}
                  <p
                    className="text-lg font-medium text-foreground mt-4 leading-relaxed select-none"
                    style={{ userSelect: "none", WebkitUserSelect: "none" }}
                    onCopy={(e) => {
                      e.preventDefault();
                      punishCopyAttempt();
                    }}
                  >
                    <span className="font-bold">{currentIndex + 1}. </span>
                    {displayedQuestion}
                  </p>

                  {compromised && (
                    <p className="mt-2 text-sm text-red-500 font-semibold select-none">
                      {language === "ta"
                        ? "பாதுகாப்பு காரணமாக கேள்வி மறைக்கப்பட்டது."
                        : "Question hidden for security reasons."}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="pt-8">
                  {/* Options Grid */}
                  <div className="space-y-4 mb-8">
                    {currentQuestion.options.map((opt, idx) => {
                      const checked = currentAnswer === opt.id;
                      return (
                        <motion.button
                          key={opt.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectOption(opt.id)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 flex items-center gap-4 group select-none ${
                            checked
                              ? "border-primary bg-primary/10 shadow-lg"
                              : "border-primary/20 bg-card hover:border-primary/40 hover:bg-primary/5"
                          }`}
                        >
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-lg font-bold flex items-center justify-center text-sm transition-all ${
                              checked
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/20 text-primary group-hover:bg-primary/30"
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="text-foreground font-medium group-hover:text-foreground/90 select-none">
                            {opt.text}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
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
                            : "Last Question"
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-primary/20 shadow-xl mb-8 relative overflow-hidden">
                <Watermark />

                <CardHeader className="border-b border-primary/10 text-center">
                  <CardTitle className="text-3xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {language === "ta" ? "முடிவுகள்" : "Results"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-8">
                  {/* Review Toggle */}
                  <div className="flex justify-center gap-4 mb-8">
                    <Button
                      variant="outline"
                      onClick={() => setShowReview((s) => !s)}
                      className="gap-2"
                      disabled={!hasCorrectAnswers}
                    >
                      {showReview
                        ? language === "ta"
                          ? "விவரம் மறை"
                          : "Hide Details"
                        : language === "ta"
                        ? "விவரம் காண்பி"
                        : "Show Details"}
                    </Button>

                    <Button onClick={resetQuiz} className="gap-2 bg-primary hover:bg-primary/90">
                      <RotateCcw className="w-4 h-4" />
                      {language === "ta" ? "மீண்டும் தொடங்கு" : "Try Again"}
                    </Button>
                  </div>

                  {/* Review Section */}
                  {showReview && hasCorrectAnswers && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-primary/10 pt-8"
                    >
                      <h3 className="text-lg font-bold mb-6 text-foreground">
                        {language === "ta" ? "விவரம்" : "Review"}
                      </h3>
                      <div className="space-y-4">
                        {activeQuestions.map((q, idx) => {
                          const picked = answers[idx]?.selectedOptionId ?? null;
                          const correctId = q.correctOptionId;
                          const pickedOpt = picked ? q.options.find((o) => o.id === picked) : null;
                          const correctOpt = q.options.find((o) => o.id === correctId);

                          const isCorrect = picked === correctId;
                          const isNotAnswered = picked === null;

                          return (
                            <motion.div
                              key={q.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className={`rounded-lg border p-4 ${
                                isCorrect
                                  ? "border-green-500/30 bg-green-500/5"
                                  : isNotAnswered
                                  ? "border-yellow-500/30 bg-yellow-500/5"
                                  : "border-red-500/30 bg-red-500/5"
                              }`}
                            >
                              <div className="flex items-start gap-3 mb-3">
                                {isCorrect ? (
                                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                ) : isNotAnswered ? (
                                  <HelpCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="font-semibold text-foreground">
                                    {language === "ta" ? "கேள்வி" : "Q"} {idx + 1}: {q.question}
                                  </p>
                                </div>
                              </div>

                              <div className="ml-8 space-y-2 text-sm">
                                {pickedOpt && (
                                  <p className="text-foreground/70">
                                    <span className="font-medium">
                                      {language === "ta" ? "உங்கள் பதில்" : "Your answer"}:
                                    </span>{" "}
                                    <span
                                      className={
                                        isCorrect
                                          ? "text-green-500 font-semibold"
                                          : "text-red-500 font-semibold"
                                      }
                                    >
                                      {pickedOpt.text}
                                    </span>
                                  </p>
                                )}
                                {!isCorrect && correctOpt && (
                                  <p className="text-foreground/70">
                                    <span className="font-medium">
                                      {language === "ta" ? "சரியான பதில்" : "Correct answer"}:
                                    </span>{" "}
                                    <span className="text-green-500 font-semibold">{correctOpt.text}</span>
                                  </p>
                                )}
                                {isNotAnswered && (
                                  <p className="text-yellow-600 font-medium">
                                    {language === "ta" ? "பதில் இல்லை" : "Not answered"}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Overlay when privacyBlur is on */}
        {privacyBlur && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 border border-primary/20 rounded-xl p-6 text-center shadow-lg">
              <p className="text-lg font-bold">
                {language === "ta" ? "உள்ளடக்கம் மறைக்கப்பட்டுள்ளது" : "Content Hidden"}
              </p>
              <p className="text-sm text-foreground/70 mt-2">
                {language === "ta"
                  ? "Tab / window மாற்றும்போது பாதுகாப்புக்காக blur செய்யப்படுகிறது."
                  : "Blurred for privacy when switching tabs/windows."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizTamilMCQ;
