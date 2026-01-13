import React, { useState, useEffect } from "react";
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
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string | null;
  created_at: string;
};

type QuestionFormData = {
  question_text: string;
  language: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
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
};

const AdminQuizPage: React.FC = () => {
  const { language } = useLanguage();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [schoolResults, setSchoolResults] = useState<SchoolQuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [isQuizEnabled, setIsQuizEnabled] = useState(false);
  const [isMemberUploadEnabled, setIsMemberUploadEnabled] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<QuestionFormData>({
    question_text: "",
    language: "ta",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "a",
  });

  useEffect(() => {
    fetchQuestions();
    fetchSchoolResults();
    checkQuizEnabled();
  }, []);

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
      toast.success(
        newStatus
          ? language === "ta"
            ? "Quiz இயக்கப்பட்டது"
            : "Quiz enabled"
          : language === "ta"
          ? "Quiz முடக்கப்பட்டது"
          : "Quiz disabled"
      );
    } catch (error) {
      console.error("Error toggling quiz:", error);
      toast.error(language === "ta" ? "பிழை ஏற்பட்டது" : "Error occurred");
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
      toast.error(language === "ta" ? "முடிவுகளை ஏற்ற முடியவில்லை" : "Failed to load results");
    } finally {
      setLoadingResults(false);
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
      toast.error(language === "ta" ? "கேள்விகளை ஏற்ற முடியவில்லை" : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!formData.question_text || !formData.option_a || !formData.option_b || !formData.option_c || !formData.option_d) {
      toast.error(language === "ta" ? "அனைத்து புலங்களையும் நிரப்பவும்" : "Fill all fields");
      return;
    }

    try {
      const { error } = await supabase.from("quiz_mcq").insert([formData]);

      if (error) throw error;

      toast.success(language === "ta" ? "கேள்வி சேர்க்கப்பட்டது" : "Question added");
      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error("Error adding question:", error);
      toast.error(language === "ta" ? "சேர்க்க முடியவில்லை" : "Failed to add");
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from("quiz_mcq")
        .update(formData)
        .eq("id", editingId);

      if (error) throw error;

      toast.success(language === "ta" ? "கேள்வி புதுப்பிக்கப்பட்டது" : "Question updated");
      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error("Error updating question:", error);
      toast.error(language === "ta" ? "புதுப்பிக்க முடியவில்லை" : "Failed to update");
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm(language === "ta" ? "நிச்சயமாக நீக்க வேண்டுமா?" : "Are you sure you want to delete?")) {
      return;
    }

    try {
      const { error } = await supabase.from("quiz_mcq").delete().eq("id", id);

      if (error) throw error;

      toast.success(language === "ta" ? "கேள்வி நீக்கப்பட்டது" : "Question deleted");
      fetchQuestions();
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error(language === "ta" ? "நீக்க முடியவில்லை" : "Failed to delete");
    }
  };

  const startEdit = (question: QuizQuestion) => {
    setEditingId(question.id);
    setFormData({
      question_text: question.question_text,
      language: question.language,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_answer: question.correct_answer || "a",
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      question_text: "",
      language: "ta",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: "a",
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-4">
            {language === "ta" ? "Quiz நிர்வாகம்" : "Quiz Management"}
          </h1>

          {/* Quiz Enable/Disable Toggle */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    {language === "ta" ? "Quiz கிடைக்கும் தன்மை" : "Quiz Availability"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === "ta"
                      ? "Navigation bar இல் Quiz காட்ட/மறைக்க"
                      : "Show/Hide Quiz in navigation bar"}
                  </p>
                </div>
                <Button
                  onClick={toggleQuizAvailability}
                  variant={isQuizEnabled ? "default" : "outline"}
                  className="gap-2"
                >
                  {isQuizEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {isQuizEnabled
                    ? language === "ta"
                      ? "இயக்கத்தில்"
                      : "Enabled"
                    : language === "ta"
                    ? "முடக்கப்பட்டது"
                    : "Disabled"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* School Quiz Results */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                {language === "ta" ? "பள்ளி வினாடிவினா முடிவுகள்" : "School Quiz Results"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingResults ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === "ta" ? "ஏற்றுகிறது..." : "Loading..."}
                </div>
              ) : schoolResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === "ta" ? "முடிவுகள் இல்லை" : "No results yet"}
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
                                <span>{language === "ta" ? "சரியான பதில்கள்:" : "Correct:"}</span>
                                <span className="font-semibold text-green-600">{result.correct_answers}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{language === "ta" ? "தவறான பதில்கள்:" : "Wrong:"}</span>
                                <span className="font-semibold text-red-600">{result.wrong_answers}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{language === "ta" ? "பதிலளிக்கவில்லை:" : "Not Answered:"}</span>
                                <span className="font-semibold text-yellow-600">{result.not_answered}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1 mt-2">
                                <span>{language === "ta" ? "மொத்தம்:" : "Total:"}</span>
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

          {/* Add Question Button */}
          <div className="flex justify-end mb-6">
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-2"
              variant={showAddForm ? "outline" : "default"}
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddForm
                ? language === "ta"
                  ? "மூடு"
                  : "Cancel"
                : language === "ta"
                ? "புதிய கேள்வி"
                : "Add Question"}
            </Button>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>
                    {editingId
                      ? language === "ta"
                        ? "கேள்வி திருத்து"
                        : "Edit Question"
                      : language === "ta"
                      ? "புதிய கேள்வி சேர்"
                      : "Add New Question"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "ta" ? "மொழி" : "Language"}</Label>
                      <Select
                        value={formData.language}
                        onValueChange={(value) => setFormData({ ...formData, language: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ta" ? "சரியான விடை" : "Correct Answer"}</Label>
                      <Select
                        value={formData.correct_answer}
                        onValueChange={(value) => setFormData({ ...formData, correct_answer: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a">{language === "ta" ? "விருப்பம் A" : "Option A"}</SelectItem>
                          <SelectItem value="b">{language === "ta" ? "விருப்பம் B" : "Option B"}</SelectItem>
                          <SelectItem value="c">{language === "ta" ? "விருப்பம் C" : "Option C"}</SelectItem>
                          <SelectItem value="d">{language === "ta" ? "விருப்பம் D" : "Option D"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{language === "ta" ? "கேள்வி" : "Question"}</Label>
                    <Textarea
                      value={formData.question_text}
                      onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                      placeholder={language === "ta" ? "கேள்வியை உள்ளிடவும்" : "Enter question"}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "ta" ? "விருப்பம் A" : "Option A"}</Label>
                      <Input
                        value={formData.option_a}
                        onChange={(e) => setFormData({ ...formData, option_a: e.target.value })}
                        placeholder="Option A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ta" ? "விருப்பம் B" : "Option B"}</Label>
                      <Input
                        value={formData.option_b}
                        onChange={(e) => setFormData({ ...formData, option_b: e.target.value })}
                        placeholder="Option B"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ta" ? "விருப்பம் C" : "Option C"}</Label>
                      <Input
                        value={formData.option_c}
                        onChange={(e) => setFormData({ ...formData, option_c: e.target.value })}
                        placeholder="Option C"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ta" ? "விருப்பம் D" : "Option D"}</Label>
                      <Input
                        value={formData.option_d}
                        onChange={(e) => setFormData({ ...formData, option_d: e.target.value })}
                        placeholder="Option D"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={resetForm}>
                      {language === "ta" ? "ரத்து செய்" : "Cancel"}
                    </Button>
                    <Button
                      onClick={editingId ? handleUpdateQuestion : handleAddQuestion}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingId
                        ? language === "ta"
                          ? "புதுப்பி"
                          : "Update"
                        : language === "ta"
                        ? "சேர்"
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
          <h2 className="text-2xl font-semibold mb-4">
            {language === "ta" ? "கேள்விகள் பட்டியல்" : "Questions List"}
            <span className="text-sm text-muted-foreground ml-2">({questions.length})</span>
          </h2>

          {loading ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">
                  {language === "ta" ? "ஏற்றுகிறது..." : "Loading..."}
                </p>
              </CardContent>
            </Card>
          ) : questions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">
                  {language === "ta" ? "கேள்விகள் இல்லை" : "No questions available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            questions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-lg">Q{index + 1}.</span>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {question.language === "ta" ? "தமிழ்" : "English"}
                          </span>
                        </div>
                        <p className="font-semibold mb-4">{question.question_text}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className={`flex items-center gap-2 ${question.correct_answer === 'a' ? 'bg-green-100 dark:bg-green-900/20 p-2 rounded' : ''}`}>
                            <span className="font-bold text-sm bg-primary/20 px-2 py-1 rounded">A</span>
                            <span className="text-sm">{question.option_a}</span>
                            {question.correct_answer === 'a' && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-bold">✓ {language === "ta" ? "சரி" : "Correct"}</span>}
                          </div>
                          <div className={`flex items-center gap-2 ${question.correct_answer === 'b' ? 'bg-green-100 dark:bg-green-900/20 p-2 rounded' : ''}`}>
                            <span className="font-bold text-sm bg-primary/20 px-2 py-1 rounded">B</span>
                            <span className="text-sm">{question.option_b}</span>
                            {question.correct_answer === 'b' && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-bold">✓ {language === "ta" ? "சரி" : "Correct"}</span>}
                          </div>
                          <div className={`flex items-center gap-2 ${question.correct_answer === 'c' ? 'bg-green-100 dark:bg-green-900/20 p-2 rounded' : ''}`}>
                            <span className="font-bold text-sm bg-primary/20 px-2 py-1 rounded">C</span>
                            <span className="text-sm">{question.option_c}</span>
                            {question.correct_answer === 'c' && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-bold">✓ {language === "ta" ? "சரி" : "Correct"}</span>}
                          </div>
                          <div className={`flex items-center gap-2 ${question.correct_answer === 'd' ? 'bg-green-100 dark:bg-green-900/20 p-2 rounded' : ''}`}>
                            <span className="font-bold text-sm bg-primary/20 px-2 py-1 rounded">D</span>
                            <span className="text-sm">{question.option_d}</span>
                            {question.correct_answer === 'd' && <span className="ml-auto text-green-600 dark:text-green-400 text-xs font-bold">✓ {language === "ta" ? "சரி" : "Correct"}</span>}
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
                          {language === "ta" ? "திருத்து" : "Edit"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          {language === "ta" ? "நீக்கு" : "Delete"}
                        </Button>
                      </div>
                    </div>
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
