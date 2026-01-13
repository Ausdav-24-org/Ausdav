import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuizQuestions } from "@/hooks/useQuizQuestions";
import { supabase } from "@/integrations/supabase/client";

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

  // School name and quiz start control
  const [showSchoolDialog, setShowSchoolDialog] = useState(true);
  const [schoolName, setSchoolName] = useState("");
  const [quizStarted, setQuizStarted] = useState(false);
  const [checkingAttempt, setCheckingAttempt] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [canViewReview, setCanViewReview] = useState(false);

  // Anti-copy / anti-screenshot (best-effort deterrents)
  const [copyAttempts, setCopyAttempts] = useState(0);
  const [compromised, setCompromised] = useState(false); // if copy attempt happens, show altered/blurred question
  const [privacyBlur, setPrivacyBlur] = useState(false); // blur when tab hidden or window loses focus

  const { questions: dbQuestions, loading: questionsLoading, error: questionsError } =
    useQuizQuestions(language);
  
  // Shuffle questions based on school name for consistent but different order per school
  const activeQuestions = useMemo(() => {
    if (!dbQuestions.length || !schoolName) return dbQuestions;
    
    // Create a seeded random based on school name
    const seed = schoolName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const shuffled = [...dbQuestions];
    
    // Fisher-Yates shuffle with seed
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
  }, [dbQuestions, schoolName]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [answers, setAnswers] = useState<AnswerState[]>(
    () => Array.from({ length: activeQuestions.length }, () => ({ selectedOptionId: null }))
  );

  const [isFinished, setIsFinished] = useState(false);

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

  // Timer countdown effect
  useEffect(() => {
    if (!quizStarted || !quizStartTime) return;

    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);

      // Auto-finish quiz after 60 seconds
      if (remaining === 0 && !isFinished) {
        setIsFinished(true);
        saveQuizResults();
        toast.info(language === "ta" ? "நேரம் முடிந்தது!" : "Time's up!");
      }

      // Enable review after 60 seconds
      if (elapsed >= 60) {
        setCanViewReview(true);
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [quizStarted, quizStartTime, isFinished, language]);

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

    const score = correct * 2 + wrong * 1 + notAnswered * 0;
    return { correct, wrong, notAnswered, score };
  };

  const result = useMemo(() => computeResult(), [answers, activeQuestions]);

  const goNext = () => {
    if (isFinished) return;

    if (!isLast) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    // Quiz finished
    setIsFinished(true);
    saveQuizResults();
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setAnswers(Array.from({ length: activeQuestions.length }, () => ({ selectedOptionId: null })));
    setIsFinished(false);
    setCompromised(false);
    setCopyAttempts(0);
    setPrivacyBlur(false);
    setShowSchoolDialog(true);
    setSchoolName("");
    setQuizStarted(false);
    setQuizStartTime(null);
    setTimeRemaining(60);
    setCanViewReview(false);
  };

  const handleStartQuiz = async () => {
    if (!schoolName.trim()) {
      toast.error(language === "ta" ? "பள்ளியின் பெயரை உள்ளிடவும்" : "Please enter school name");
      return;
    }

    // Check if school has already attempted the quiz
    setCheckingAttempt(true);
    try {
      const { data, error } = await supabase
        .from("school_quiz_results")
        .select("id")
        .eq("school_name", schoolName.trim())
        .eq("language", language)
        .limit(1);

      if (error) {
        console.error("Error checking attempts:", error);
        toast.error(language === "ta" ? "சோதனையில் பிழை" : "Error checking attempts");
        setCheckingAttempt(false);
        return;
      }

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
      setQuizStartTime(Date.now());
      setTimeRemaining(60);
      setCanViewReview(false);
      toast.success(language === "ta" ? "வினாடிவினா தொடங்குகிறது!" : "Quiz starting!");
    } catch (err) {
      console.error("Error:", err);
      toast.error(language === "ta" ? "சோதனையில் பிழை" : "Error checking attempts");
    } finally {
      setCheckingAttempt(false);
    }
  };

  const saveQuizResults = async () => {
    try {
      const { error } = await supabase
        .from("school_quiz_results")
        .insert({
          school_name: schoolName,
          total_questions: totalQuestions,
          correct_answers: result.correct,
          wrong_answers: result.wrong,
          not_answered: result.notAnswered,
          final_score: result.score,
          language: language,
        });

      if (error) {
        console.error("Error saving quiz results:", error);
        toast.error(language === "ta" ? "முடிவுகளை சேமிக்க முடியவில்லை" : "Failed to save results");
      } else {
        toast.success(language === "ta" ? "முடிவுகள் சேமிக்கப்பட்டன" : "Results saved successfully");
      }
    } catch (error) {
      console.error("Error saving quiz results:", error);
      toast.error(language === "ta" ? "முடிவுகளை சேமிக்க முடியவில்லை" : "Failed to save results");
    }
  };

  // --- Anti-copy / Anti-screenshot (deterrent) ---
  const punishCopyAttempt = () => {
    setCopyAttempts((n) => n + 1);
    setCompromised(true);
  };

  // Detect screenshot using canvas manipulation detection
  const detectCanvasManipulation = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      // Check if canvas is disabled (some privacy tools disable it)
      const imageData = ctx.getImageData(0, 0, 1, 1);
      if (!imageData) return false;
      
      // If code reaches here, canvas is accessible - mark as potential screenshot
      return true;
    } catch (e) {
      return false;
    }
  };

  // Monitor for rapid blur state changes (screenshot tool activation)
  const [lastBlurTime, setLastBlurTime] = useState<number>(0);
  const handleScreenshotDetection = () => {
    const now = Date.now();
    if (now - lastBlurTime < 100) {
      // Too rapid changes might indicate screenshot tool
      setCompromised(true);
      toast.error(language === "ta" ? "স্ক্রিনশট সনাক্ত হয়েছে!" : "Screenshot detected!");
    }
    setLastBlurTime(now);
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

      // Block PrintScreen key - most reliable screenshot detection
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault();
        setPrivacyBlur(true);
        punishCopyAttempt();
        toast.error(language === "ta" ? "ஸ்க்ரீன்ஷாட் அனுமதிக்கப்படவில்லை!" : "Screenshots are not allowed!");
        setTimeout(() => setPrivacyBlur(false), 1000);
        return false;
      }

      // Block Cmd+Shift+3 (Mac screenshot)
      if (e.ctrlKey && e.shiftKey && key === "3") {
        e.preventDefault();
        setPrivacyBlur(true);
        punishCopyAttempt();
        toast.error(language === "ta" ? "ஸ்க்ரீன்ஷாட் அனுமதிக்கப்படவில்லை!" : "Screenshots are not allowed!");
        setTimeout(() => setPrivacyBlur(false), 1000);
        return false;
      }

      // Block Cmd+Shift+4 (Mac screenshot selection)
      if (e.ctrlKey && e.shiftKey && key === "4") {
        e.preventDefault();
        setPrivacyBlur(true);
        punishCopyAttempt();
        toast.error(language === "ta" ? "ஸ்க்ரீன்ஷாட் அனுமதிக்கப்படவில்லை!" : "Screenshots are not allowed!");
        setTimeout(() => setPrivacyBlur(false), 1000);
        return false;
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
      // Blur content immediately when tab/app switches
      if (document.hidden) {
        setPrivacyBlur(true);
        toast.warning(language === "ta" ? "ট্যাব পরিবর্তিত হয়েছে। সামগ্রী লুকানো হয়েছে।" : "Tab changed. Content hidden.");
      } else {
        setPrivacyBlur(false);
      }
    };

    const onWindowBlur = () => {
      setPrivacyBlur(true);
      toast.warning(language === "ta" ? "பயன்பாடு பটনிக்கப்பட்டது. உள்ளடக்கம் மறைக்கப்பட்டது." : "App closed. Content hidden.");
    };
    const onWindowFocus = () => setPrivacyBlur(false);

    // Detect screen capture API usage (newer method)
    if (navigator.mediaDevices) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      if (originalGetDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia = async (...args) => {
          setPrivacyBlur(true);
          punishCopyAttempt();
          toast.error(language === "ta" ? "ஸ்க்ரீன் ক্যাপচার অনুমতিপ্রাপ্ত নয়!" : "Screen capture not allowed!");
          throw new Error("Screen capture is disabled for this quiz");
        };
      }
    }

    // Block drag and drop to prevent screenshot tools
    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener("dragstart", onDragStart);

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
      document.removeEventListener("dragstart", onDragStart);
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
      <div className="container mx-auto max-w-4xl">
        {/* School Name Form - Show inline instead of modal */}
        {showSchoolDialog && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="border-primary/20 shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">
                  {language === "ta" ? "வினாடிவினா தொடங்க" : "Start Quiz"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  {language === "ta" 
                    ? "உங்கள் பள்ளியின் பெயரை உள்ளிடவும்" 
                    : "Please enter your school name"}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="school-name" className="mb-2 block">
                      {language === "ta" ? "பள்ளியின் பெயர்" : "School Name"}
                    </Label>
                    <Input
                      id="school-name"
                      type="text"
                      placeholder={language === "ta" ? "பள்ளியின் பெயர்..." : "Enter school name..."}
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleStartQuiz();
                        }
                      }}
                      className="w-full"
                      autoFocus
                    />
                  </div>
                  <Button
                    onClick={handleStartQuiz}
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={checkingAttempt}
                  >
                    {checkingAttempt 
                      ? (language === "ta" ? "சரிபார்க்கிறது..." : "Checking...") 
                      : (language === "ta" ? "தொடங்கு" : "Start Quiz")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div style={{ display: quizStarted ? "block" : "none" }}>
        {/* Anti-screenshot protection overlay */}
        <div 
          className="fixed inset-0 pointer-events-none z-50 mix-blend-screen"
          style={{
            background: "repeating-linear-gradient(0deg, rgba(255,255,255,.03), rgba(255,255,255,.03) 1px, transparent 1px, transparent 2px)",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
        />
        
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

                {/* Timer Display in Corner */}
                <div className="absolute top-4 right-4 z-10">
                  <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                    timeRemaining <= 10 
                      ? 'bg-red-500/20 text-red-500 animate-pulse' 
                      : timeRemaining <= 30 
                      ? 'bg-yellow-500/20 text-yellow-600' 
                      : 'bg-primary/20 text-primary'
                  }`}>
                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </div>
                </div>

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
                  {!canViewReview && (
                    <p className="text-sm text-foreground/70 mt-2">
                      {language === "ta" 
                        ? `விவரங்கள் ${timeRemaining} வினாடிகளில் காண்பிக்கப்படும்` 
                        : `Review available in ${timeRemaining} seconds`}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="pt-8">
                  {!canViewReview ? (
                    <div className="text-center py-12">
                      <div className="mb-6">
                        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
                      </div>
                      <p className="text-2xl font-bold text-primary mb-2">
                        {timeRemaining}
                      </p>
                      <p className="text-lg text-foreground/70">
                        {language === "ta" 
                          ? "உங்கள் விடைகள் சரிபார்க்கப்படுகின்றன..." 
                          : "Your answers are being verified..."}
                      </p>
                      <p className="text-sm text-foreground/50 mt-4">
                        {language === "ta" 
                          ? "விரைவில் முடிவுகள் காண்பிக்கப்படும்" 
                          : "Results will be displayed soon"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Review Section */}
                      {hasCorrectAnswers && (
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
                    </>
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
    </div>
  );
};

export default QuizTamilMCQ;
