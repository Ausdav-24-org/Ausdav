import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, Edit2, Trash2, Save, X, Eye, EyeOff, Download, Upload, Loader2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminGrantedPermissions } from '@/hooks/useAdminGrantedPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import QuizAttemptDetailsModal from "@/components/QuizAttemptDetailsModal";

type QuizQuestion = {
  id: number;
  question_text: string;
  language: string;
  quiz_password_id?: number | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string | null;
  image_path?: string | null;
  created_at: string;
  [key: string]: any;
};

type QuestionFormData = {
  question_text: string;
  language: string;
  quiz_password_id: number | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  image_path?: string | null;
  [key: string]: any;
};

type SchoolQuizResult = {
  id: number;
  school_name: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  not_answered: number;
  final_score: number;
  language: string;
  quiz_password_id?: number | null;
  completed_at: string;
  created_at: string;
  quiz_password?: string | null;
};

const AdminQuizPage: React.FC = () => {
  const { language } = useLanguage();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [schoolResults, setSchoolResults] = useState<SchoolQuizResult[]>([]);
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 4800]);
  const [pendingScoreRange, setPendingScoreRange] = useState<[number, number]>([0, 4800]);
  const [sortBy, setSortBy] = useState<'score-desc' | 'score-asc' | 'name-asc' | 'name-desc' | 'time-asc' | 'time-desc'>("score-desc");
  const [resultsQuizFilter, setResultsQuizFilter] = useState<string>("all");
  const [schoolQuizMap, setSchoolQuizMap] = useState<Record<string, number[]>>({});
    // Memoized filtered and sorted results
    const filteredSortedResults = useMemo(() => {
      let results = [...schoolResults];
      // Filter by score range
      results = results.filter(r => r.final_score >= scoreRange[0] && r.final_score <= scoreRange[1]);
      // Filter by quiz (if a specific quiz is selected)
      if (resultsQuizFilter !== 'all') {
        const qid = Number(resultsQuizFilter);
        results = results.filter(r => {
          const arr = schoolQuizMap[(r.school_name || '').trim()] || [];
          return arr.includes(qid);
        });
      }
      // Sort
      switch (sortBy) {
        case 'score-asc':
          results.sort((a, b) => a.final_score - b.final_score);
          break;
        case 'score-desc':
          results.sort((a, b) => b.final_score - a.final_score);
          break;
        case 'name-asc':
          results.sort((a, b) => a.school_name.localeCompare(b.school_name));
          break;
        case 'name-desc':
          results.sort((a, b) => b.school_name.localeCompare(a.school_name));
          break;
        case 'time-asc':
          results.sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
          break;
        case 'time-desc':
          results.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
          break;
      }
      return results;
    }, [schoolResults, scoreRange, sortBy, resultsQuizFilter, schoolQuizMap]);

  // Auto-apply pending score inputs to the active filter and clamp to 0..5000
  useEffect(() => {
    const minVal = Math.max(0, Math.min(5000, pendingScoreRange[0]));
    const maxVal = Math.max(0, Math.min(5000, pendingScoreRange[1]));
    setScoreRange([Math.min(minVal, maxVal), Math.max(minVal, maxVal)]);
  }, [pendingScoreRange]);

  // View mode (default = table). Table mode shows charts + table; Card mode shows the existing cards.
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  // Map of school_name -> total duration in seconds (computed from answers_meta)
  const [schoolDurations, setSchoolDurations] = useState<Record<string, number | null>>({});
  const [loadingDurations, setLoadingDurations] = useState(false);

  const formatSeconds = (s: number | null | undefined) => {
    if (s == null) return '—';
    const minutes = Math.floor(s / 60);
    const seconds = Math.floor(s % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [isQuizEnabled, setIsQuizEnabled] = useState(false);
  // UX: prevent duplicate toggles/deletes by tracking in-progress actions
  const [togglingQuiz, setTogglingQuiz] = useState(false);
  const [deletingQuizPasswordId, setDeletingQuizPasswordId] = useState<number | null>(null);
  const [deletingAllResults, setDeletingAllResults] = useState(false);
  const [isMemberUploadEnabled, setIsMemberUploadEnabled] = useState(false);
  // per-password mode toggling (Test / Quiz)
  const [togglingQuizModeId, setTogglingQuizModeId] = useState<number | null>(null);
  const [togglingQuizModeField, setTogglingQuizModeField] = useState<'is_test' | 'is_quiz' | null>(null);
  const [quizPasswords, setQuizPasswords] = useState<{ id: number; quiz_name: string; password: string; is_test?: boolean; is_quiz?: boolean; duration_minutes?: number | null }[]>([]);
  const [loadingQuizPasswords, setLoadingQuizPasswords] = useState(false);
  const [showQuizPassword, setShowQuizPassword] = useState<{ [id: number]: boolean }>({});
  const [newQuizName, setNewQuizName] = useState("");
  const [newQuizPassword, setNewQuizPassword] = useState("");
  const [newQuizDuration, setNewQuizDuration] = useState("");
  const [savingQuizPassword, setSavingQuizPassword] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [editingQuizName, setEditingQuizName] = useState("");
  const [editingQuizPassword, setEditingQuizPassword] = useState("");
  const [editingQuizDuration, setEditingQuizDuration] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [quizFilter, setQuizFilter] = useState<string>("all");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // UX: per-action loaders for question operations
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<number | null>(null);
  const [selectedQuizResult, setSelectedQuizResult] = useState<SchoolQuizResult | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [formData, setFormData] = useState<QuestionFormData>({
    question_text: "",
    language: "ta",
    quiz_password_id: null,
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "a",
    image_path: null,
  });

  // Role / permission (members with 'quiz' grant get restricted view)
  const { role, isAdmin, isSuperAdmin } = useAdminAuth();
  const { hasPermission } = useAdminGrantedPermissions();
  const isMemberWithQuizGrant = role === 'member' && hasPermission('quiz');
  const isAdminView = isAdmin || isSuperAdmin;

  useEffect(() => {
    fetchQuestions();
    // Fetch school results only for admin/super_admin views
    if (isAdminView) fetchSchoolResults();
    fetchSchoolResults();
    fetchSchoolAnswersMap();
    checkQuizEnabled();
    fetchQuizPasswords();

    // Realtime listener so admin UI updates when questions change elsewhere
    const channel = supabase
      .channel('admin-quiz-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_mcq' }, (payload) => {
        console.log('[AdminQuizPage] realtime quiz_mcq payload:', payload);
        fetchQuestions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdminView]);

  // Fetch answers_meta for visible schools and compute total duration (seconds)
  useEffect(() => {
    if (!filteredSortedResults || filteredSortedResults.length === 0) {
      setSchoolDurations({});
      return;
    }

    let mounted = true;
    const loadDurations = async () => {
      setLoadingDurations(true);
      try {
        // normalize (trim) school names so keys match between results and answers rows
        const names = Array.from(new Set(filteredSortedResults.map(r => (r.school_name || '').trim()).filter(Boolean)));
        if (names.length === 0) {
          if (mounted) setSchoolDurations({});
          return;
        }

        let query = supabase
          .from("school_quiz_answers" as any)
          .select("school_name, answers_meta, created_at, quiz_password_id")
          .in("school_name", names)
          .order("created_at", { ascending: false });

        // apply quiz filter if set
        if (resultsQuizFilter !== 'all') {
          query = query.eq('quiz_password_id', Number(resultsQuizFilter));
        }

        const { data, error } = await query;
        if (error) throw error;

        const map: Record<string, number | null> = {};
        names.forEach(n => (map[n] = null));

        const seen = new Set<string>();
        (data || []).forEach((row: any) => {
          const name = (row.school_name || '').trim();
          if (!name || seen.has(name)) return; // only take the latest per school (data ordered desc)
          seen.add(name);
          const meta = row.answers_meta || {};
          let totalSec = 0;
          let found = false;
          Object.values(meta).forEach((m: any) => {
            if (m && typeof m.secondsTaken === 'number') {
              totalSec += Number(m.secondsTaken || 0);
              found = true;
            }
          });
          map[name] = found ? totalSec : null;
        });

        if (mounted) setSchoolDurations(map);
      } catch (err) {
        console.error('Error fetching school durations:', err);
      } finally {
        if (mounted) setLoadingDurations(false);
      }
    };

    loadDurations();
    return () => { mounted = false; };
  }, [filteredSortedResults, resultsQuizFilter]);

  const checkQuizEnabled = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("allow_exam_applications")
        .single();

      if (error) throw error;
      setIsQuizEnabled(data?.allow_exam_applications || false);
    } catch (error) {
      console.error("Error checking quiz status:", error);
    }
  };

  const toggleQuizAvailability = async () => {
    if (togglingQuiz) return;
    setTogglingQuiz(true);
    try {
      const newStatus = !isQuizEnabled;
      const { error } = await supabase
        .from("app_settings")
        .update({ allow_exam_applications: newStatus })
        .eq("id", 1);

      if (error) throw error;

      setIsQuizEnabled(newStatus);
      toast.success(newStatus ? "Quiz enabled" : "Quiz disabled");
    } catch (error) {
      console.error("Error toggling quiz:", error);
      toast.error("Error occurred");
    } finally {
      setTogglingQuiz(false);
    }
  }; 

  // Fetch all quiz passwords
  const fetchQuizPasswords = async () => {
    try {
      setLoadingQuizPasswords(true);
      const { data, error } = await supabase
        .from("quiz_passwords" as any)
        .select("id, quiz_name, password, is_test, is_quiz, duration_minutes");
      if (error) throw error;
      const rows = (data || []) as unknown as { id: number; quiz_name: string; password: string; is_test?: boolean; is_quiz?: boolean; duration_minutes?: number | null }[];
      setQuizPasswords(rows);
    } catch (error) {
      console.error("Error fetching quiz passwords:", error);
      toast.error("Failed to load quiz passwords");
    } finally {
      setLoadingQuizPasswords(false);
    }
  };

  // Add or update quiz password
  const saveQuizPassword = async () => {
    if (editingQuizId) {
      // Update existing (name/password/duration via edit)
      if (!editingQuizName.trim() || !editingQuizPassword.trim()) {
        toast.error("Enter quiz name and password");
        return;
      }
      try {
        setSavingQuizPassword(true);
        const durationVal = editingQuizDuration.trim() === "" ? null : Number(editingQuizDuration);
        const { error } = await supabase
          .from("quiz_passwords" as any)
          .update({ quiz_name: editingQuizName.trim(), password: editingQuizPassword.trim(), duration_minutes: durationVal })
          .eq("id", editingQuizId);
        if (error) throw error;
        toast.success("Quiz password updated");
        setEditingQuizId(null);
        setEditingQuizName("");
        setEditingQuizPassword("");
        setEditingQuizDuration("");
        fetchQuizPasswords();
      } catch (error) {
        console.error("Error updating quiz password:", error);
        toast.error("Failed to update");
      } finally {
        setSavingQuizPassword(false);
      }
    } else {
      // Add new
      if (!newQuizName.trim() || !newQuizPassword.trim()) {
        toast.error("Enter quiz name and password");
        return;
      }
      try {
        setSavingQuizPassword(true);
        const durationVal = newQuizDuration.trim() === "" ? null : Number(newQuizDuration);
        const { error } = await supabase
          .from("quiz_passwords" as any)
          .insert([{ quiz_name: newQuizName.trim(), password: newQuizPassword.trim(), is_test: false, is_quiz: false, duration_minutes: durationVal }]);
        if (error) throw error;
        toast.success("Quiz password added");
        setNewQuizName("");
        setNewQuizPassword("");
        setNewQuizDuration("");
        fetchQuizPasswords();
      } catch (error) {
        console.error("Error adding quiz password:", error);
        toast.error("Failed to add");
      } finally {
        setSavingQuizPassword(false);
      }
    }
  };

  // Delete quiz password
  const deleteQuizPassword = async (id: number) => {
    if (!window.confirm("Delete this quiz password?")) return;
    if (deletingQuizPasswordId === id) return;
    setDeletingQuizPasswordId(id);
    try {
      const { error } = await supabase.from("quiz_passwords" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Quiz password deleted");
      fetchQuizPasswords();
    } catch (error) {
      console.error("Error deleting quiz password:", error);
      toast.error("Failed to delete");
    } finally {
      setDeletingQuizPasswordId(null);
    }
  };

  // Toggle a quiz password's mode (Test / Quiz). Enforces mutual exclusivity when enabling.
  const toggleQuizMode = async (id: number, field: 'is_test' | 'is_quiz', value: boolean) => {
    if (togglingQuizModeId === id && togglingQuizModeField === field) return;
    setTogglingQuizModeId(id);
    setTogglingQuizModeField(field);
    try {
      const updates: any = { [field]: value };
      if (value) {
        // enable one mode and disable the other to keep modes mutually exclusive
        if (field === 'is_test') updates.is_quiz = false;
        if (field === 'is_quiz') updates.is_test = false;
      }
      const { error } = await supabase.from('quiz_passwords' as any).update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Quiz mode updated');
      fetchQuizPasswords();
    } catch (err) {
      console.error('Error updating quiz mode:', err);
      toast.error('Failed to update quiz mode');
    } finally {
      setTogglingQuizModeId(null);
      setTogglingQuizModeField(null);
    }
  };

  // duration is edited via the quiz "Edit" form now; per-row Set handler removed. 

  const fetchSchoolResults = async () => {
    try {
      setLoadingResults(true);
      const { data, error } = await supabase
        .from("school_quiz_results")
        .select("*")
        .order("final_score", { ascending: false });

      console.log('[fetchSchoolResults] Data:', data);
      if (data) {
        const rifnazRow = data.find(r => r.school_name && r.school_name.toLowerCase().includes('rifnaz'));
        if (rifnazRow) {
          console.log('[fetchSchoolResults] Rifnaz row:', rifnazRow);
        }
      }

      if (error) throw error;
      setSchoolResults(data || []);
      // refresh cached map of which quizzes each school has answers for
      fetchSchoolAnswersMap().catch(err => console.error('fetchSchoolAnswersMap error:', err));
    } catch (error) {
      console.error("Error fetching school results:", error);
      toast.error("Failed to load results");
    } finally {
      setLoadingResults(false);
    }
  };

  // Build a map: school_name -> array of quiz_password_id values (unique)
  const fetchSchoolAnswersMap = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("school_quiz_answers" as any)
        .select("school_name, quiz_password_id")
        .not("quiz_password_id", "is", null);
      if (error) throw error;
      const map: Record<string, number[]> = {};
      (data || []).forEach((row: any) => {
        const name = (row.school_name || "").trim();
        const qid = row.quiz_password_id;
        if (!name || qid == null) return;
        if (!map[name]) map[name] = [];
        if (!map[name].includes(qid)) map[name].push(qid);
      });
      setSchoolQuizMap(map);
    } catch (err) {
      console.error("Error fetching school_quiz_answers map:", err);
    }
  };

  const handleDeleteAllResults = async () => {
    if (deletingAllResults) return;
    const confirmDelete = window.confirm(
      "Are you sure you want to delete ALL school quiz results? This action cannot be undone."
    );
    if (!confirmDelete) return;

    setDeletingAllResults(true);
    try {
      // Fetch all results first to ensure we're deleting the right records
      const { data: allResults, error: fetchError } = await supabase
        .from("school_quiz_results")
        .select("id");

      if (fetchError) {
        console.error("Error fetching results:", fetchError);
        throw fetchError;
      }

      if (allResults && allResults.length > 0) {
        // Delete all records by ID from school_quiz_results
        const ids = allResults.map((r) => r.id);
        const { error: deleteError } = await supabase
          .from("school_quiz_results")
          .delete()
          .in("id", ids);

        if (deleteError) {
          console.error("Delete error:", deleteError);
          throw deleteError;
        }
      }

      // Delete all records from school_quiz_answers
      const { error: deleteAnswersError } = await supabase
        .from("school_quiz_answers" as any)
        .delete()
        .gt("id", 0); // Delete all rows

      if (deleteAnswersError) {
        console.error("Delete answers error:", deleteAnswersError);
        // Continue even if answers delete fails
      }

      // Immediately clear the UI
      setSchoolResults([]);
      // answers were deleted too — refresh the map
      fetchSchoolAnswersMap().catch(() => {});

      toast.success("All school results and answers deleted successfully");

      // Verify deletion by fetching fresh data
      setTimeout(() => fetchSchoolResults(), 500);
    } catch (error) {
      console.error("Error deleting all results:", error);
      toast.error("Failed to delete results. Check console for details.");
    } finally {
      setDeletingAllResults(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quiz_mcq")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!formData.question_text || !formData.option_a || !formData.option_b || !formData.option_c || !formData.option_d) {
      toast.error("Fill all fields");
      return;
    }

    if (savingQuestion) return;
    setSavingQuestion(true);
    try {
      // Always set language to "ta" since questions are language-agnostic
      const { error } = await supabase.from("quiz_mcq").insert([{ ...formData, language: "ta" }]);

      if (error) throw error;

      toast.success("Question added");
      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error("Error adding question:", error);
      toast.error("Failed to add");
    } finally {
      setSavingQuestion(false);
    }
  }; 

  const handleUpdateQuestion = async () => {
    if (!editingId) return;
    if (savingQuestion) return;
    setSavingQuestion(true);

    try {
      const { error } = await supabase
        .from("quiz_mcq")
        .update({ ...formData, language: "ta" })
        .eq("id", editingId);

      if (error) throw error;

      toast.success("Question updated");
      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error("Error updating question:", error);
      toast.error("Failed to update");
    } finally {
      setSavingQuestion(false);
    }
  }; 

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm("Are you sure you want to delete?")) {
      return;
    }
    if (deletingQuestionId === id) return;
    setDeletingQuestionId(id);

    try {
      // Get question to check for image
      const { data: question } = await supabase
        .from("quiz_mcq" as any)
        .select("image_path")
        .eq("id", id)
        .single();

      // Delete image from storage if exists
      if ((question as any)?.image_path) {
        await supabase.storage
          .from("quiz-question-images")
          .remove([(question as any).image_path]);
      }

      // Delete question
      const { error } = await supabase.from("quiz_mcq").delete().eq("id", id);

      if (error) throw error;

      toast.success("Question deleted");
      fetchQuestions();
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete");
    } finally {
      setDeletingQuestionId(null);
    }
  }; 

  const startEdit = (question: QuizQuestion) => {
    setEditingId(question.id);
    setFormData({
      question_text: question.question_text,
      language: question.language,
      quiz_password_id: question.quiz_password_id ?? null,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_answer: question.correct_answer || "a",
      image_path: question.image_path || null,
    });
    
    // Load image preview if exists - use inline getPublicUrl like EventsPage
    if (question.image_path) {
      const { data: imageUrl } = supabase.storage
        .from("quiz-question-images")
        .getPublicUrl(question.image_path);
      setImagePreview(imageUrl?.publicUrl || null);
    } else {
      setImagePreview(null);
    }
    setShowAddForm(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      // Delete old image if exists
      if (formData.image_path) {
        const oldFileName = formData.image_path.split("/").pop();
        if (oldFileName) {
          await supabase.storage
            .from("quiz-question-images")
            .remove([`questions/${oldFileName}`]);
        }
      }

      // Upload new image
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("quiz-question-images")
        .upload(`questions/${fileName}`, file);

      if (uploadError) throw uploadError;

      // Store only the relative path, not the full URL
      const relativePath = `questions/${fileName}`;
      
      setFormData({
        ...formData,
        image_path: relativePath,
      });

      // Show preview using the public URL
      const { data } = supabase.storage
        .from("quiz-question-images")
        .getPublicUrl(relativePath);
      
      const publicUrl = data?.publicUrl;
      if (publicUrl) {
        setImagePreview(publicUrl);
      } else {
        // Fallback to FileReader for preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }

      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async () => {
    try {
      if (formData.image_path) {
        await supabase.storage
          .from("quiz-question-images")
          .remove([formData.image_path]);
      }

      setFormData({
        ...formData,
        image_path: null,
      });
      setImagePreview(null);
      toast.success("Image deleted");
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Failed to delete image");
    }
  };

  const resetForm = () => {
    setFormData({
      question_text: "",
      language: "ta",
      quiz_password_id: null,
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: "a",
      image_path: null,
    });
    setImagePreview(null);
    setEditingId(null);
    setShowAddForm(false);
  };

  const filteredQuestions = useMemo(() => {
    if (quizFilter === "all") return questions;
    const qId = Number(quizFilter);
    return questions.filter((q) => (q.quiz_password_id ?? -1) === qId);
  }, [questions, quizFilter]);

  // Block direct access for members without the grant
  if (role === 'member' && !isMemberWithQuizGrant) {
    return (
      <div className="p-6">
        <AdminHeader title="Quiz Management" breadcrumb="Admin / Quiz" />
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <p className="text-lg font-semibold">Access restricted</p>
          <p className="text-sm text-muted-foreground mt-2">You don't have permission to view this page. Request the <strong>Quiz</strong> permission from a Super Admin.</p>
        </div>
      </div>
    );
  }
  // Chart data derived from filtered/sorted results
  const chartDataScore = useMemo(() => {
    return filteredSortedResults.map(r => ({ name: r.school_name, score: Number(r.final_score), id: r.id }));
  }, [filteredSortedResults]);

  const chartDataDuration = useMemo(() => {
    return filteredSortedResults.map(r => {
      const secs = schoolDurations[(r.school_name || '').trim()] ?? null;
      const durationMin = secs == null ? null : Number((secs / 60).toFixed(2));
      return { name: (r.school_name || '').trim(), durationMin, durationLabel: secs == null ? '—' : `${(secs/60).toFixed(2)} min`, id: r.id };
    });
  }, [filteredSortedResults, schoolDurations]);

  // Shorten long X-axis tick labels (keeps original data/tooltip intact)
  const shortenTickLabel = (value: string | number) => {
    const s = String(value ?? "");
    const max = 5; // max characters to show on the axis tick
    return s.length > max ? s.slice(0, max) + '\u2026' : s;
  };

  return (
    <>
      <AdminHeader title="Quiz Management" breadcrumb="Admin / Quiz" />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-4">
            Quiz Management
          </h1>

          {/* Quiz Enable/Disable Toggle (admin only) */}
          {isAdminView && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      Quiz Availability
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Show/Hide Quiz in navigation bar
                    </p>
                  </div>
                  <Button
                    onClick={toggleQuizAvailability}
                    variant={isQuizEnabled ? "default" : "outline"}
                    className="gap-2"
                    disabled={togglingQuiz}
                  >
                    {togglingQuiz ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : isQuizEnabled ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                    {togglingQuiz ? (isQuizEnabled ? 'Disabling...' : 'Enabling...') : isQuizEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz Passwords - Dynamic List */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Quiz Manipulation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add, edit, or delete quiz passwords and Handling other quiz related stuffs
              </p>
            </CardHeader>
            <CardContent>
              {/* Add new quiz password */}
              <div className="flex flex-col md:flex-row gap-2 mb-4">
                <Input
                  placeholder="Quiz name (e.g. Science 2026)"
                  value={newQuizName}
                  onChange={e => setNewQuizName(e.target.value)}
                  className="md:w-1/3"
                  disabled={savingQuizPassword}
                />
                <div className="relative md:w-1/3">
                  <Input
                    placeholder="Password"
                    type={showQuizPassword[0] ? "text" : "password"}
                    value={newQuizPassword}
                    onChange={e => setNewQuizPassword(e.target.value)}
                    disabled={savingQuizPassword}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary bg-transparent border-none outline-none cursor-pointer p-0"
                    onClick={() => setShowQuizPassword(s => ({ ...s, 0: !s[0] }))}
                    aria-label={showQuizPassword[0] ? "Hide password" : "Show password"}
                  >
                    {showQuizPassword[0] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <Input
                  placeholder="Duration (min)"
                  type="number"
                  min={1}
                  value={newQuizDuration}
                  onChange={e => setNewQuizDuration(e.target.value)}
                  disabled={savingQuizPassword}
                  className="md:w-1/6"
                />

                <Button onClick={saveQuizPassword} disabled={savingQuizPassword} className="md:w-1/6">
                  {savingQuizPassword ? "Saving..." : "Add"}
                </Button>
              </div>
              {/* List all quiz passwords */}
              {loadingQuizPasswords ? (
                <div className="text-muted-foreground py-4">Loading...</div>
              ) : quizPasswords.length === 0 ? (
                <div className="text-muted-foreground py-4">No quiz passwords set</div>
              ) : (
                <div className="space-y-2">
                  {quizPasswords.map(qp => (
                    <div key={qp.id} className="flex items-center gap-2 border rounded px-3 py-2">
                      {editingQuizId === qp.id ? (
                        <>
                          <Input
                            value={editingQuizName}
                            onChange={e => setEditingQuizName(e.target.value)}
                            className="w-1/3"
                          />
                          <div className="relative w-1/3">
                            <Input
                              type={showQuizPassword[qp.id] ? "text" : "password"}
                              value={editingQuizPassword}
                              onChange={e => setEditingQuizPassword(e.target.value)}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary bg-transparent border-none outline-none cursor-pointer p-0"
                              onClick={() => setShowQuizPassword(s => ({ ...s, [qp.id]: !s[qp.id] }))}
                              aria-label={showQuizPassword[qp.id] ? "Hide password" : "Show password"}
                            >
                              {showQuizPassword[qp.id] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                          <Input
                            placeholder="Duration (min)"
                            type="number"
                            min={1}
                            value={editingQuizDuration}
                            onChange={e => setEditingQuizDuration(e.target.value)}
                            className="w-1/6"
                          />
                          <Button size="sm" onClick={saveQuizPassword} className="mr-2">Save</Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingQuizId(null); setEditingQuizName(""); setEditingQuizPassword(""); setEditingQuizDuration(""); }}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <span className="w-1/3 font-semibold">{qp.quiz_name}</span>

                          {/* per-quiz mode toggles */}
                          <div className="flex items-center gap-2 w-1/6">
                            <Button
                              size="sm"
                              variant={qp.is_test ? "default" : "outline"}
                              onClick={() => toggleQuizMode(qp.id, 'is_test', !qp.is_test)}
                              disabled={togglingQuizModeId === qp.id && togglingQuizModeField === 'is_test'}
                              aria-pressed={!!qp.is_test}
                            >
                              {togglingQuizModeId === qp.id && togglingQuizModeField === 'is_test' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                              Test
                            </Button>

                            <Button
                              size="sm"
                              variant={qp.is_quiz ? "default" : "outline"}
                              onClick={() => toggleQuizMode(qp.id, 'is_quiz', !qp.is_quiz)}
                              disabled={togglingQuizModeId === qp.id && togglingQuizModeField === 'is_quiz'}
                              aria-pressed={!!qp.is_quiz}
                            >
                              {togglingQuizModeId === qp.id && togglingQuizModeField === 'is_quiz' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                              Quiz
                            </Button>
                          </div>

                          <div className="relative w-1/4">
                            <Input
                              type={showQuizPassword[qp.id] ? "text" : "password"}
                              value={qp.password}
                              readOnly
                              className="pr-10 bg-muted"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary bg-transparent border-none outline-none cursor-pointer p-0"
                              onClick={() => setShowQuizPassword(s => ({ ...s, [qp.id]: !s[qp.id] }))}
                              aria-label={showQuizPassword[qp.id] ? "Hide password" : "Show password"}
                            >
                              {showQuizPassword[qp.id] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>

                          <div className="flex items-center gap-2 w-1/6">
                            <span className="text-sm">{qp.duration_minutes != null ? `${qp.duration_minutes} mins` : '—'}</span>
                          </div>

                          <Button size="sm" variant="outline" onClick={() => { setEditingQuizId(qp.id); setEditingQuizName(qp.quiz_name); setEditingQuizPassword(qp.password); setEditingQuizDuration(qp.duration_minutes != null ? String(qp.duration_minutes) : ""); }}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteQuizPassword(qp.id)} disabled={deletingQuizPasswordId === qp.id}>
                            {deletingQuizPasswordId === qp.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {isAdminView && (
          <>
          {/* School Quiz Results */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>School Quiz Results</CardTitle>
                {/* View Mode Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="text-xs"
                  >
                    Table
                  </Button>
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('card')}
                    className="text-xs"
                  >
                    Cards
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters and Sorting Controls */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 px-2 py-3 bg-muted/40 rounded-lg border border-muted-foreground/10 shadow-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="font-semibold text-sm text-white mr-2">Score Range</label>
                        <div className="inline-flex items-center bg-[#232b3b] rounded-md overflow-hidden border border-muted-foreground/10">
                          <button
                            type="button"
                            aria-label="Decrease min score"
                            className="px-2 h-9 flex items-center justify-center text-white hover:bg-white/5"
                            onClick={() => setPendingScoreRange([Math.max(0, pendingScoreRange[0] - 1), pendingScoreRange[1]])}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <Input
                            type="number"
                            min={0}
                            max={5000}
                            value={pendingScoreRange[0]}
                            onChange={e => setPendingScoreRange([Number(e.target.value), pendingScoreRange[1]])}
                            className="w-14 h-9 text-sm text-center bg-transparent border-none text-white focus:ring-0 px-0"
                          />
                          <button
                            type="button"
                            aria-label="Increase min score"
                            className="px-2 h-9 flex items-center justify-center text-white hover:bg-white/5"
                            onClick={() => setPendingScoreRange([Math.min(5000, pendingScoreRange[0] + 1), pendingScoreRange[1]])}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="mx-1 text-white">-</span>
                        <div className="inline-flex items-center bg-[#232b3b] rounded-md overflow-hidden border border-muted-foreground/10">
                          <button
                            type="button"
                            aria-label="Decrease max score"
                            className="px-2 h-9 flex items-center justify-center text-white hover:bg-white/5"
                            onClick={() => setPendingScoreRange([pendingScoreRange[0], Math.max(0, pendingScoreRange[1] - 1)])}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <Input
                            type="number"
                            min={0}
                            max={5000}
                            value={pendingScoreRange[1]}
                            onChange={e => setPendingScoreRange([pendingScoreRange[0], Number(e.target.value)])}
                            className="w-14 h-9 text-sm text-center bg-transparent border-none text-white focus:ring-0 px-0"
                          />
                          <button
                            type="button"
                            aria-label="Increase max score"
                            className="px-2 h-9 flex items-center justify-center text-white hover:bg-white/5"
                            onClick={() => setPendingScoreRange([pendingScoreRange[0], Math.min(5000, pendingScoreRange[1] + 50)])}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="font-semibold text-sm text-white mr-2">Quiz</label>
                        <div className="w-44">
                          <Select value={resultsQuizFilter} onValueChange={v => setResultsQuizFilter(v)}>
                            <SelectTrigger className="min-w-[160px] h-9 text-sm px-2 bg-[#232b3b] border-none text-white focus:ring-2 focus:ring-primary">
                              <SelectValue placeholder="All Quizzes" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#232b3b] text-white">
                              <SelectItem value="all">All Quizzes</SelectItem>
                              {quizPasswords.map(qp => (
                                <SelectItem key={qp.id} value={String(qp.id)}>{qp.quiz_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
                    <SelectTrigger className="min-w-[180px] h-9 text-sm px-2 bg-[#232b3b] border-none text-white focus:ring-2 focus:ring-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#232b3b] text-white">
                      <SelectItem value="score-desc">Score (High to Low)</SelectItem>
                      <SelectItem value="score-asc">Score (Low to High)</SelectItem>
                      <SelectItem value="name-asc">School Name (A-Z)</SelectItem>
                      <SelectItem value="name-desc">School Name (Z-A)</SelectItem>
                      <SelectItem value="time-asc">Finished Time (First to Last)</SelectItem>
                      <SelectItem value="time-desc">Finished Time (Last to First)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Card Mode */}
              {viewMode === 'card' && (
                <>
                  {loadingResults ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading...
                    </div>
                  ) : filteredSortedResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No results found
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredSortedResults.map((result, index) => (
                        <motion.div
                          key={result.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card 
                            className={`relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                              index === 0 ? 'border-yellow-500 border-2 shadow-lg' :
                              index === 1 ? 'border-gray-400 border-2' :
                              index === 2 ? 'border-orange-600 border-2' :
                              'border-primary/20'
                            }`}
                            onClick={async () => {
                              let quizPasswordId = 0;
                              try {
                                const { data, error } = await (supabase as any)
                                  .from("school_quiz_answers" as any)
                                  .select("quiz_password_id")
                                  .eq("school_name", result.school_name)
                                  .order("created_at", { ascending: false })
                                  .limit(1);
                                if (data && data.length > 0) {
                                  quizPasswordId = data[0].quiz_password_id;
                                }
                              } catch (e) {
                                // fallback
                              }
                              setSelectedQuizResult({ ...result, quiz_password_id: quizPasswordId });
                              setShowDetailsModal(true);
                            }}
                          >
                            <CardContent className="pt-6">
                              {index < 3 && (
                                <div className="absolute top-2 right-2">
                                  <div className={`text-2xl ${
                                    index === 0 ? '🥇' :
                                    index === 1 ? '🥈' :
                                    '🥉'
                                  }`}></div>
                                </div>
                              )}
                              <div className="space-y-2">
                                <h3 className="font-bold text-lg text-primary line-clamp-1">
                                  {result.school_name}
                                </h3>
                                <div className="text-3xl font-bold text-center my-4">
                                  {result.final_score.toFixed(1)}
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  <div className="flex justify-between">
                                    <span>Correct:</span>
                                    <span className="font-semibold text-green-600">{result.correct_answers}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Wrong:</span>
                                    <span className="font-semibold text-red-600">{result.wrong_answers}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Not Answered:</span>
                                    <span className="font-semibold text-yellow-600">{result.not_answered}</span>
                                  </div>
                                  <div className="flex justify-between border-t pt-1 mt-2">
                                    <span>Total:</span>
                                    <span className="font-semibold">{result.total_questions}</span>
                                  </div>
                                  <div className="text-xs text-center mt-2 text-muted-foreground">
                                    {new Date(result.completed_at).toLocaleString()}
                                  </div>
                                </div>
                                <div className="mt-4 pt-3 border-t">
                                  <p className="text-xs text-center text-primary font-semibold cursor-pointer hover:underline">
                                    Click to view details →
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Table Mode */}
              {viewMode === 'table' && (
                <>
                  {/* Charts */}
                  {!loadingResults && filteredSortedResults.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      {/* School vs Score Chart */}
                      <div className="bg-muted/40 rounded-lg p-4 border border-muted-foreground/10">
                        <h3 className="text-sm font-semibold mb-4 text-foreground">School vs Score</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartDataScore} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis 
                              dataKey="name" 
                              angle={-45} 
                              textAnchor="end" 
                              height={1}
                              tick={{ fontSize: 12, fill: '#888' }}
                              tickFormatter={shortenTickLabel}
                            />
                            <YAxis tick={{ fontSize: 12, fill: '#888' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }} />
                            <Bar dataKey="score" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                              <LabelList dataKey="score" position="top" fill="#fff" fontSize={12} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* School vs Duration Chart */}
                      <div className="bg-muted/40 rounded-lg p-4 border border-muted-foreground/10">
                        <h3 className="text-sm font-semibold mb-4 text-foreground">School vs Duration (minutes)</h3>
                        {loadingDurations ? (
                          <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
                            Loading durations...
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartDataDuration} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                              <XAxis 
                                dataKey="name" 
                                angle={-45} 
                                textAnchor="end" 
                                height={1}
                                tick={{ fontSize: 12, fill: '#888' }}
                                tickFormatter={shortenTickLabel}
                              />
                              <YAxis tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(v) => `${v}`} />
                              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }} formatter={(value: any) => (value == null ? '—' : `${value} min`)} />
                              <Bar dataKey="durationMin" fill="#10b981" radius={[8, 8, 0, 0]}>
                                <LabelList dataKey="durationLabel" position="top" fill="#fff" fontSize={12} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Table */}
                  {loadingResults ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading...
                    </div>
                  ) : filteredSortedResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No results found
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 border-b border-muted-foreground/10">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">School Name</th>
                            <th className="px-4 py-3 text-right font-semibold">Score</th>
                            <th className="px-4 py-3 text-center font-semibold">Duration</th>
                            <th className="px-4 py-3 text-center font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSortedResults.map((result, idx) => (
                            <tr key={result.id} className="border-b border-muted-foreground/5 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 font-medium">{result.school_name}</td>
                              <td className="px-4 py-3 text-right font-semibold text-primary">{result.final_score.toFixed(1)}</td>
                              <td className="px-4 py-3 text-center text-muted-foreground">
                                {formatSeconds(schoolDurations[(result.school_name || '').trim()])}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    let quizPasswordId = 0;
                                    try {
                                      const { data, error } = await (supabase as any)
                                        .from("school_quiz_answers" as any)
                                        .select("quiz_password_id")
                                        .eq("school_name", result.school_name)
                                        .order("created_at", { ascending: false })
                                        .limit(1);
                                      if (data && data.length > 0) {
                                        quizPasswordId = data[0].quiz_password_id;
                                      }
                                    } catch (e) {
                                      // fallback
                                    }
                                    setSelectedQuizResult({ ...result, quiz_password_id: quizPasswordId });
                                    setShowDetailsModal(true);
                                  }}
                                  className="text-xs"
                                >
                                  View Details
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          </>
          )}

          {/* Delete All School Results (admin only) */}
          {isAdminView && (
            <Card className="mb-6 border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">
                  Danger Zone - Delete All Results
                </CardTitle>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  Permanently delete all school quiz results. This action cannot be undone.
                </p>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleDeleteAllResults}
                  variant="destructive"
                  className="gap-2"
                  disabled={deletingAllResults}
                >
                  {deletingAllResults ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deletingAllResults ? 'Deleting...' : 'Delete All Results'}
                </Button>
              </CardContent>
            </Card>
          )}
          {(isAdminView || isMemberWithQuizGrant) && (
            <div className="flex justify-end mb-6">
              <Button
                onClick={() => {
                  if (showAddForm) {
                    resetForm();
                  } else {
                    setEditingId(null);
                    setShowAddForm(true);
                  }
                }}
                className="gap-2"
                variant={showAddForm && !editingId ? "outline" : "default"}
              >
                {showAddForm && !editingId ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddForm && !editingId
                  ? language === "ta"
                    ? "மூடு"
                    : "Cancel"
                  : language === "ta"
                  ? "புதிய கேள்வி"
                  : "Add Question"}
              </Button>
            </div>
          )}

          {/* Add New Question Form - Only show when adding new, not editing */}
          {(isAdminView || isMemberWithQuizGrant) && showAddForm && !editingId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>
                    {editingId
                      ? "Edit Question"
                      : "Add New Question"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quiz</Label>
                    <Select
                      value={formData.quiz_password_id ? String(formData.quiz_password_id) : ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, quiz_password_id: Number(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select quiz" />
                      </SelectTrigger>
                      <SelectContent>
                        {quizPasswords.length === 0 ? (
                          <SelectItem value="" disabled>No quizzes available</SelectItem>
                        ) : (
                          quizPasswords.map(qp => (
                            <SelectItem key={qp.id} value={String(qp.id)}>{qp.quiz_name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Question</Label>
                    <Textarea
                      value={formData.question_text}
                      onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                      placeholder="Enter question"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Option A</Label>
                      <Input
                        value={formData.option_a}
                        onChange={(e) => setFormData({ ...formData, option_a: e.target.value })}
                        placeholder="Option A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option B</Label>
                      <Input
                        value={formData.option_b}
                        onChange={(e) => setFormData({ ...formData, option_b: e.target.value })}
                        placeholder="Option B"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option C</Label>
                      <Input
                        value={formData.option_c}
                        onChange={(e) => setFormData({ ...formData, option_c: e.target.value })}
                        placeholder="Option C"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option D</Label>
                      <Input
                        value={formData.option_d}
                        onChange={(e) => setFormData({ ...formData, option_d: e.target.value })}
                        placeholder="Option D"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <Select
                      value={formData.correct_answer}
                      onValueChange={(value) => setFormData({ ...formData, correct_answer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a">Option A</SelectItem>
                        <SelectItem value="b">Option B</SelectItem>
                        <SelectItem value="c">Option C</SelectItem>
                        <SelectItem value="d">Option D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Question Image (Optional)</Label>
                    <div className="border-2 border-dashed border-primary/30 rounded-lg p-4">
                      {imagePreview ? (
                        <div className="space-y-4">
                          <div className="relative bg-muted/30 rounded-lg p-4 flex items-center justify-center">
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className="max-h-64 max-w-full rounded-lg object-contain"
                            />
                          </div>
                          <div className="flex gap-2 justify-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file);
                              }}
                              disabled={uploadingImage}
                              className="hidden"
                              id="image-change"
                            />
                            <label htmlFor="image-change">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={uploadingImage}
                                asChild
                              >
                                <span className="cursor-pointer">
                                  <Upload className="w-4 h-4 mr-2" />
                                  {uploadingImage ? "Uploading..." : "Change Image"}
                                </span>
                              </Button>
                            </label>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={handleDeleteImage}
                              disabled={uploadingImage}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Image
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file);
                            }}
                            disabled={uploadingImage}
                            className="hidden"
                            id="image-upload"
                          />
                          <label
                            htmlFor="image-upload"
                            className="flex flex-col items-center justify-center cursor-pointer py-8"
                          >
                            <Upload className="w-12 h-12 text-primary/60 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">
                              {uploadingImage ? "Uploading..." : "Click to upload image"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              PNG, JPG up to 5MB
                            </p>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={resetForm} disabled={savingQuestion}>
                      Cancel
                    </Button>
                    <Button
                      onClick={editingId ? handleUpdateQuestion : handleAddQuestion}
                      className="gap-2"
                      disabled={savingQuestion}
                    >
                      {savingQuestion ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {savingQuestion ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update' : 'Add')}
                    </Button> 
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>

        {/* Questions List */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h2 className="text-2xl font-semibold">
              Questions List
              <span className="text-sm text-muted-foreground ml-2">({filteredQuestions.length})</span>
            </h2>
            <div className="w-full md:w-48">
              <Select
                value={quizFilter}
                onValueChange={(value) => setQuizFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quizzes</SelectItem>
                  {quizPasswords.map(qp => (
                    <SelectItem key={qp.id} value={String(qp.id)}>{qp.quiz_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">
                  Loading...
                </p>
              </CardContent>
            </Card>
          ) : filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">
                  No questions available
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredQuestions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card>
                  <CardContent className="pt-6">
                    {/* Edit Form - shown when this question is being edited */}
                    {editingId === question.id ? (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Edit Question</h3>

                        <div className="space-y-2">
                          <Label>Quiz</Label>
                          <Select
                            value={formData.quiz_password_id ? String(formData.quiz_password_id) : ""}
                            onValueChange={(value) =>
                              setFormData({ ...formData, quiz_password_id: Number(value) })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select quiz" />
                            </SelectTrigger>
                            <SelectContent>
                              {quizPasswords.length === 0 ? (
                                <SelectItem value="" disabled>No quizzes available</SelectItem>
                              ) : (
                                quizPasswords.map(qp => (
                                  <SelectItem key={qp.id} value={String(qp.id)}>{qp.quiz_name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Question</Label>
                          <Textarea
                            value={formData.question_text}
                            onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                            placeholder="Enter question"
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Option A</Label>
                            <Input
                              value={formData.option_a}
                              onChange={(e) => setFormData({ ...formData, option_a: e.target.value })}
                              placeholder="Option A"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Option B</Label>
                            <Input
                              value={formData.option_b}
                              onChange={(e) => setFormData({ ...formData, option_b: e.target.value })}
                              placeholder="Option B"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Option C</Label>
                            <Input
                              value={formData.option_c}
                              onChange={(e) => setFormData({ ...formData, option_c: e.target.value })}
                              placeholder="Option C"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Option D</Label>
                            <Input
                              value={formData.option_d}
                              onChange={(e) => setFormData({ ...formData, option_d: e.target.value })}
                              placeholder="Option D"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Correct Answer</Label>
                          <Select
                            value={formData.correct_answer}
                            onValueChange={(value) => setFormData({ ...formData, correct_answer: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="a">Option A</SelectItem>
                              <SelectItem value="b">Option B</SelectItem>
                              <SelectItem value="c">Option C</SelectItem>
                              <SelectItem value="d">Option D</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Question Image (Optional)</Label>
                          <div className="border-2 border-dashed border-primary/30 rounded-lg p-4">
                            {imagePreview ? (
                              <div className="space-y-4">
                                <div className="relative bg-muted/30 rounded-lg p-4 flex items-center justify-center">
                                  <img 
                                    src={imagePreview} 
                                    alt="Preview" 
                                    className="max-h-64 max-w-full rounded-lg object-contain"
                                  />
                                </div>
                                <div className="flex gap-2 justify-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleImageUpload(file);
                                    }}
                                    disabled={uploadingImage}
                                    className="hidden"
                                    id="image-change"
                                  />
                                  <label htmlFor="image-change">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={uploadingImage}
                                      asChild
                                    >
                                      <span className="cursor-pointer">
                                        <Upload className="w-4 h-4 mr-2" />
                                        {uploadingImage ? "Uploading..." : "Change Image"}
                                      </span>
                                    </Button>
                                  </label>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteImage}
                                    disabled={uploadingImage}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Image
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageUpload(file);
                                  }}
                                  disabled={uploadingImage}
                                  className="hidden"
                                  id="image-upload"
                                />
                                <label
                                  htmlFor="image-upload"
                                  className="flex flex-col items-center justify-center cursor-pointer py-8"
                                >
                                  <Upload className="w-12 h-12 text-primary/60 mb-3" />
                                  <p className="text-sm font-medium text-muted-foreground">
                                    {uploadingImage ? "Uploading..." : "Click to upload image"}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    PNG, JPG up to 5MB
                                  </p>
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setEditingId(null);
                              setImagePreview(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleUpdateQuestion}
                            className="gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Update
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Question Display - shown when not editing */
                      <div className="flex justify-between items-start gap-4">
                        {/* Image Section */}
                        {question.image_path && (() => {
                          const { data: imageUrl } = supabase.storage
                            .from("quiz-question-images")
                            .getPublicUrl(question.image_path);
                          
                          return (
                            <div className="flex-shrink-0">
                              <img 
                                src={imageUrl?.publicUrl} 
                                alt="Question" 
                                className="max-h-40 max-w-40 rounded-lg object-cover border border-primary/20"
                              />
                            </div>
                          );
                        })()}
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-lg">Q{index + 1}.</span>
                            <span className="text-xs bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded">
                              {quizPasswords.find(qp => qp.id === question.quiz_password_id)?.quiz_name || "Unknown Quiz"}
                            </span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {question.language === "ta" ? "Tamil" : "English"}
                            </span>
                            {question.image_path && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                                📸 Has Image
                              </span>
                            )}
                          </div>
                          <p className="font-semibold mb-4">{question.question_text}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className={`flex items-center gap-2 ${question.correct_answer === 'a' ? 'bg-green-100 dark:bg-green-900/20 p-2 rounded' : ''}`}>
                              <span className="font-bold text-sm bg-primary/20 px-2 py-1 rounded">A</span>
                              <span className="text-sm">{question.option_a}</span>
                              {question.correct_answer === 'a' && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-bold">✓ Correct</span>}
                            </div>
                            <div className={`flex items-center gap-2 ${question.correct_answer === 'b' ? 'bg-green-100 dark:bg-green-900/20 p-2 rounded' : ''}`}>
                              <span className="font-bold text-sm bg-primary/20 px-2 py-1 rounded">B</span>
                              <span className="text-sm">{question.option_b}</span>
                              {question.correct_answer === 'b' && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-bold">✓ Correct</span>}
                            </div>
                            <div className={`flex items-center gap-2 ${question.correct_answer === 'c' ? 'bg-green-100 dark:bg-green-900/20 p-2 rounded' : ''}`}>
                              <span className="font-bold text-sm bg-primary/20 px-2 py-1 rounded">C</span>
                              <span className="text-sm">{question.option_c}</span>
                              {question.correct_answer === 'c' && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-bold">✓ Correct</span>}
                            </div>
                            <div className={`flex items-center gap-2 ${question.correct_answer === 'd' ? 'bg-green-100 dark:bg-green-900/20 p-2 rounded' : ''}`}>
                              <span className="font-bold text-sm bg-primary/20 px-2 py-1 rounded">D</span>
                              <span className="text-sm">{question.option_d}</span>
                              {question.correct_answer === 'd' && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-bold">✓ Correct</span>}
                            </div>
                          </div>
                        </div>
                        {isAdminView && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(question)}
                              className="gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteQuestion(question.id)}
                              className="gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Quiz Attempt Details Modal */}
      {selectedQuizResult && (
        <QuizAttemptDetailsModal
          schoolName={selectedQuizResult.school_name}
          quizPasswordId={selectedQuizResult.quiz_password_id ?? 0}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedQuizResult(null);
          }}
        />
      )}
      </div>
    </>
  );
};

export default AdminQuizPage;

