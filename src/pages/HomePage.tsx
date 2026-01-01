import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Users,
  Calendar,
  MessageSquare,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Heart,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import AnnouncementCarousel from "@/components/AnnouncementCarousel";
import ReviewCarousel from "@/components/ReviewCarousel";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

import { Tables } from "@/integrations/supabase/types";
import heroBg from "@/assets/Home/BG1.jpg";
import logoImg from "@/assets/Exam/AUSDAV_llogo.png";
import mountainImg from "@/assets/Home/removed.png";

type AnnouncementRow = Tables<"announcements"> & {
  description_en?: string | null;
  description_ta?: string | null;
  announcement_id?: string;
  is_permanent?: boolean;
  category?: string | null;
};

interface Announcement {
  id: string;
  title: string;
  message: string;
  image_url?: string | null;
  type?: 'urgent' | 'event' | 'news';
}

type SeedAnnouncement = {
  id: string;
  en: string;
  ta: string;
  img?: string | null;
};

const fallbackAnnouncements: SeedAnnouncement[] = [
  { id: 'a1', en: 'Welcome to AUSDAV', ta: 'AUSDAV-க்கு வரவேற்பு', img: null },
  { id: 'a2', en: 'Check out our upcoming events', ta: 'எங்கள் வரவிருக்கும் நிகழ்வுகளைப் பார்க்கவும்', img: null },
];


