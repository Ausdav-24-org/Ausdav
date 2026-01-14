import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QuizQuestion = {
  id: number;
  question_text: string;
  language: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string | null;
  created_at: string;
};

export type QuizQuestionFormatted = {
  id: string;
  question: string;
  options: Array<{
    id: string;
    text: string;
  }>;
  correctOptionId: string;
};

const formatQuestions = (
  questions: QuizQuestion[]
): QuizQuestionFormatted[] => {
  return questions.map((q) => ({
    id: q.id.toString(),
    question: q.question_text,
    options: [
      { id: "a", text: q.option_a },
      { id: "b", text: q.option_b },
      { id: "c", text: q.option_c },
      { id: "d", text: q.option_d },
    ],
    correctOptionId: q.correct_answer || "", // Use correct_answer from database
  }));
};

export const useQuizQuestions = (language: string = "ta") => {
  const [questions, setQuestions] = useState<QuizQuestionFormatted[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`Fetching quiz questions`);
        
        // Fetch all questions regardless of language - questions are the same for all language users
        const { data, error: supabaseError } = await supabase
          .from("quiz_mcq")
          .select("*")
          .order("created_at", { ascending: true });

        if (supabaseError) {
          console.error("Supabase error:", supabaseError);
          throw supabaseError;
        }

        console.log(`Fetched ${data?.length || 0} questions`);
        
        if (data && data.length > 0) {
          const formatted = formatQuestions(data as QuizQuestion[]);
          console.log(`Formatted ${formatted.length} questions`);
          setQuestions(formatted);
        } else {
          console.warn(`No questions found`);
          setQuestions([]);
          setError(`No questions available`);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch questions";
        setError(errorMessage);
        console.error("Error fetching quiz questions:", err);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [language]);

  return { questions, loading, error };
};
