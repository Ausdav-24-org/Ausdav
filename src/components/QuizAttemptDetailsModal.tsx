import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Markdown + KaTeX for question rendering
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type QuizQuestion = {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string | null;
  image_path?: string | null;
};

type QuizAnswersData = {
  [key: string]: string | null;
};

interface QuizAttemptDetailsModalProps {
  schoolName: string;
  quizPasswordId?: number;
  isOpen: boolean;
  onClose: () => void;
}

const QuizAttemptDetailsModal: React.FC<QuizAttemptDetailsModalProps> = ({
  schoolName,
  quizPasswordId = 0,
  isOpen,
  onClose,
}) => {
  // defensive: don't render or run effects when modal is closed
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<QuizAnswersData>({});
  const [storedScore, setStoredScore] = useState<number | null>(null);
  const [localError, setLocalError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!schoolName || !quizPasswordId) return;

    setLocalError(null);
    console.log('[QuizAttemptDetailsModal] Opening for school:', schoolName, 'quizPasswordId:', quizPasswordId);
    fetchQuizData().catch((err) => {
      console.error('[QuizAttemptDetailsModal] fetch error:', err);
      setLocalError(err instanceof Error ? err : new Error(String(err)));
    });
  }, [isOpen, schoolName, quizPasswordId]);

  // early return if modal closed or required props missing
  if (!isOpen) return null;
  if (!schoolName) return null;
  if (!quizPasswordId) return null;
  if (localError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg shadow-lg p-6 max-w-lg w-full">
          <h3 className="text-lg font-semibold">Failed to load attempt details</h3>
          <p className="text-sm text-muted-foreground mt-2">{localError.message}</p>
          <div className="mt-4 text-right">
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const fetchQuizData = async () => {
    try {
      setLoading(true);

      // Fetch questions by quiz_password_id
      const { data: questionsData, error: questionsError } = await supabase
        .from("quiz_mcq" as any)
        .select("*")
        .eq("quiz_password_id", quizPasswordId)
        .order("id", { ascending: true }) as any;

      console.log('[QuizAttemptDetailsModal] Fetched questions:', questionsData, 'Error:', questionsError);

      if (questionsError) throw questionsError;

      // Fetch answers for this school and quiz_password_id
      const { data: answersData, error: answersError } = await supabase
        .from("school_quiz_answers" as any)
        .select("*")
        .eq("school_name", schoolName)
        .eq("quiz_password_id", quizPasswordId)
        .order("created_at", { ascending: false })
        .limit(1) as any;

      if (answersError) throw answersError;

      setQuestions((questionsData || []) as any);

      if (answersData && Array.isArray(answersData) && answersData.length > 0) {
        const answersRow = (answersData[0] as any) || {};
        setAnswers(answersRow);

        // Also fetch authoritative stored score from school_quiz_results (if available)
        try {
          const { data: resultRows, error: resultErr } = await supabase
            .from("school_quiz_results" as any)
            .select("final_score")
            .eq("school_name", schoolName)
            .eq("quiz_password_id", quizPasswordId)
            .order("created_at", { ascending: false })
            .limit(1) as any;

          if (!resultErr && resultRows && resultRows.length > 0) {
            setStoredScore(resultRows[0].final_score ?? null);
          } else {
            setStoredScore(null);
          }
        } catch (err) {
          setStoredScore(null);
        }
      } else {
        setStoredScore(null);
      }
    } catch (error) {
      console.error("Error fetching quiz data:", error);
      toast.error("Failed to load quiz details");
    } finally {
      setLoading(false);
    }
  };

  const getOptionText = (question: QuizQuestion, optionId: string | null) => {
    if (!optionId) return null;
    const optionMap: { [key: string]: string } = {
      a: question.option_a,
      b: question.option_b,
      c: question.option_c,
      d: question.option_d,
    };
    return optionMap[optionId] || null;
  };

  const getAnswerStatus = (question: QuizQuestion, questionIndex: number) => {
    const columnName = `q${questionIndex + 1}`;
    const choiceMeta: Record<string, string | null> = (answers as any)?.choice_meta || {};
    const studentAnswer = choiceMeta[question.id?.toString()] ?? (answers as any)[columnName] ?? null;

    if (!studentAnswer) {
      return { status: "not-answered", label: "Not Answered" };
    }

    if (studentAnswer === question.correct_answer) {
      return { status: "correct", label: "Correct" };
    }

    return { status: "wrong", label: "Wrong" };
  };

  // Compute total score from questions + answers_meta (matches QuizPage scoring)
  const computeScoreFromAnswers = (qs: QuizQuestion[] = questions, ans: any = answers) => {
    let total = 0;

    qs.forEach((question, idx) => {
      const col = `q${idx + 1}`;
      const choiceMeta = (ans && ans.choice_meta) || {};
      const studentAnswer = choiceMeta[question.id?.toString()] ?? ans[col] ?? null;

      // answers_meta may be keyed by question-id (preferred) or legacy qN — support both
      const answersMetaObj = (ans && ans.answers_meta) || {};
      const meta = answersMetaObj[question.id?.toString()] ?? answersMetaObj[col] ?? null;

      if (!studentAnswer) {
        // not answered -> 0
      } else if (studentAnswer === question.correct_answer) {
        total += 100;
        const bonus = typeof meta?.bonus === 'number'
          ? meta.bonus
          : typeof meta?.secondsTaken === 'number'
          ? Math.max(0, 60 - meta.secondsTaken)
          : 0;
        total += bonus;
      } else {
        total -= 50;
      }
    });

    return total;
  };

  const stats = {
    total: questions.length,
    correct: questions.filter(
      (question, idx) => getAnswerStatus(question, idx).status === "correct"
    ).length,
    wrong: questions.filter(
      (question, idx) => getAnswerStatus(question, idx).status === "wrong"
    ).length,
    notAnswered: questions.filter(
      (question, idx) => getAnswerStatus(question, idx).status === "not-answered"
    ).length,
  };

  // Build per-question timing data (supports answers_meta keyed by question-id OR legacy qN)
  const answersMeta = (answers as any)?.answers_meta || {};
  const chartData = questions.map((question, idx) => {
    const key = `q${idx + 1}`;
    const sec =
      typeof answersMeta[question.id?.toString()]?.secondsTaken === "number"
        ? answersMeta[question.id?.toString()].secondsTaken
        : typeof answersMeta[key]?.secondsTaken === "number"
        ? answersMeta[key].secondsTaken
        : null;
    return { question: `Q${idx + 1}`, seconds: sec ?? 0 };
  });

  const hasTiming = chartData.some((d) => d.seconds > 0);

  const timeChartConfig: ChartConfig = {
    time: { label: "Seconds", color: "#F59E0B" },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold">{schoolName}</h2>
                <p className="text-sm text-muted-foreground">Quiz ID {quizPasswordId} - Detailed Answers</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-4 right-4"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-4 p-6 bg-muted/30 border-b">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Questions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.wrong}</div>
                <div className="text-xs text-muted-foreground">Wrong</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.notAnswered}</div>
                <div className="text-xs text-muted-foreground">Not Answered</div>
              </div>

              {/* Score (use stored score if available, otherwise compute from answers_meta) */}
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">{(storedScore ?? computeScoreFromAnswers(questions, answers)).toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Score</div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : questions.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">No questions available</p>
                </div>
              ) : (
                <>
                  {hasTiming ? (
                    <div className="mb-4">
                      <ChartContainer config={timeChartConfig} className="h-[160px]">
                        <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="question" />
                          <YAxis allowDecimals={false} tickFormatter={(v) => `${v}s`} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="seconds" stroke="var(--color-time)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ChartContainer>
                      <div className="text-xs text-muted-foreground">Time (seconds) per question for this attempt</div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mb-4">No timing data available for this attempt</div>
                  )}

                  <div className="space-y-6">
                  {questions.map((question, index) => {
                    const columnName = `q${index + 1}`;
                    const choiceMeta = (answers as any)?.choice_meta || {};
                    const studentAnswer = choiceMeta[question.id?.toString()] ?? (answers as any)[columnName] ?? null;
                    const statusData = getAnswerStatus(question, index);

                    return (
                      <motion.div
                        key={question.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card
                          className={`border-l-4 ${
                            statusData.status === "correct"
                              ? "border-l-green-500 bg-green-50 dark:bg-green-950/20"
                              : statusData.status === "wrong"
                              ? "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                              : "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                          }`}
                        >
                          <CardContent className="pt-6">
                            {/* Question Header */}
                            <div className="flex items-start gap-3 mb-4">
                              <div className="text-lg font-bold text-muted-foreground">
                                Q{index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-base prose max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {question.question_text}
                                </ReactMarkdown>
                              </div>
                              </div>
                              <div className="flex-shrink-0">
                                {statusData.status === "correct" ? (
                                  <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : statusData.status === "wrong" ? (
                                  <XCircle className="w-6 h-6 text-red-600" />
                                ) : (
                                  <HelpCircle className="w-6 h-6 text-yellow-600" />
                                )}
                              </div>
                            </div>

                            {/* Question Image */}
                            {question.image_path && (() => {
                              const { data: imageUrl } = supabase.storage
                                .from("quiz-question-images")
                                .getPublicUrl(question.image_path);

                              return (
                                <div className="mb-4">
                                  <img
                                    src={imageUrl?.publicUrl}
                                    alt="Question"
                                    className="max-h-64 rounded-lg object-contain"
                                  />
                                </div>
                              );
                            })()}

                            {/* Options */}
                            <div className="space-y-2 mb-4">
                              {["a", "b", "c", "d"].map((optionLetter) => {
                                const optionText =
                                  question[`option_${optionLetter}`];
                                const isCorrect = optionLetter === question.correct_answer;
                                const isStudentAnswer = optionLetter === studentAnswer;

                                return (
                                  <div
                                    key={optionLetter}
                                    className={`p-3 rounded-lg border-2 transition-all ${
                                      isCorrect
                                        ? "border-green-500 bg-green-100 dark:bg-green-900/30"
                                        : isStudentAnswer
                                        ? "border-red-500 bg-red-100 dark:bg-red-900/30"
                                        : "border-muted bg-muted/30"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span
                                        className={`font-bold w-8 h-8 flex items-center justify-center rounded ${
                                          isCorrect
                                            ? "bg-green-500 text-white"
                                            : isStudentAnswer
                                            ? "bg-red-500 text-white"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {optionLetter.toUpperCase()}
                                      </span>
                                      <span className="text-sm prose max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{optionText}</ReactMarkdown>
                                      </span>
                                      <div className="ml-auto text-xs font-semibold">
                                        {isCorrect && (
                                          <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4" /> Correct
                                          </span>
                                        )}
                                        {isStudentAnswer && !isCorrect && (
                                          <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                            <XCircle className="w-4 h-4" /> Selected
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Status */}
                            <div className="pt-3 border-t">
                              <span
                                className={`inline-flex items-center gap-1 font-semibold text-sm ${
                                  statusData.status === "correct"
                                    ? "text-green-600 dark:text-green-400"
                                    : statusData.status === "wrong"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-yellow-600 dark:text-yellow-400"
                                }`}
                              >
                                {statusData.status === "correct" ? (
                                  <>
                                    <CheckCircle className="w-4 h-4" /> {statusData.label}
                                  </>
                                ) : statusData.status === "wrong" ? (
                                  <>
                                    <XCircle className="w-4 h-4" /> {statusData.label} (Selected:{" "}
                                    {studentAnswer?.toUpperCase()})
                                  </>
                                ) : (
                                  <>
                                    <HelpCircle className="w-4 h-4" /> {statusData.label}
                                  </>
                                )}
                              </span>

                              {/* Per-question scoring breakdown (qstn point + bonus point) */}
                              {(() => {
                                // answers may include answers_meta (added in submissions)
                                const answersMeta = (answers as any)?.answers_meta || {};
                                // support question-id keyed meta (preferred) with legacy qN fallback
                                const meta = answersMeta[question.id?.toString()] ?? answersMeta[columnName] ?? null;

                                // Use same scoring as the quiz: +100 for correct, -50 for wrong, 0 for not answered
                                const qstnPoint = statusData.status === "correct" ? 100 : statusData.status === "wrong" ? -50 : 0;

                                // Determine displayed bonus: only apply time bonus when the answer is correct.
                                let bonusPoint: number | null = null;
                                if (statusData.status === "correct") {
                                  if (typeof meta?.bonus === "number") {
                                    bonusPoint = meta.bonus;
                                  } else if (typeof meta?.secondsTaken === "number") {
                                    bonusPoint = Math.max(0, 60 - meta.secondsTaken);
                                  } else {
                                    bonusPoint = 0;
                                  }
                                } else {
                                  // wrong or not-answered -> no time bonus shown/applied
                                  bonusPoint = 0;
                                }

                                return (
                                  <div className="mt-3 flex gap-4 items-center">
                                    <div className="text-sm text-muted-foreground">
                                      Qstn point: 
                                      <span
                                        className={`ml-2 font-semibold ${
                                          qstnPoint > 0 ? "text-green-600" : qstnPoint < 0 ? "text-red-600" : "text-foreground"
                                        }`}
                                      >
                                        {qstnPoint > 0 ? `+${qstnPoint}` : qstnPoint}
                                      </span>
                                    </div>

                                    <div className="text-sm text-muted-foreground">
                                      Bonus point: 
                                      <span className="ml-2 font-semibold text-yellow-500">
                                        {bonusPoint != null ? `+${bonusPoint}` : "+0"}
                                      </span>
                                    </div>

                                    {/* show secondsTaken if available */}
                                    {meta?.secondsTaken != null && (
                                      <div className="text-sm text-muted-foreground ml-auto">
                                        <span className="text-xs">Time: {meta.secondsTaken}s</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t p-6 bg-muted/30 flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default QuizAttemptDetailsModal;
