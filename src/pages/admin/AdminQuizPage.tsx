import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Edit2, Trash2, Save, X, Eye, EyeOff, Download, Upload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";

type QuizQuestion = {
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
  [key: string]: any;
};

type QuestionFormData = {
  question_text: string;
  language: string;
  quiz_no: number;
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
  completed_at: string;
  created_at: string;
  quiz_password?: string | null;
};

const AdminQuizPage: React.FC = () => {
  const { language } = useLanguage();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [schoolResults, setSchoolResults] = useState<SchoolQuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [isQuizEnabled, setIsQuizEnabled] = useState(false);
  const [isMemberUploadEnabled, setIsMemberUploadEnabled] = useState(false);
  const [quizPassword, setQuizPassword] = useState("");
  const [loadingQuizPassword, setLoadingQuizPassword] = useState(false);
  const [savingQuizPassword, setSavingQuizPassword] = useState(false);
  const [quizPasswordQuizNo, setQuizPasswordQuizNo] = useState<1 | 2>(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [quizFilter, setQuizFilter] = useState<"all" | "1" | "2">("all");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<QuestionFormData>({
    question_text: "",
    language: "ta",
    quiz_no: 1,
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "a",
    image_path: null,
  });

  useEffect(() => {
    fetchQuestions();
    fetchSchoolResults();
    checkQuizEnabled();
    fetchQuizPassword();
  }, []);

  useEffect(() => {
    fetchQuizPassword();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizPasswordQuizNo]);

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
    }
  };

  const fetchQuizPassword = async () => {
    try {
      setLoadingQuizPassword(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("quiz_password_1, quiz_password_2")
        .single();

      if (error) throw error;

      const settings = data as { quiz_password_1?: string | null; quiz_password_2?: string | null };
      const pwd = quizPasswordQuizNo === 1 ? settings?.quiz_password_1 : settings?.quiz_password_2;
      setQuizPassword(pwd || "");
    } catch (error) {
      console.error("Error fetching quiz password:", error);
      toast.error("Failed to load password");
    } finally {
      setLoadingQuizPassword(false);
    }
  };

  const saveQuizPassword = async () => {
    if (!quizPassword.trim()) {
      toast.error("Enter a password");
      return;
    }

    try {
      setSavingQuizPassword(true);
      const { error } = await supabase
        .from("app_settings" as any)
        .update(
          quizPasswordQuizNo === 1
            ? ({ quiz_password_1: quizPassword.trim() } as any)
            : ({ quiz_password_2: quizPassword.trim() } as any)
        )
        .eq("id", 1);

      if (error) throw error;

      toast.success("Password updated");
    } catch (error) {
      console.error("Error saving quiz password:", error);
      toast.error("Failed to save");
    } finally {
      setSavingQuizPassword(false);
    }
  };

  const fetchSchoolResults = async () => {
    try {
      setLoadingResults(true);
      const { data, error } = await supabase
        .from("school_quiz_results")
        .select("*")
        .order("final_score", { ascending: false });

      if (error) throw error;
      setSchoolResults(data || []);
    } catch (error) {
      console.error("Error fetching school results:", error);
      toast.error("Failed to load results");
    } finally {
      setLoadingResults(false);
    }
  };

  const handleDeleteAllResults = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete ALL school quiz results? This action cannot be undone."
    );
    
    if (!confirmDelete) return;

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

      // Also delete all individual answers from school_quiz_answers table
      const { error: deleteAnswersError } = await (supabase.rpc as any)('delete_all_quiz_answers');

      if (deleteAnswersError) {
        console.error("Delete answers error:", deleteAnswersError);
        // Continue even if answers delete fails
      }

      // Immediately clear the UI
      setSchoolResults([]);
      
      toast.success("All school results and answers deleted successfully");
      
      // Verify deletion by fetching fresh data
      setTimeout(() => fetchSchoolResults(), 500);
    } catch (error) {
      console.error("Error deleting all results:", error);
      toast.error("Failed to delete results. Check console for details.");
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
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingId) return;

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
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm("Are you sure you want to delete?")) {
      return;
    }

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
    }
  };

  const startEdit = (question: QuizQuestion) => {
    setEditingId(question.id);
    setFormData({
      question_text: question.question_text,
      language: question.language,
      quiz_no: question.quiz_no ?? 1,
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
      quiz_no: 1,
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
    const qNo = Number(quizFilter);
    return questions.filter((q) => (q.quiz_no ?? 1) === qNo);
  }, [questions, quizFilter]);

  return (
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

          {/* Quiz Enable/Disable Toggle */}
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
                >
                  {isQuizEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {isQuizEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quiz Password */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Quiz Password</CardTitle>
              <p className="text-sm text-muted-foreground">
                Set a password required to start the quiz
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quiz-select">Quiz</Label>
                  <Select
                    value={String(quizPasswordQuizNo)}
                    onValueChange={(value) => setQuizPasswordQuizNo(Number(value) as 1 | 2)}
                  >
                    <SelectTrigger id="quiz-select">
                      <SelectValue placeholder="Select quiz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Quiz 1</SelectItem>
                      <SelectItem value="2">Quiz 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-password">Password</Label>
                  <Input
                    id="quiz-password"
                    type="text"
                    value={quizPassword}
                    onChange={(e) => setQuizPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={loadingQuizPassword || savingQuizPassword}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={fetchQuizPassword}
                  disabled={loadingQuizPassword || savingQuizPassword}
                >
                  {loadingQuizPassword ? "Loading..." : "Reload"}
                </Button>
                <Button
                  onClick={saveQuizPassword}
                  disabled={savingQuizPassword}
                >
                  {savingQuizPassword ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* School Quiz Results */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                School Quiz Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingResults ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : schoolResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No results yet
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {schoolResults.map((result, index) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={`relative overflow-hidden ${
                        index === 0 ? 'border-yellow-500 border-2 shadow-lg' :
                        index === 1 ? 'border-gray-400 border-2' :
                        index === 2 ? 'border-orange-600 border-2' :
                        'border-primary/20'
                      }`}>
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
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete All School Results */}
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
              >
                <Trash2 className="w-4 h-4" />
                Delete All Results
              </Button>
            </CardContent>
          </Card>
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

          {/* Add New Question Form - Only show when adding new, not editing */}
          {showAddForm && !editingId && (
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
                      value={String(formData.quiz_no)}
                      onValueChange={(value) =>
                        setFormData({ ...formData, quiz_no: Number(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select quiz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Quiz 1</SelectItem>
                        <SelectItem value="2">Quiz 2</SelectItem>
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
                    <Button variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button
                      onClick={editingId ? handleUpdateQuestion : handleAddQuestion}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingId
                        ? "Update"
                        : "Add"}
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
                onValueChange={(value) => setQuizFilter(value as "all" | "1" | "2")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quizzes</SelectItem>
                  <SelectItem value="1">Quiz 1</SelectItem>
                  <SelectItem value="2">Quiz 2</SelectItem>
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
                            value={String(formData.quiz_no)}
                            onValueChange={(value) =>
                              setFormData({ ...formData, quiz_no: Number(value) })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select quiz" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Quiz 1</SelectItem>
                              <SelectItem value="2">Quiz 2</SelectItem>
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
                              Quiz {question.quiz_no ?? 1}
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
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminQuizPage;
