import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Radio,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  useQuizPresenceListener,
  type QuizPresenceState,
} from "@/hooks/useQuizPresence";

// Markdown + KaTeX for question rendering
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// ─── Types ────────────────────────────────────────

interface QuizPassword {
  id: number;
  quiz_name: string;
  password: string;
  is_test?: boolean;
  is_quiz?: boolean;
  duration_minutes?: number | null;
}

interface CompletedSubmission {
  id: number;
  school_name: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  not_answered: number;
  final_score: number;
  language: string;
  quiz_password_id: number | null;
  completed_at: string;
}

interface QuizLiveMonitorProps {
  quizPasswords: QuizPassword[];
}

// ─── Helpers ──────────────────────────────────────

function timeAgo(isoDate: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 1000
  );
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function elapsedSince(isoDate: string): string {
  if (!isoDate) return "--";
  const diff = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  );
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────

const QuizLiveMonitor: React.FC<QuizLiveMonitorProps> = ({ quizPasswords }) => {
  // ── State ──
  const [submissions, setSubmissions] = useState<CompletedSubmission[]>([]);
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);
  const [detailsCache, setDetailsCache] = useState<
    Record<number, { questions: any[]; answers: any }>
  >({});
  const [loadingDetails, setLoadingDetails] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [quizFilter, setQuizFilter] = useState<string>("all");
  const [tick, setTick] = useState(0); // for live elapsed time refresh
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Quiz password ID list for presence listener
  const quizPasswordIds = useMemo(
    () => quizPasswords.map((qp) => qp.id),
    [quizPasswords]
  );

  // Quiz name lookup
  const quizNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    quizPasswords.forEach((qp) => {
      map[qp.id] = qp.quiz_name;
    });
    return map;
  }, [quizPasswords]);

  // ── DB-backed listener for active participants ──
  const { participants, isConnected, refreshParticipants } = useQuizPresenceListener(
    quizPasswordIds,
    true // always enabled when monitor is visible
  );
  const [refreshingParticipants, setRefreshingParticipants] = useState(false);

  const handleRefreshParticipants = useCallback(async () => {
    setRefreshingParticipants(true);
    await refreshParticipants();
    setRefreshingParticipants(false);
  }, [refreshParticipants]);

  // Tick every 3s for elapsed time display
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch submissions ──
  const fetchSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    try {
      const { data, error } = await supabase
        .from("school_quiz_results" as any)
        .select("*")
        .order("completed_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setSubmissions(data as any);
      }
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // ── Realtime subscription for new submissions ──
  useEffect(() => {
    const channel = supabase
      .channel("monitor-quiz-results")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "school_quiz_results" },
        (payload) => {
          const newRow = payload.new as CompletedSubmission;
          setSubmissions((prev) => [newRow, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Fetch detail for expanded submission ──
  const fetchDetails = useCallback(
    async (submissionId: number, schoolName: string, qpId: number | null) => {
      if (detailsCache[submissionId]) return;
      if (!qpId) return;
      setLoadingDetails(submissionId);
      try {
        const [questionsRes, answersRes] = await Promise.all([
          supabase
            .from("quiz_mcq" as any)
            .select("*")
            .eq("quiz_password_id", qpId)
            .order("id", { ascending: true }),
          supabase
            .from("school_quiz_answers" as any)
            .select("*")
            .eq("school_name", schoolName)
            .eq("quiz_password_id", qpId)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        const questions = (questionsRes.data || []) as any[];
        const ansRow =
          answersRes.data && (answersRes.data as any[]).length > 0
            ? (answersRes.data as any[])[0]
            : {};
        setDetailsCache((prev) => ({
          ...prev,
          [submissionId]: { questions, answers: ansRow },
        }));
      } catch (err) {
        console.error("Failed to fetch submission details:", err);
      } finally {
        setLoadingDetails(null);
      }
    },
    [detailsCache]
  );

  const toggleExpand = (sub: CompletedSubmission) => {
    if (expandedSubmission === sub.id) {
      setExpandedSubmission(null);
      return;
    }
    setExpandedSubmission(sub.id);
    fetchDetails(sub.id, sub.school_name, sub.quiz_password_id);
  };

  // ── Filtered data ──
  const activeParticipants = useMemo(() => {
    let list = Object.values(participants).filter((p) => !p.is_finished);
    if (quizFilter !== "all") {
      list = list.filter((p) => p.quiz_password_id === Number(quizFilter));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.school_name.toLowerCase().includes(q));
    }
    return list;
  }, [participants, quizFilter, searchQuery]);

  const filteredSubmissions = useMemo(() => {
    let list = [...submissions];
    if (quizFilter !== "all") {
      list = list.filter(
        (s) => s.quiz_password_id === Number(quizFilter)
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.school_name.toLowerCase().includes(q));
    }
    return list;
  }, [submissions, quizFilter, searchQuery]);

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Connection Status + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Connection badge */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected
                ? "bg-green-500 animate-pulse"
                : "bg-gray-400"
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {isConnected ? "Live" : "Connecting..."}
          </span>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search school..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {/* Quiz filter */}
        <Select value={quizFilter} onValueChange={setQuizFilter}>
          <SelectTrigger className="w-[200px] h-9">
            <Filter className="w-4 h-4 mr-1" />
            <SelectValue placeholder="All Quizzes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quizzes</SelectItem>
            {quizPasswords.map((qp) => (
              <SelectItem key={qp.id} value={String(qp.id)}>
                {qp.quiz_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stats summary */}
        <div className="flex gap-3 ml-auto text-sm">
          <Badge
            variant="outline"
            className="gap-1.5 text-blue-600 border-blue-200"
          >
            <Users className="w-3.5 h-3.5" />
            {activeParticipants.length} Active
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 text-green-600 border-green-200"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {filteredSubmissions.length} Completed
          </Badge>
        </div>
      </div>

      {/* ──────── Section A: Active Participants ──────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
              Active Participants
              {activeParticipants.length > 0 && (
                <Badge className="ml-2">{activeParticipants.length}</Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshParticipants}
              disabled={refreshingParticipants}
              className="gap-1.5 text-xs"
            >
              {refreshingParticipants ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeParticipants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No participants currently taking a quiz
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {activeParticipants.map((p) => {
                  const progressPct =
                    p.total_questions > 0
                      ? Math.round(
                          ((p.current_question_index + 1) / p.total_questions) *
                            100
                        )
                      : 0;
                  const answeredPct =
                    p.total_questions > 0
                      ? Math.round(
                          (p.answered_count / p.total_questions) * 100
                        )
                      : 0;
                  const quizName =
                    p.quiz_name ||
                    quizNameMap[p.quiz_password_id] ||
                    `Quiz #${p.quiz_password_id}`;
                  // extras could hold arbitrary data; if non-empty JSON stringify for tooltip
                  const extrasString =
                    p.extras && Object.keys(p.extras).length
                      ? JSON.stringify(p.extras)
                      : null;

                  return (
                    <motion.div
                      key={`${p.school_name}_${p.quiz_password_id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      layout
                    >
                      <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                        <CardContent className="pt-4 pb-3 space-y-2">
                          {/* School name + Quiz badge */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate flex-1">
                              {p.school_name}
                              {extrasString && (
                                <span
                                  title={extrasString}
                                  className="ml-1 text-xs text-muted-foreground cursor-help"
                                >
                                  ⓘ
                                </span>
                              )}
                            </h4>
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0"
                            >
                              {quizName}
                            </Badge>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                Q{p.current_question_index + 1}/
                                {p.total_questions}
                              </span>
                              <span>{p.answered_count} answered</span>
                            </div>
                            <Progress value={progressPct} className="h-2" />
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {elapsedSince(p.started_at)}
                            </span>
                            {/* show current time bonus if available */}
                            {typeof p.time_bonus === 'number' && (
                              <Badge variant="outline" className="text-[10px] border-cyan-400 text-cyan-600">
                                Bonus {p.time_bonus}
                              </Badge>
                            )}
                            {answeredPct >= 80 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-400 text-amber-600"
                              >
                                Almost Done
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ──────── Section B: Completed Submissions Feed ──────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Completed Submissions
              {filteredSubmissions.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filteredSubmissions.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSubmissions}
              disabled={loadingSubmissions}
              className="gap-1.5 text-xs"
            >
              {loadingSubmissions ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {filteredSubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No completed submissions yet
              </p>
            ) : (
              <div className="divide-y">
                <AnimatePresence initial={false}>
                  {filteredSubmissions.map((sub) => {
                    const isExpanded = expandedSubmission === sub.id;
                    const detail = detailsCache[sub.id];
                    const quizName =
                      quizNameMap[sub.quiz_password_id ?? 0] ??
                      `Quiz #${sub.quiz_password_id}`;

                    return (
                      <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border-b last:border-b-0"
                      >
                        {/* Summary Row */}
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => toggleExpand(sub)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm truncate">
                                {sub.school_name}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] shrink-0"
                              >
                                {quizName}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="text-green-600 font-medium">
                                {sub.correct_answers} correct
                              </span>
                              <span className="text-red-600 font-medium">
                                {sub.wrong_answers} wrong
                              </span>
                              <span className="text-yellow-600">
                                {sub.not_answered} skipped
                              </span>
                            </div>
                          </div>

                          {/* Score */}
                          <div className="text-right shrink-0">
                            <div
                              className={`text-lg font-bold ${
                                sub.final_score >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {sub.final_score}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {sub.completed_at
                                ? timeAgo(sub.completed_at)
                                : ""}
                            </div>
                          </div>

                          {/* Expand icon */}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </button>

                        {/* Expanded Detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4">
                                {loadingDetails === sub.id ? (
                                  <div className="py-6 text-center text-muted-foreground text-sm">
                                    Loading details...
                                  </div>
                                ) : !detail ||
                                  detail.questions.length === 0 ? (
                                  <div className="py-6 text-center text-muted-foreground text-sm">
                                    No question data available
                                  </div>
                                ) : (
                                  <QuestionAnswerBreakdown
                                    questions={detail.questions}
                                    answersRow={detail.answers}
                                  />
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Inline Question-Answer Breakdown ────────────

interface QuestionAnswerBreakdownProps {
  questions: any[];
  answersRow: any;
}

const QuestionAnswerBreakdown: React.FC<QuestionAnswerBreakdownProps> = ({
  questions,
  answersRow,
}) => {
  const choiceMeta: Record<string, string | null> =
    answersRow?.choice_meta || {};
  const answersMeta: Record<string, any> = answersRow?.answers_meta || {};

  return (
    <div className="space-y-3 mt-2">
      {questions.map((question, index) => {
        const qId = question.id?.toString() ?? `${index + 1}`;
        const columnKey = `q${index + 1}`;
        const studentAnswer =
          choiceMeta[qId] ?? answersRow?.[columnKey] ?? null;
        const isCorrect = studentAnswer === question.correct_answer;
        const isUnanswered = !studentAnswer;

        const meta =
          answersMeta[qId] ?? answersMeta[columnKey] ?? null;

        // Scoring
        let qstnPoint = 0;
        let bonusPoint = 0;
        if (isCorrect) {
          qstnPoint = 100;
          bonusPoint =
            typeof meta?.bonus === "number"
              ? meta.bonus
              : typeof meta?.secondsTaken === "number"
              ? Math.max(0, 60 - meta.secondsTaken)
              : 0;
        } else if (!isUnanswered) {
          qstnPoint = -50;
        }

        const statusColor = isCorrect
          ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/10"
          : isUnanswered
          ? "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/10"
          : "border-l-red-500 bg-red-50/50 dark:bg-red-950/10";

        return (
          <div
            key={qId}
            className={`border-l-4 rounded-md p-3 ${statusColor}`}
          >
            {/* Question header */}
            <div className="flex items-start gap-2 mb-2">
              <span className="font-bold text-xs text-muted-foreground shrink-0">
                Q{index + 1}
              </span>
              <div className="flex-1 text-sm prose prose-sm max-w-none leading-snug">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {question.question_text}
                </ReactMarkdown>
              </div>
              <div className="shrink-0">
                {isCorrect ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : isUnanswered ? (
                  <HelpCircle className="w-4 h-4 text-yellow-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {["a", "b", "c", "d"].map((opt) => {
                const text = question[`option_${opt}`];
                const isThisCorrect = opt === question.correct_answer;
                const isThisSelected = opt === studentAnswer;

                let optClasses =
                  "text-xs rounded px-2 py-1.5 border flex items-center gap-1.5 ";
                if (isThisCorrect) {
                  optClasses +=
                    "border-green-500 bg-green-100 dark:bg-green-900/30 font-medium";
                } else if (isThisSelected) {
                  optClasses +=
                    "border-red-500 bg-red-100 dark:bg-red-900/30 font-medium";
                } else {
                  optClasses += "border-muted bg-muted/20";
                }

                return (
                  <div key={opt} className={optClasses}>
                    <span
                      className={`w-5 h-5 flex items-center justify-center rounded-sm text-[10px] font-bold ${
                        isThisCorrect
                          ? "bg-green-500 text-white"
                          : isThisSelected
                          ? "bg-red-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {opt.toUpperCase()}
                    </span>
                    <span className="truncate prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {text}
                      </ReactMarkdown>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Score + time row */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>
                Points:{" "}
                <span
                  className={`font-semibold ${
                    qstnPoint > 0
                      ? "text-green-600"
                      : qstnPoint < 0
                      ? "text-red-600"
                      : ""
                  }`}
                >
                  {qstnPoint > 0 ? `+${qstnPoint}` : qstnPoint}
                </span>
              </span>
              {isCorrect && (
                <span>
                  Bonus:{" "}
                  <span className="font-semibold text-yellow-500">
                    +{bonusPoint}
                  </span>
                </span>
              )}
              {meta?.secondsTaken != null && (
                <span className="ml-auto">{meta.secondsTaken}s</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QuizLiveMonitor;
