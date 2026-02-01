import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  quizNo?: number;
  isOpen: boolean;
  onClose: () => void;
}

const QuizAttemptDetailsModal: React.FC<QuizAttemptDetailsModalProps> = ({
  schoolName,
  quizNo = 1,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<QuizAnswersData>({});

  useEffect(() => {
    if (isOpen && schoolName) {
      fetchQuizData();
    }
  }, [isOpen, schoolName, quizNo]);

  const fetchQuizData = async () => {
    try {
      setLoading(true);

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("quiz_mcq" as any)
        .select("*")
        .eq("quiz_no", quizNo)
        .order("id", { ascending: true }) as any;

      if (questionsError) throw questionsError;

      // Fetch answers for this school
      const { data: answersData, error: answersError } = await supabase
        .from("school_quiz_answers" as any)
        .select("*")
        .eq("school_name", schoolName)
        .eq("quiz_no", quizNo)
        .order("created_at", { ascending: false })
        .limit(1) as any;

      if (answersError) throw answersError;

      setQuestions((questionsData || []) as any);

      if (answersData && Array.isArray(answersData) && answersData.length > 0) {
        setAnswers((answersData[0] as any) || {});
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
    const studentAnswer = answers[columnName] || null;

    if (!studentAnswer) {
      return { status: "not-answered", label: "Not Answered" };
    }

    if (studentAnswer === question.correct_answer) {
      return { status: "correct", label: "Correct" };
    }

    return { status: "wrong", label: "Wrong" };
  };

  const stats = {
    total: questions.length,
    correct: questions.filter(
      (q, idx) => getAnswerStatus(q, idx).status === "correct"
    ).length,
    wrong: questions.filter(
      (q, idx) => getAnswerStatus(q, idx).status === "wrong"
    ).length,
    notAnswered: questions.filter(
      (q, idx) => getAnswerStatus(q, idx).status === "not-answered"
    ).length,
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
                <p className="text-sm text-muted-foreground">Quiz {quizNo} - Detailed Answers</p>
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
            <div className="grid grid-cols-4 gap-4 p-6 bg-muted/30 border-b">
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
                <div className="space-y-6">
                  {questions.map((question, index) => {
                    const columnName = `q${index + 1}`;
                    const studentAnswer = answers[columnName] || null;
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
                                <p className="font-semibold text-base">{question.question_text}</p>
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
                                      <span className="text-sm">{optionText}</span>
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
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
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
