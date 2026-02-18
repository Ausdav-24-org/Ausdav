import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QuizQuestion = {
  id: number;
  question_text: string;
  language: string;
  quiz_no?: number | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string | null;
  image_path?: string | null;
  created_at: string;
};

export type QuizQuestionFormatted = {
  id: string;
  question: string;
  quiz_no?: number | null;
  options: Array<{
    id: string;
    text: string;
  }>;
  correctOptionId: string;
  image_path?: string | null;
  imageUrl?: string | null;
};

const formatQuestions = (
  questions: QuizQuestion[]
): QuizQuestionFormatted[] => {
  return questions.map((q) => {
    // Resolve image URL if image_path exists
    let imageUrl: string | null = null;
    if (q.image_path) {
      const { data } = supabase.storage
        .from("quiz-question-images")
        .getPublicUrl(q.image_path);
      imageUrl = data?.publicUrl || null;
      console.log(`Image path: ${q.image_path}, Public URL: ${imageUrl}`);
    }

    return {
      id: q.id.toString(),
      question: q.question_text,
      quiz_no: q.quiz_no ?? 1,
      options: [
        { id: "a", text: q.option_a },
        { id: "b", text: q.option_b },
        { id: "c", text: q.option_c },
        { id: "d", text: q.option_d },
      ],
      correctOptionId: q.correct_answer || "",
      image_path: q.image_path,
      imageUrl: imageUrl, // Pre-resolved public URL
    };
  });
};

export const useQuizQuestions = (language: string = "ta") => {
  const [questions, setQuestions] = useState<QuizQuestionFormatted[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchQuestions = async () => {
      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
        }
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

        if (!isMounted) return;

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
        if (!isMounted) return;
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch questions";
        setError(errorMessage);
        console.error("Error fetching quiz questions:", err);
        setQuestions([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // initial fetch
    fetchQuestions();

    // Subscribe to realtime changes on quiz_mcq so all clients auto-refresh
    const channel = supabase
      .channel('quiz_mcq_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_mcq' }, (payload) => {
        console.log('[useQuizQuestions] realtime payload:', payload);
        // Re-fetch to keep logic simple and ensure formatting + image URL resolution
        fetchQuestions();
      })
      .subscribe();

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        // fallback: attempt unsubscribe
        // @ts-ignore
        channel.unsubscribe?.();
      }
    };
  }, [language]);

  return { questions, loading, error };
};
