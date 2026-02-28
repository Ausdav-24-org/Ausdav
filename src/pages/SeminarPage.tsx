import React from "react";
import { motion } from "framer-motion";
import { Download, FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { renderCyanTail } from "@/utils/text";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BG1 from "@/assets/AboutUs/BG1.jpg";

type Seminar = {
  sem_id: number;
  yrs: number;
  seminar_paper_bucket: string;
  seminar_paper_path: string | null;
  answers_bucket: string;
  answers_path: string | null;
  created_at: string;
  updated_at: string;
};

const SeminarPage: React.FC = () => {
  const { t, language } = useLanguage();

  // Fetch seminars from database
  const { data: seminars = [], isLoading: seminarsLoading } = useQuery({
    queryKey: ["seminars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminars")
        .select("*")
        .order("yrs", { ascending: false });

      if (error) throw error;
      return data as Seminar[];
    },
  });

  const openDownload = (seminar: Seminar, type: "paper" | "answers") => {
    const bucket =
      type === "paper" ? seminar.seminar_paper_bucket : seminar.answers_bucket;
    const path = type === "paper" ? seminar.seminar_paper_path : seminar.answers_path;

    if (!path) {
      const typeLabel =
        type === "paper"
          ? language === "en"
            ? "Paper"
            : "தாள்"
          : language === "en"
          ? "Answers"
          : "பதில்கள்";
      toast.error(
        language === "en"
          ? `${typeLabel} not available`
          : `${typeLabel} கிடைக்கவில்லை`
      );
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, "_blank");
    } else {
      toast.error(
        language === "en"
          ? "Download link not available"
          : "பதிவிறக்க இணைப்பு கிடைக்கவில்லை"
      );
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section with Background Image */}
      <section
        className="relative min-h-screen bg-cover bg-center flex items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url('${BG1}')`,
          backgroundAttachment: "fixed",
        }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        </div>

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-full"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center z-10 px-4"
          >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-cyan-400 text-sm font-semibold mb-4 uppercase tracking-widest"
          >
            ✦{" "}
            {language === "en"
              ? "Empowering Future Leaders Since 1993"
              : "1993 முதல் ஆற்றல் சேர்ப்பு"}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
          >
            {language === "en" ? (
              <>
                Semin<span className="text-cyan-400">ar</span>
              </>
            ) : (
              renderCyanTail("செமினார்")
            )}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto"
          >
            {language === "en"
              ? "Download seminar papers and answers to enhance your learning"
              : "உங்கள் கல்வியை மேம்படுத்துவதற்கு செமினார் தாள்கள் மற்றும் பதில்களை பதிவிறக்கவும்"}
          </motion.p>
        </motion.div>
      </motion.div>
      </section>

      {/* Seminar Resources */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-serif font-bold text-foreground mb-8"
          >
            {language === "en" ? (
              <>
                Seminar <span className="text-cyan-400">Resources</span>
              </>
            ) : (
              renderCyanTail("செமினார் வளங்கள்")
            )}
          </motion.h2>

          <div className="max-w-4xl mx-auto">
            {seminarsLoading ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  {language === "en"
                    ? "Loading seminars..."
                    : "செமினார்களை ஏற்றுகிறது..."}
                </div>
              </div>
            ) : seminars.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  {language === "en"
                    ? "No seminars available"
                    : "செமினார்கள் கிடைக்கவில்லை"}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {seminars.map((seminar) => (
                  <motion.div
                    key={seminar.sem_id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex items-center justify-between p-6 bg-cyan-500/20 backdrop-blur-sm rounded-xl border border-cyan-500/40 hover:border-cyan-500/60 hover:bg-cyan-500/30 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <FileText className="w-8 h-8 text-secondary" />
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">
                          {language === "en"
                            ? `Seminar ${seminar.yrs}`
                            : `${seminar.yrs} செமினார்`}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(seminar.created_at).toLocaleDateString(
                            language === "en" ? "en-US" : "ta-LK",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDownload(seminar, "paper")}
                        disabled={!seminar.seminar_paper_path}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {language === "en" ? "Paper" : "தாள்"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDownload(seminar, "answers")}
                        disabled={!seminar.answers_path}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {language === "en" ? "Answers" : "பதில்கள்"}
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SeminarPage;
