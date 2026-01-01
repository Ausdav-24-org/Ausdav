import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Calendar,
  MapPin,
  ChevronRight,
  Image,
  GraduationCap,
  BookOpen,
  Heart,
  Zap,
  Sparkles,
  Trophy,
  Star,
  Music,
  Camera,
  Users,
  Award,
  Gift,
  Flame,
  PartyPopper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

type EventRecord = {
  id: string;
  title_en: string;
  title_ta: string | null;
  description_en: string | null;
  description_ta: string | null;
  event_date: string;
  created_at: string | null;
  location: string | null;
  is_active: boolean;
  image_bucket: string | null;
  image_path: string | null;
};

import BG1 from "@/assets/AboutUs/BG1.jpg";


type EventDisplay = {
  id: string;
  titleEN: string;
  titleTA: string | null;
  descriptionEN: string | null;
  descriptionTA: string | null;
  date: string;
  location: string | null;
  isUpcoming: boolean;
  coverImage: string | null;
};

type TimelineEvent = EventDisplay & { icon: LucideIcon };

const timelineIcons: LucideIcon[] = [
  GraduationCap,
  BookOpen,
  Heart,
  Zap,
  Sparkles,
  Trophy,
  Star,
  Music,
  Camera,
  Users,
  Award,
  Gift,
  Flame,
  PartyPopper,
];

const annualEvents = [
  { id: 1, en: "Practical Seminars", ta: "நடைமுறை கருத்தரங்குகள்", icon: GraduationCap },
  { id: 2, en: "Monthly Exam", ta: "மாதாந்திர தேர்வு", icon: BookOpen },
  { id: 3, en: "Kalvi Karam", ta: "கல்வி கரம்", icon: Heart },
  { id: 4, en: "Annual Exam", ta: "வருடாந்திர தேர்வு", icon: BookOpen },
  { id: 5, en: "Pentathlon", ta: "பெண்டாத்லான்", icon: Zap },
  { id: 6, en: "Innovia", ta: "இனோவியா", icon: Sparkles },
  { id: 7, en: "Anbuchangamam", ta: "அன்புசங்கமம்", icon: Heart },
  { id: 8, en: "Blood Donation Camp", ta: "இரத்ததான முகாம்", icon: Heart },
  { id: 9, en: "Medical Camp", ta: "மருத்துவ முகாம்", icon: Heart },
  { id: 10, en: "Cricket", ta: "கிரிக்கெட்", icon: Zap },
];

const EventsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<EventDisplay[]>([]);

  // track hover item in timeline
  const [hoveredAnnualId, setHoveredAnnualId] = useState<string | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      const { data, error } = await supabase
        .from("events" as any)
        .select(
          "id,title_en,title_ta,description_en,description_ta,event_date,created_at,location,is_active,image_bucket,image_path"
        )
        .eq("is_active", true)
        .order("event_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const records = (data ?? []) as unknown as EventRecord[];

      const mapped: EventDisplay[] = records.map((event) => {
        const imageUrl = event.image_path
          ? supabase.storage
              .from(event.image_bucket || "events")
              .getPublicUrl(event.image_path).data?.publicUrl || null
          : null;

        const eventDate = event.event_date || "";
        const isUpcoming = eventDate ? new Date(eventDate) >= today : false;

        return {
          id: event.id,
          titleEN: event.title_en,
          titleTA: event.title_ta,
          descriptionEN: event.description_en,
          descriptionTA: event.description_ta,
          date: eventDate,
          location: event.location,
          isUpcoming,
          coverImage: imageUrl,
        };
      });

      setEvents(mapped);
    };

    loadEvents();
  }, []);

  const timelineEvents = useMemo(() => {
    const map = new Map<string, TimelineEvent>();
    let iconIndex = 0;

    for (const event of events) {
      const key = (event.titleEN || "").trim().toLowerCase();
      if (!key || map.has(key)) continue;

      const icon = timelineIcons[iconIndex % timelineIcons.length];
      map.set(key, { ...event, icon });
      iconIndex += 1;
    }

    return Array.from(map.values());
  }, [events]);

  return (
        //piri
<!--     <div>
      {/* Hero */}
      <section className="py-16 md:py-24" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
              {t("events.title")}
            </h1>
            <p className="text-foreground/80 text-lg">
              {language === "en"
                ? "Discover our upcoming events and explore memories from past activities"
                : "எங்கள் வரவிருக்கும் நிகழ்வுகளைக் கண்டறியுங்கள் மற்றும் கடந்த செயல்பாடுகளின் நினைவுகளை ஆராயுங்கள்"}
            </p>
          </motion.div>
        </div>
      </section> -->

 
        //main
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
              ? "Empowering Future Leaders Since 2015"
              : "2015 முதல் ஆற்றல் சேர்ப்பு"}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
          >
            {language === "en" ? "Annual " : "வருடாந்த "}
            <span className="text-cyan-400">
              {language === "en" ? "Events" : "நிகழ்வுகள்"}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto"
          >
            {language === "en"
              ? "Discover our upcoming events and explore memories from past activities"
              : "எங்கள் வரவிருக்கும் நிகழ்வுகளைக் கண்டறியுங்கள் மற்றும் கடந்த செயல்பாடுகளின் நினைவுகளை ஆராயுங்கள்"}
          </motion.p>
        </motion.div>
      </section>

      {/* Annual Events Timeline */}
      <section className="py-24 relative overflow-hidden bg-slate-800/50">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
              {language === "en" ? "Annual " : "வருடாந்த "}
              <span className="text-cyan-400">{language === "en" ? "Events" : "நிகழ்வுகள்"}</span>
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              {language === "en"
                ? "Our year-round activities designed to support and develop students"
                : "மாணவர்களை ஆதரிக்கவும் வளர்க்கவும் வடிவமைக்கப்பட்ட எங்கள் ஆண்டு முழுவதும் செயல்பாடுகள்"}
            </p>
          </motion.div>

          <div className="relative max-w-4xl mx-auto">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent -translate-x-1/2" />

            <div className="space-y-12">
              {timelineEvents.map((item, idx) => {
                const isHovered = hoveredAnnualId === item.id;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                    className={`flex items-center gap-6 ${
                      idx % 2 === 0 ? "flex-row" : "flex-row-reverse"
                    }`}
                  >
                    <div className={`flex-1 ${idx % 2 === 0 ? "text-right" : "text-left"}`}>
                      {/* SAME BOX expands in same position */}
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        onMouseEnter={() => setHoveredAnnualId(item.id)}
                        onMouseLeave={() => setHoveredAnnualId(null)}
                        className={`
                          inline-block w-fit
                          rounded-xl border backdrop-blur-sm
                          bg-cyan-500/20
                          border-cyan-500/40 hover:border-cyan-500/60
                          ${idx % 2 === 0 ? "mr-4" : "ml-4"}
                        `}
                      >
                        {/* Title always visible */}
                        <div className="px-3 py-2">
                          <p className="font-bold text-base text-white whitespace-nowrap">
                            {language === "en" ? item.titleEN : item.titleTA || item.titleEN}
                          </p>
                        </div>

                        {/* Expanded content inside SAME box */}
                        <AnimatePresence initial={false}>
                          {isHovered && (
                            <motion.div
                              key="content"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="w-96 max-w-[24rem] sm:max-w-none px-3 pb-3">
                                <div className="rounded-xl bg-card text-left shadow-2xl overflow-hidden">
                                  <Link
                                    to={`/events/${item.id}`}
                                    className="block h-44 bg-gradient-to-br from-primary/10 to-secondary/10 overflow-hidden"
                                  >
                                    {item.coverImage ? (
                                      <div
                                        className="w-full h-full bg-cover bg-center"
                                        style={{ backgroundImage: `url(${item.coverImage})` }}
                                      />
                                    ) : (
                                      <div className="flex items-center justify-center h-full">
                                        <Calendar className="w-8 h-8 text-secondary" />
                                      </div>
                                    )}
                                  </Link>

                                  <div className="p-4 pt-2">
                                    <p className="text-xs text-muted-foreground line-clamp-3">
                                      {language === "en"
                                        ? item.descriptionEN || ""
                                        : item.descriptionTA ||
                                          item.descriptionEN ||
                                          ""}
                                    </p>

                                    <div className="mt-4 flex items-center justify-between">
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="w-3 h-3" />
                                        {item.location ||
                                          (language === "en"
                                            ? "TBA"
                                            : "பின்னர் அறிவிக்கப்படும்")}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </div>

                    {/* Center icon */}
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 10 }}
                      className="relative z-10 w-14 h-14 rounded-xl bg-cyan-400 flex items-center justify-center flex-shrink-0"
                    >
                      <item.icon className="w-6 h-6 text-slate-900" />
                    </motion.div>

                    <div className="flex-1" />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EventsPage;