// Sample events
const annualEvents = [
  {
    id: 1,
    en: "Practical Seminars",
    ta: "நடைமுறை கருத்தரங்குகள்",
    icon: GraduationCap,
  },
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

// Sample committee
const committeePreview = [

];

// Executive designations to show on the Home page
const HOME_EXEC_DESIGNATIONS = [
  "president",
  "secretary",
  "treasurer",
  "editor",
  "web_designer",
];

// Executive designation to role mapping
const HOME_DESIGNATION_TO_ROLE: Record<string, { en: string; ta: string }> = {
  president: { en: "President", ta: "தலைவர்" },
  secretary: { en: "Secretary", ta: "செயலாளர்" },
  treasurer: { en: "Treasurer", ta: "பொருளாளர்" },
  editor: { en: "Editor", ta: "ஊடக தலைவர்" },
  web_designer: { en: "Web Developer", ta: "இணைய நிர்வாகி" },
};

const stats = [
  { value: "500+", label: "Students Helped", labelTA: "உதவிய மாணவர்கள்" },
  { value: "50+", label: "Events Organized", labelTA: "நிகழ்வுகள்" },
  { value: "10+", label: "Years of Service", labelTA: "சேவை ஆண்டுகள்" },
  { value: "100%", label: "Commitment", labelTA: "அர்ப்பணிப்பு" },
];

const HomePage: React.FC = () => {
  const { language, t } = useLanguage();
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    fallbackAnnouncements.map((s) => ({
      id: s.id,
      title: s.en,
      message: s.en,
      image_url: s.img || null,
    }))
  );
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Exec committee row auto-scroll refs
  const execRowRef = useRef<HTMLDivElement | null>(null);
  const execAutoIntervalRef = useRef<number | null>(null);
  const execAnimRef = useRef<number | null>(null);
  const execIsPausedRef = useRef(false);

  const mapCategoryToType = (
    category?: string | null
  ): Announcement["type"] => {
    const normalized = (category || "").toLowerCase();
    if (normalized === "urgent") return "urgent";
    if (normalized === "event") return "event";
    return "news";
  };

  const buildAnnouncementText = (
    primary?: string | null,
    fallback?: string | null
  ) => {
    const text = primary?.trim() || fallback?.trim() || "";
    return text || "Announcement";
  };

  const [feedbackForm, setFeedbackForm] = useState({ name: "", contact: "", message: "" });

  const fallbackCards = useMemo<Announcement[]>(() => {
    const useTamil = language === "ta";
    return fallbackAnnouncements.map((seed) => ({
      id: seed.id,
      title: useTamil ? seed.ta : seed.en,
      message: useTamil ? seed.ta : seed.en,
      image_url: seed.img || null,
    }));
  }, [language]);

  const getAnnouncementImageUrl = (item: any) => {
    if (!item?.img_path) return null;
    const { data } = supabase.storage
      .from(item.img_bucket || 'announcements')
      .getPublicUrl(item.img_path);
    return data?.publicUrl || null;
  };

  const loadAnnouncements = useCallback(async () => {
    setIsLoadingAnnouncements(true);
    const nowIso = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const activeItems = (data || []).filter((item: AnnouncementRow) => {
        const withinStart = !item.start_at || item.start_at <= nowIso;
        const withinEnd =
          item.is_permanent || !item.end_at || item.end_at >= nowIso;
        return item.is_active !== false && withinStart && withinEnd;
      });

      const mapped = activeItems.map<Announcement>((item: AnnouncementRow) => {
        const id = String(item.id || item.announcement_id || crypto.randomUUID());
        const enText = buildAnnouncementText(
          item.description_en ?? item.message_en ?? item.title_en,
          item.title_en
        );
        const taText = buildAnnouncementText(
          item.description_ta ?? item.message_ta ?? item.title_ta,
          item.title_ta || item.description_en || item.title_en
        );
        const selected = language === "ta" ? taText : enText;
        return {
          id,
          title: selected,
          message: selected,
          image_url: getAnnouncementImageUrl(item),
          type: mapCategoryToType(item.category ?? item.tag ?? null),
        } as Announcement;
      });

      if (mapped.length) {
        setAnnouncements(mapped);
      } else {
        setAnnouncements(
          fallbackAnnouncements.map((s) => ({
            id: s.id,
            title: language === "ta" ? s.ta : s.en,
            message: language === "ta" ? s.ta : s.en,
            image_url: s.img || null,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading announcements:", error);
      toast.error("Unable to load announcements right now.");
      setAnnouncements(
        fallbackAnnouncements.map((s) => ({
          id: s.id,
          title: language === "ta" ? s.ta : s.en,
          message: language === "ta" ? s.ta : s.en,
          image_url: s.img || null,
        }))
      );
    } finally {
      setIsLoadingAnnouncements(false);
    }
  }, [language]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);



  // Fetch executive members for the Home page (current/latest batch)
  const { data: execRows } = useQuery<Tables<"members">[]>({
    queryKey: ["home-exec-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select(
          "mem_id, fullname, designation, batch, university, uni_degree, profile_bucket, profile_path"
        )
        .in("designation", HOME_EXEC_DESIGNATIONS)
        .neq("designation", "none")
        .not("designation", "is", null)
        .order("batch", { ascending: false })
        .order("fullname", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tables<"members">[];
    },
    staleTime: 1000 * 60 * 5,
  });

  type ExecMember = {
    id: number | string;
    role: string;
    roleTA: string;
    name: string;
    nameTA: string;
    Work?: string;
    batch?: number | null;
    photo?: string | null;
  };

  const execMembers = useMemo<ExecMember[]>(() => {
    // choose latest batch
    const maxBatch = execRows && execRows.length ? Math.max(...execRows.map((r) => r.batch || 0)) : 0;
    const rows = (execRows || []).filter((r) => (r.batch || 0) === maxBatch);

    const byDesignation = new Map(rows.map((r) => [r.designation, r] as const));

    return HOME_EXEC_DESIGNATIONS.map((designation) => {
      const r = byDesignation.get(designation as string) as Tables<"members"> | undefined;
      if (r) {
        const roleInfo = HOME_DESIGNATION_TO_ROLE[r.designation] || {
          en: r.designation,
          ta: r.designation,
        };
        const workParts: string[] = [];
        if (r.uni_degree) workParts.push(r.uni_degree);
        if (r.university) workParts.push(r.university);
        const work = workParts.join(",");
        let photo: string | null = null;
        if (r.profile_path && r.profile_bucket) {
          const { data } = supabase.storage
            .from(r.profile_bucket)
            .getPublicUrl(r.profile_path);
          photo = data?.publicUrl || null;
        }
        return {
          id: r.mem_id,
          role: roleInfo.en,
          roleTA: roleInfo.ta,
          name: r.fullname,
          nameTA: r.fullname,
          Work: work,
          batch: r.batch,
          photo,
        };
      }

      // fallback: try to use preview data or generic placeholder
      const roleInfo = HOME_DESIGNATION_TO_ROLE[designation] || {
        en: designation,
        ta: designation,
      };
      const preview = committeePreview.find(
        (p) => p.role.toLowerCase() === roleInfo.en.toLowerCase()
      );
      const nameFallback = preview ? preview.name : language === "en" ? "Unknown" : "தெரியவில்லை";

      return {
        id: `placeholder-${designation}`,
        role: roleInfo.en,
        roleTA: roleInfo.ta,
        name: nameFallback,
        nameTA: nameFallback,
        Work: "",
        batch: null,
        photo: null,
      };
    });
  }, [execRows, language]);

  // Auto-scroll for executive committee row: loop with snap and pause on hover/focus
  useEffect(() => {
    const el = execRowRef.current;
    if (!el) return;
    // Respect reduced motion preference
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // ensure start at beginning
    el.scrollLeft = 0;

    let last = performance.now();
    const speed = 200; // px per second (increased rollover speed)

    const step = (now: number) => {
      const dt = now - last;
      last = now;
      if (!execIsPausedRef.current) {
        el.scrollLeft += (speed * dt) / 1000;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) {
          // wrap seamlessly
          el.scrollLeft -= half;
        }
      }
      execAnimRef.current = requestAnimationFrame(step);
    };

    execAnimRef.current = requestAnimationFrame(step);

    const onPointerEnter = () => { execIsPausedRef.current = true; };
    const onPointerLeave = () => { execIsPausedRef.current = false; };
    const onFocusIn = () => { execIsPausedRef.current = true; };
    const onFocusOut = () => { execIsPausedRef.current = false; };

    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);

    return () => {
      if (execAnimRef.current !== null) cancelAnimationFrame(execAnimRef.current);
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
    };
  }, [execMembers]);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackForm.message.trim()) {
      toast.error(
        language === "en"
          ? "Please enter a message"
          : "தயவுசெய்து செய்தியை உள்ளிடவும்"
      );
      return;
    }
    toast.success(t("home.feedback.success"));
    setFeedbackForm({ name: "", contact: "", message: "" });
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section with Parallax */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url('${heroBg}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      >
        {/* Animated Rising Logo (Sun) */}
        {/* <motion.div
          initial={{ opacity: 0, y: 150 }}
          animate={{ opacity: 1, y: -50 }}
          transition={{ duration: 2.5, ease: "easeOut", delay: 0.3 }}
          className="absolute bottom-1/4 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="relative">
            <div className="w-40 h-40 rounded-full blur-2xl bg-cyan-400/30 absolute inset-0" />
            <img
              src={logoImg}
              alt="Rising Logo Sun"
              className="w-40 h-40 object-contain drop-shadow-2xl"
            />
          </div>
        </motion.div> */}

        {/* Mountain Silhouette (on top of background and logo) */}
          {/* <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
          >
            <img
              src={mountainImg}
              alt="Mountain Silhouette"
              className="w-full h-auto object-cover"
            />
          </motion.div> */}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-black/70"></div>
        {/* Content */}
        <motion.div
          style={{ opacity }}
          className="container mx-auto px-4 relative z-30 py-32"
        >
          <div className="max-w-5xl mx-auto text-center">
            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-white"
            >
              <span className="text-lg md:text-xl lg:text-2xl block mb-2 text-cyan-400 italic">
                {language === "en" ? "Welcome to" : "வரவேற்கிறோம்"}
              </span>
              <span className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black">
                {language === "en" ? (
                  <>
                    <span className="text-white">AUS</span>
                    <span className="text-cyan-400">DAV</span>
                  </>
                ) : (
                  "AUSDAV"
                )}
              </span>
            </motion.h1>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-16"
            >
              {stats.map((stat, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.03, y: -4 }}
                  className="bg-cyan-500/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-cyan-500/40 hover:border-cyan-500/60 hover:bg-cyan-500/30 transition-all duration-300"
                >
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-cyan-400 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300">
                    {language === "en" ? stat.label : stat.labelTA}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1"
          >
            <motion.div className="w-1.5 h-3 bg-primary rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Announcement Carousel */}
      <div className="pt-8">
        <AnnouncementCarousel announcements={announcements} />
        {isLoadingAnnouncements && (
          <p className="text-center text-sm text-slate-400 mt-2">
            Loading announcements...
          </p>
        )}
      </div>

      {/* Who We Are Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              {/* <div className="flex items-center gap-2 text-cyan-400">
                <Users className="w-5 h-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">About Us</span>
              </div> */}
              <h2 className="text-4xl md:text-5xl font-bold text-white">
                Who <span className="text-cyan-400">We Are</span>
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "AUSDAV is a passionate community of leaders, innovators, and changemakers dedicated to creating positive impact in our society. Our diverse team brings together unique perspectives and expertise to drive meaningful change."
                  : "AUSDAV என்பது வவுனியா மற்றும் அதற்கு அப்பால் உள்ள பல்கலைக்கழக மாணவர்களின் முழுமையான வளர்ச்சিக்கு அர்ப்பணிக்கப்பட்ட லாভலாபி அமைப்பு. கல்வி இடைவெளிகளைக் குறைக்கவும் கல்வியுயர் சிறந்மையை ஊக்குவிக்கவும் வேண்டிய வெளிப்பாட்டுடன் நிறுவப்பட்ட இது, மாணவர்களின் கல்வி பயணத்தை ஆதரிக்க பாடுபடுகிறது."}
              </p>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 hover:text-cyan-300 w-fit"
              >
                <Link to="/about">
                  {language === "en" ? "Learn More" : "மேலும் அறிக"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>

            {/* Right Content - Responsive YouTube Video */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex items-center justify-center"
            >
              <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border border-cyan-500/20 shadow-lg">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/LbEa34kbbfg?autoplay=1&controls=0&mute=1&rel=0&modestbranding=1&start=0&end=34&loop=1&playlist=LbEa34kbbfg"
                  title="AUSDAV Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      {/* Quick Exam Actions */}
      <section className="py-12 md:py-16 bg-slate-900/20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid grid-cols-3 gap-2 md:gap-4">
            <Link to="/exam#apply" className="group block rounded-2xl p-3 md:p-4 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/20 transition w-full text-center md:text-left">
              <div className="w-10 h-10 mb-3 mx-auto md:mx-0 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-cyan-400" />
              </div>
              <h4 className="text-lg font-bold text-white">
                <span className="block md:hidden">{language === 'en' ? 'Exam' : 'தேர்வு'}</span>
                <span className="hidden md:block">{language === 'en' ? 'Apply for Exam' : 'தேர்விற்கு விண்ணப்பிக்க'}</span>
              </h4>
              <p className="hidden md:block text-sm text-slate-400 max-w-xs">{language === 'en' ? 'Register online for upcoming exams' : 'வரவிருக்கும் தேர்வுகளுக்கு ஆன்லைனில் பதிவு செய்யவும்'}</p>
            </Link>
            <Link to="/exam#results" className="group block rounded-2xl p-3 md:p-4 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/20 transition w-full text-center md:text-left">
              <div className="w-10 h-10 mb-3 mx-auto md:mx-0 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <h4 className="text-lg font-bold text-white">
                <span className="block md:hidden">{language === 'en' ? 'Results' : 'மதிப்பெண்கள்'}</span>
                <span className="hidden md:block">{language === 'en' ? 'View My Result' : 'என் மதிப்பெண்கள்'}</span>
              </h4>
              <p className="hidden md:block text-sm text-slate-400 max-w-xs">{language === 'en' ? 'Check your scores and download certificates' : 'உங்கள் மதிப்பெண்களைப் பரிசீலிக்கவும் மற்றும் சான்றிதழ்களை பதிவிறக்கவும்'}</p>
            </Link>
            <Link to="/resources" className="group block rounded-2xl p-3 md:p-4 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/20 transition w-full text-center md:text-left">
              <div className="w-10 h-10 mb-3 mx-auto md:mx-0 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-cyan-400" />
              </div>
              <h4 className="text-lg font-bold text-white">
                <span className="block md:hidden">{language === 'en' ? 'Resources' : 'ஆதாரங்கள்'}</span>
                <span className="hidden md:block">{language === 'en' ? 'Exam Resources' : 'தேர்வு ஆதாரங்கள்'}</span>
              </h4>
              <p className="hidden md:block text-sm text-slate-400 max-w-xs">{language === 'en' ? 'Past papers, study guides and sample questions' : 'முந்தைய पेக்குகள், படிப்பு வழிகாட்டிகள் மற்றும் மாதிரி கேள்விகள்'}</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Empowering Education + Video Section */}
      <section className="py-16 md:py-24 bg-slate-800/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto items-center">

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="flex items-center justify-center"
            >
              <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border border-cyan-500/20 shadow-lg">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/e7lYGW8D4pw?autoplay=1&controls=0&mute=1&loop=1&rel=0"
                  title="AUSDAV Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="space-y-6"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white">
                Empowering <span className="text-cyan-400">Education</span>
              </h2>

              <div className="space-y-4 text-slate-300 text-lg leading-relaxed">
                {/* <p>
                  Since 2000, our Annual Pilot Examinations have supported students’ academic growth—evolving from scholarship exams to a stronger focus on G.C.E (O/L) Science and Mathematics, and expanding to G.C.E (A/L) initiatives from 2005—while remaining free of charge and accessible without discrimination.
                </p> */}

                <p>
                  Kalvikaram is our grassroots upliftment initiative designed for underprivileged and under-resourced schools across the Northern Province, created in response to teacher shortages.
                </p>

                <p>
                  Through Kalvikaram, volunteer educators deliver subject-focused learning support for both G.C.E (O/L) and G.C.E (A/L) students, strengthening understanding, improving exam readiness, and building a lasting motivation for learning—ensuring no student is held back due to limited institutional resources.
                </p>
              </div>

              {/* <div>
                <Button asChild variant="outline" size="lg" className="border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 hover:text-cyan-300 w-fit">
                  <Link to="/about">
                    {language === "en" ? "Learn More" : "மேலும் அறிக"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div> */}
            </motion.div>
          </div>
        </div>
      </section>

      {/* About / Events / Donate Cards */}
      <section className="py-12 md:py-24 bg-slate-800/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-3 md:gap-6 max-w-6xl mx-auto">
            {/* About Us Card (centered icon, title, description) */}
            <Link to="/about" className="group block rounded-2xl p-4 md:p-8 bg-slate-900/40 border border-cyan-800/20 hover:border-cyan-500/50 hover:bg-slate-900/60 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-cyan-800/20 flex items-center justify-center">
                  <Users className="w-6 h-6 md:w-7 md:h-7 text-cyan-400" />
                </div>
                <h3 className="text-base md:text-xl font-semibold text-white">{language === "en" ? "About Us" : "எங்களைப் பற்றி"}</h3>
                <p className="hidden md:block text-sm text-slate-400 max-w-xs">{language === "en" ? "Learn more about our mission, vision, and the dedicated team behind AUSDAV." : "எங்கள் நோக்கம், பார்வை மற்றும் AUSDAV இன் பின்னால் உள்ள அர்ப்பணிப்பு குழுவைப் பற்றி மேலும் அறிக."}</p>
              </div>
            </Link>

            {/* Events Card (centered) */}
            <Link to="/events" className="group block rounded-2xl p-4 md:p-8 bg-slate-900/40 border border-cyan-800/20 hover:border-cyan-500/50 hover:bg-slate-900/60 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-cyan-800/20 flex items-center justify-center">
                  <Calendar className="w-6 h-6 md:w-7 md:h-7 text-cyan-400" />
                </div>
                <h3 className="text-base md:text-xl font-semibold text-white">{language === "en" ? "Events" : "நிகழ்வுகள்"}</h3>
                <p className="hidden md:block text-sm text-slate-400 max-w-xs">{language === "en" ? "Discover our upcoming events, seminars, and activities that empower students." : "மாணவர்களை வலுப்படுத்தும் எங்கள் வரவிருக்கும் நிகழ்வுகள், கருத்தரங்குகள் மற்றும் செயல்பாடுகளைக் கண்டறிக."}</p>
              </div>
            </Link>

            {/* Donate Card (centered) */}
            <Link to="/donate" className="group block rounded-2xl p-4 md:p-8 bg-slate-900/40 border border-cyan-800/20 hover:border-cyan-500/50 hover:bg-slate-900/60 transition-all duration-300">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-cyan-800/20 flex items-center justify-center">
                  <Heart className="w-6 h-6 md:w-7 md:h-7 text-cyan-400" />
                </div>
                <h3 className="text-base md:text-xl font-semibold text-white">{language === "en" ? "Donate" : "தானம்"}</h3>
                <p className="hidden md:block text-sm text-slate-400 max-w-xs">{language === "en" ? "Support our programs and help students reach their potential." : "எங்கள் திட்டங்களை ஆதரித்து மாணவர்களுக்கு உதவுங்கள்."}</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Executive Committee */}
      <section className="py-24 relative bg-slate-700/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
              {language === "en" ? "Our " : "எங்கள் "}
              <span className="text-cyan-400">
                {language === "en" ? "Executive Committee" : "தலைமை குழு"}
              </span>
            </h2>
          </motion.div>

          <div className="max-w-6xl mx-auto">
            <style>{`.no-scrollbar::-webkit-scrollbar{display:none} .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
            <div ref={execRowRef} className="flex gap-6 overflow-x-auto py-4 px-4 md:px-0 scroll-smooth no-scrollbar" role="list" aria-label="Executive committee members" tabIndex={0}>
              {/* primary sequence */}
              {(execMembers && execMembers.length ? execMembers : committeePreview).map((member, idx) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.15 }}
                  whileHover={{ y: -10, scale: 1.01 }}
                  className="glass-card rounded-2xl p-8 text-center neon-glow-hover relative min-w-[240px] flex-shrink-0"
                  role="listitem"
                  aria-label={`${member.role} - ${member.name}`}
                  title={`${member.role} — ${member.name}`}
                >
                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary to-gold-light flex items-center justify-center neon-glow overflow-hidden">
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt={`${member.name} photo`}
                        className="w-full h-full rounded-2xl object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-3xl font-bold text-primary-foreground"
                        aria-hidden="true"
                      >
                        {member.name ? member.name.charAt(0) : "?"}
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-xl mb-1 text-white">{member.name}</h3>
                  <p className="font-medium mb-2 text-cyan-200/90">{language === "en" ? member.role : member.roleTA}</p>

                  <p className="text-sm text-muted-foreground">
                    {(member.Work && member.Work.trim()) ? (
                      member.Work
                    ) : (
                      <span>{language === "en" ? "Batch" : "தொகுதி"} {member.batch ?? "—"}</span>
                    )}
                  </p>
                </motion.div>
              ))}

              {/* duplicated sequence for seamless looping (aria-hidden) */}
              {(execMembers && execMembers.length ? execMembers : committeePreview).map((member, idx) => (
                <motion.div
                  key={`loop-${member.id}-${idx}`}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.02 }}
                  whileHover={{ y: -10, scale: 1.01 }}
                  className="glass-card rounded-2xl p-8 text-center neon-glow-hover relative min-w-[240px] flex-shrink-0"
                  role="listitem"
                  aria-hidden="true"
                >
                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary to-gold-light flex items-center justify-center neon-glow overflow-hidden">
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt=""
                        className="w-full h-full rounded-2xl object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-3xl font-bold text-primary-foreground"
                        aria-hidden="true"
                      >
                        {member.name ? member.name.charAt(0) : "?"}
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-xl mb-1 text-white">{member.name}</h3>
                  <p className="font-medium mb-2 text-cyan-200/90">{language === "en" ? member.role : member.roleTA}</p>

                  <p className="text-sm text-muted-foreground">
                    {(member.Work && member.Work.trim()) ? (
                      member.Work
                    ) : (
                      <span>{language === "en" ? "Batch" : "தொகுதி"} {member.batch ?? "—"}</span>
                    )}
                  </p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <Button
                asChild
                variant="outline"
                size="lg"
                className="group border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 hover:text-cyan-300"
              >
                <Link to="/committee">
                  {t("home.committee.viewAll")}
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials / Reviews Carousel */}
      {/* <section className="py-24 bg-slate-800/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              {language === "en" ? "CLIENT REVIEWS" : "கிளையன்ட் மதிப்புரைகள்"}
            </h2>
          </div>

          <ReviewCarousel
            reviews={[
              {
                en: "I have known and worked closely with Rick and Liza Looser, and the fine folks at The Agency, for almost two decades and feel fully confident in expressing my endorsement.",
                ta: "நான் Rick மற்றும் Liza Looser ஆகியோருடன் பணி செய்துள்ளேன்.",
                author: "Nina Perry",
                image: "👩‍💼",
              },
              {
                en: "Exceptional service and outstanding results. Their team goes above and beyond to ensure every project is completed to perfection.",
                ta: "விதிவிலக்கான சேவை மற்றும் சிறந்த முடிவுகள்.",
                author: "John Smith",
                image: "👨‍💼",
              },
              {
                en: "Professional, reliable, and passionate about their work. They deliver excellence in every aspect.",
                ta: "தொழில்முறை, நம்பகமான மற்றும் தங்கள் வேலையில் ஆர்வமுள்ளவர்கள்.",
                author: "Sarah Johnson",
                image: "👩‍🔬",
              },
            ]}
            language={language}
          />
        </div>
      </section> */}

    </div>
  );
};

export default HomePage;
