import React, { useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import BG1 from "@/assets/AboutUs/BG1.jpg";
import { renderCyanTail } from "@/utils/text";

type Lang = "en" | "ta";
type Member = {
  id: string | number;
  role: string;
  roleTA: string;
  name: string;
  nameTA: string;
  Work: string;
  WorkTA?: string;
  photo: string | null;
  linkedin: string | null;
};

// Map database designation enum to display roles
const DESIGNATION_TO_ROLE: Record<string, { en: string; ta: string }> = {
  president: { en: "President", ta: "தலைவர்" },
  vice_president: { en: "Vice President", ta: "துணைத் தலைவர்" },
  secretary: { en: "Secretary", ta: "செயலாளர்" },
  vice_secretary: { en: "Vice Secretary", ta: "துணைச் செயலாளர்" },
  treasurer: { en: "Treasurer", ta: "பொருளாளர்" },
  assistant_treasurer: { en: "Vice Treasurer", ta: "துணைப் பொருளாளர்" },
  editor: { en: "Editor", ta: "ஊடக தலைவர்" },
  web_designer: { en: "Web Developer", ta: "இணைய நிர்வாகி" },
  general_committee_member: { en: "General", ta: "பொது" },
  education_committee_member: { en: "Education", ta: "கல்வி" },
  university_representative: { en: "Representative", ta: "பல்கலை பிரதிநிதி" },
};

const TITLES = {
  patrons: { en: <>Patrons Of <span className="text-cyan-400">AUSDAV</span></>, ta: "AUSDAV ஆதரவாளர்கள்" },
  exec: { en: <>Executive <span className="text-cyan-400">Committee</span></>, ta: "நிர்வாக குழு" },
  reps: { en: <><span className="text-cyan-400">Representative</span></>, ta: "பல்கலை பிரதிநிதிகள்" },
  edu: { en: <><span className="text-cyan-400">Education</span></>, ta: "கல்வி" },
  gen: { en: <><span className="text-cyan-400">General</span></>, ta: "பொது" },
};

// Executive committee designations
const EXEC_DESIGNATIONS = [
  "president",
  "vice_president",
  "secretary",
  "vice_secretary",
  "treasurer",
  "assistant_treasurer",
  "editor",
  "web_designer",
];

type MemberRow = {
  mem_id: number;
  fullname: string;
  designation: string | null;
  batch: number;
  university: string;
  uni_degree: string | null;
  profile_bucket: string;
  profile_path: string | null;
};

const IconLI = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-4 h-4"
  >
    <path d="M20.447 20.452H17.21v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.078V9h3.112v1.561h.044c.434-.823 1.494-1.692 3.073-1.692 3.287 0 3.894 2.164 3.894 4.977v6.606zM5.337 7.433a1.814 1.814 0 110-3.628 1.814 1.814 0 010 3.628zM6.956 20.452H3.716V9h3.24v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.727v20.545C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.273V1.727C24 .774 23.2 0 22.222 0z" />
  </svg>
);

const IconUser = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
  >
    <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
  </svg>
);

const Card = ({
  m,
  i,
  lang,
  isDark,
  isMobile,
  isExpanded,
  onToggle,
}: {
  m: Member;
  i: number;
  lang: Lang;
  isDark: boolean;
  isMobile: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const [imgOk, setImgOk] = useState<boolean>(!!m.photo);
  const name = lang === "en" ? m.name : m.nameTA;
  const role = lang === "en" ? m.role : m.roleTA;
  const work = (lang === "en" ? m.Work : m.WorkTA ?? m.Work).split(",");

  // Mobile condensed view
  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: i * 0.04, duration: 0.5, ease: "easeOut" }}
        layout
        onClick={onToggle}
        className={cn(
          "glass-card rounded-xl p-3 text-center cursor-pointer transition-all overflow-hidden",
          isExpanded && "ring-2 ring-cyan-400"
        )}
      >
        {/* Avatar */}
        {imgOk && m.photo ? (
          <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-gradient-to-br from-primary to-gold-light flex items-center justify-center neon-glow">
            <img
              src={m.photo}
              alt={name}
              className="w-full h-full rounded-lg object-cover"
              loading="lazy"
              onError={() => setImgOk(false)}
            />
          </div>
        ) : (
          <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-gradient-to-br from-primary to-gold-light flex items-center justify-center neon-glow">
            <span className="text-xl font-bold text-primary-foreground">
              {name.charAt(0)}
            </span>
          </div>
        )}

        {/* Name and Role */}
        <h3 className={cn("font-bold mb-1 break-words", isMobile ? "text-xs leading-tight" : "text-base", isDark ? "text-white" : "")}>
          {name}
        </h3>
        <p
          className={cn(
            "text-xs text-primary font-medium break-words",
            isDark ? "text-cyan-200/90" : ""
          )}
        >
          {role}
        </p>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-3 pt-3 border-t border-white/10"
            >
              <p className={cn("text-xs text-muted-foreground line-clamp-3")}>
                {work.map((t, idx) => (
                  <React.Fragment key={idx}>
                    {t.trim()}
                    {idx < work.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Desktop view (unchanged)
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: i * 0.04, duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -6, scale: 1.01 }}
      className={cn("glass-card rounded-2xl p-8 text-center neon-glow-hover")}
    >
      {m.linkedin && (
        <a
          href={m.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition shadow",
            isDark
              ? "bg-white/10 text-white hover:bg-white/15"
              : "bg-muted text-foreground hover:bg-muted/80"
          )}
          aria-label="LinkedIn Profile"
        >
          <IconLI />
        </a>
      )}

      {imgOk && m.photo ? (
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-gold-light flex items-center justify-center neon-glow">
          <img
            src={m.photo}
            alt={m.role === "Patron" ? "" : name}
            className="w-full h-full rounded-2xl object-cover"
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        </div>
      ) : (
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-gold-light flex items-center justify-center neon-glow">
          <span className="text-3xl font-bold text-primary-foreground">
            {name.charAt(0)}
          </span>
        </div>
      )}

      <h3 className={cn("font-bold text-xl mb-1", isDark ? "text-white" : "")}>
        {name}
      </h3>
      <p
        className={cn(
          "text-primary font-medium mb-2",
          isDark ? "text-cyan-200/90" : ""
        )}
      >
        {role}
      </p>

      <p className={cn("text-sm text-muted-foreground")}>
        {work.map((t, idx) => (
          <React.Fragment key={idx}>
            {t.trim()}
            {idx < work.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    </motion.div>
  );
};

const Section = ({
  title,
  sub,
  members,
  cols = "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
  gradient = true,
  lang,
  isDark,
  isMobile,
  expandedCardId,
  onToggleCard,
}: {
  title: ReactNode;
  sub?: string;
  members: Member[];
  cols?: string;
  gradient?: boolean;
  lang: Lang;
  isDark: boolean;
  isMobile: boolean;
  expandedCardId: string | number | null;
  onToggleCard: (id: string | number) => void;
}) => {
  if (!members.length) return null;

  const gridCols = isMobile ? "grid grid-cols-2 gap-3 overflow-x-hidden" : cols;

  return (
    <>
      <section
        className={gradient ? "py-14 md:py-10" : "py-10"}
      >
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <div
              className={cn(
                "inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 rounded-full border backdrop-blur-md shadow max-w-full",
                isDark
                  ? "border-white/10 bg-white/5"
                  : "border-border/60 bg-card/70"
              )}
            >
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.8)]" />
              <h2
                className={cn(
                  "text-xl sm:text-3xl md:text-4xl font-serif font-bold",
                  isDark ? "text-white" : "text-foreground"
                )}
              >
                {title}
              </h2>
            </div>
            {sub && (
              <p
                className={cn(
                  "mt-4 text-base md:text-lg",
                  isDark ? "text-white/70" : "text-muted-foreground"
                )}
              >
                {sub}
              </p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="py-12 md:py-1 overflow-x-hidden" >
        <div className="container mx-auto px-4">
          <div className={gridCols}>
            {members.map((m, i) => (
              <Card
                key={m.id}
                m={m}
                i={i}
                lang={lang}
                isDark={isDark}
                isMobile={isMobile}
                isExpanded={expandedCardId === m.id}
                onToggle={() => onToggleCard(m.id)}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

type Block = {
  type: string;
  tEn: ReactNode;
  tTa: string;
  sEn?: string;
  sTa?: string;
  members: Member[];
  cols?: string;
  gradient?: boolean;
};
type Page = { year: number; blocks: Block[] };

const CommitteePage: React.FC = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const lang: Lang = language === "ta" ? "ta" : "en";
  const isMobile = useIsMobile();
  const [memberPhotoUrls, setMemberPhotoUrls] = useState<Map<number, string>>(
    new Map()
  );
  const [expandedCardId, setExpandedCardId] = useState<string | number | null>(null);

  const toggleCard = (id: string | number) => {
    // Toggle: if same card clicked, close it; otherwise open only this card
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  // Fetch patrons from DB
  type PatronRow = {
    id: string | number;
    name: string;
    designation?: string | null;
    image_paths?: string[] | null;
    display_order?: number | null;
    is_active?: boolean | null;
    image_alt?: string | null;
    linkedin_id?: string | null;
  };

  const { data: patronsRows } = useQuery<PatronRow[]>({
    queryKey: ["patrons", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patrons" as any)
        .select(
          "id, name, designation, image_paths, display_order, is_active, image_alt, linkedin_id"
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PatronRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch members from DB with designations
  const {
    data: membersRows,
    isLoading: membersLoading,
    error: membersError,
  } = useQuery<MemberRow[]>({
    queryKey: ["committee-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select(
          "mem_id, fullname, designation, batch, university, uni_degree, profile_bucket, profile_path"
        )
        .not("designation", "is", null)
        .neq("designation", "none")
        .neq("designation", "")
        .order("batch", { ascending: false })
        .order("fullname", { ascending: true });
      if (error) {
        console.error("Error fetching committee members:", error);
        throw error;
      }
      return (data ?? []) as unknown as MemberRow[];
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  useEffect(() => {
    let isActive = true;

    const loadMemberPhotos = async () => {
      if (!membersRows?.length) {
        if (isActive) setMemberPhotoUrls(new Map());
        return;
      }

      const entries = await Promise.all(
        membersRows.map(async (row) => {
          if (!row.profile_path) return [row.mem_id, ""] as const;
          const bucket = row.profile_bucket || "member-profiles";
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(row.profile_path, 60 * 60);
          if (error || !data?.signedUrl) return [row.mem_id, ""] as const;
          return [row.mem_id, data.signedUrl] as const;
        })
      );

      if (!isActive) return;
      setMemberPhotoUrls(new Map(entries));
    };

    loadMemberPhotos();

    return () => {
      isActive = false;
    };
  }, [membersRows]);

  // Map patrons to Member format
  const patronsMembers: Member[] = (patronsRows ?? []).map((p: PatronRow) => {
    const imgPath =
      Array.isArray(p.image_paths) &&
      p.image_paths.length > 0 &&
      p.image_paths[0]
        ? p.image_paths[0]
        : null;
    const publicUrl = imgPath
      ? supabase.storage.from("patrons").getPublicUrl(imgPath).data
          ?.publicUrl ?? null
      : null;
    return {
      id: p.id,
      role: "Patron",
      roleTA: "ஆதரவாளர்",
      name: p.name,
      nameTA: p.name,
      Work: p.designation || "",
      photo: publicUrl,
      linkedin: p.linkedin_id || null,
    } as Member;
  });

  // Map database members to Member format and organize by batch
  const membersByBatch = useMemo(() => {
    if (!membersRows) return new Map<number, MemberRow[]>();

    const grouped = new Map<number, MemberRow[]>();
    for (const member of membersRows) {
      const batch = member.batch;
      if (!grouped.has(batch)) {
        grouped.set(batch, []);
      }
      grouped.get(batch)!.push(member);
    }
    return grouped;
  }, [membersRows]);

  // Convert member row to Member format
  const mapMemberRowToMember = (row: MemberRow, lang: Lang): Member => {
    const designation = row.designation || "";
    const roleInfo = DESIGNATION_TO_ROLE[designation] || {
      en: designation,
      ta: designation,
    };
    const role = lang === "en" ? roleInfo.en : roleInfo.ta;
    const roleTA = lang === "ta" ? roleInfo.ta : roleInfo.en;

    // Build work string from uni_degree and university
    const workParts: string[] = [];
    if (row.uni_degree) workParts.push(row.uni_degree);
    if (row.university) workParts.push(row.university);
    const work = workParts.join(",");

    const signedUrl = memberPhotoUrls.get(row.mem_id) || "";
    let photo: string | null = signedUrl || null;
    if (!photo && row.profile_path && row.profile_bucket) {
      const { data } = supabase.storage
        .from(row.profile_bucket)
        .getPublicUrl(row.profile_path);
      photo = data?.publicUrl || null;
    }

    return {
      id: row.mem_id,
      role: roleInfo.en,
      roleTA: roleInfo.ta,
      name: row.fullname,
      nameTA: row.fullname,
      Work: work,
      photo,
      linkedin: null, // LinkedIn not stored in members table currently
    };
  };

  // Create pages dynamically from database data
  const pages: Page[] = useMemo(() => {
    if (!membersByBatch.size) return [];

    const sortedBatches = Array.from(membersByBatch.keys()).sort(
      (a, b) => b - a
    );
    return sortedBatches.map((batch) => {
      const members = membersByBatch.get(batch) || [];

      // Sort members by designation priority before organizing
      const designationOrder: Record<string, number> = {
        president: 1,
        vice_president: 2,
        secretary: 3,
        vice_secretary: 4,
        treasurer: 5,
        assistant_treasurer: 6,
        editor: 7,
        web_designer: 8,
        university_representative: 9,
        education_committee_member: 10,
        general_committee_member: 11,
      };
      const sortedMembers = [...members].sort((a, b) => {
        const aDes = a.designation || "";
        const bDes = b.designation || "";
        const orderDiff =
          (designationOrder[aDes] || 99) - (designationOrder[bDes] || 99);
        if (orderDiff !== 0) return orderDiff;
        // If same designation, sort by name
        return a.fullname.localeCompare(b.fullname);
      });

      // Organize members by designation type
      const execMembers: Member[] = [];
      const repMembers: Member[] = [];
      const eduMembers: Member[] = [];
      const genMembers: Member[] = [];

      for (const memberRow of sortedMembers) {
        const designation = memberRow.designation || "";
        const member = mapMemberRowToMember(memberRow, lang);

        if (EXEC_DESIGNATIONS.includes(designation)) {
          execMembers.push(member);
        } else if (designation === "university_representative") {
          // For representatives, use university name as role
          member.role = memberRow.university;
          member.roleTA = memberRow.university;
          repMembers.push(member);
        } else if (designation === "education_committee_member") {
          eduMembers.push(member);
        } else if (designation === "general_committee_member") {
          genMembers.push(member);
        }
      }

      const blocks: Block[] = [
        {
          type: "patrons",
          tEn: TITLES.patrons.en,
          tTa: TITLES.patrons.ta,
          sEn: "Meet the dedicated team guiding AUSDAV",
          sTa: "AUSDAV ஐ வழிநடத்தும் அர்ப்பணிப்பு குழுவை சந்திக்கவும்",
          members: patronsMembers,
          cols: "grid sm:grid-cols-2 lg:grid-cols-4 gap-6",
          gradient: true,
        },
      ];

      if (execMembers.length > 0) {
        blocks.push({
          type: "exec",
          tEn: TITLES.exec.en,
          tTa: TITLES.exec.ta,
          sEn: "Meet the organizing committee",
          sTa: "அமைப்பு குழுவை சந்திக்கவும்",
          members: execMembers,
          gradient: true,
        });
      }

      if (repMembers.length > 0) {
        blocks.push({
          type: "reps",
          tEn: TITLES.reps.en,
          tTa: TITLES.reps.ta,
          members: repMembers,
          gradient: true,
        });
      }

      if (eduMembers.length > 0) {
        blocks.push({
          type: "edu",
          tEn: TITLES.edu.en,
          tTa: TITLES.edu.ta,
          members: eduMembers,
          gradient: true,
        });
      }

      if (genMembers.length > 0) {
        blocks.push({
          type: "gen",
          tEn: TITLES.gen.en,
          tTa: TITLES.gen.ta,
          members: genMembers,
          gradient: true,
        });
      }

      return { year: batch, blocks };
    });
  }, [membersByBatch, lang, patronsMembers, memberPhotoUrls]);

  const [idx, setIdx] = useState(0);
  const cur = pages[idx] || pages[0];

  const visibleYears = useMemo(() => {
    if (!pages.length) return [] as { page: Page; index: number }[];

    const windowSize = Math.min(3, pages.length);
    const start = Math.max(0, Math.min(idx - 1, pages.length - windowSize));

    return pages.slice(start, start + windowSize).map((page, offset) => ({
      page,
      index: start + offset,
    }));
  }, [pages, idx]);

  useEffect(() => {
    if (idx > pages.length - 1) {
      setIdx(Math.max(pages.length - 1, 0));
    }
  }, [pages.length, idx]);

  const bgStyle = useMemo(
    () => ({
      background: isDark
        ? "linear-gradient(180deg, #050914 0%, #070B18 40%, #050812 100%)"
        : "linear-gradient(180deg, rgba(236,254,255,1) 0%, rgba(239,246,255,1) 40%, rgba(255,255,255,1) 100%)",
    }),
    [isDark]
  );

  const YearBtn = ({
    active,
    children,
    onClick,
  }: {
    active?: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      whileHover={{ y: -1 }}
      className={cn(
        "h-9 px-3 rounded-full text-sm font-semibold transition outline-none border backdrop-blur-md shadow-sm",
        active
          ? "bg-gradient-to-r from-cyan-300 to-sky-500 text-slate-900 border-transparent shadow-lg"
          : isDark
          ? "bg-white/5 text-white border-white/15 hover:bg-white/10"
          : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </motion.button>
  );

  const ArrowBtn = ({
    direction,
    disabled,
    onClick,
  }: {
    direction: "prev" | "next";
    disabled: boolean;
    onClick: () => void;
  }) => (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      whileHover={!disabled ? { y: -1 } : undefined}
      className={cn(
        "h-9 w-9 rounded-full text-sm font-semibold transition flex items-center justify-center outline-none border backdrop-blur-md",
        disabled
          ? isDark
            ? "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"
            : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
          : isDark
          ? "bg-white/10 text-white border-white/20 hover:bg-white/20"
          : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
      )}
      aria-label={direction === "prev" ? "Previous years" : "Next years"}
    >
      {direction === "prev" ? "‹" : "›"}
    </motion.button>
  );

  const isLoading = membersLoading;
  const hasError = membersError;

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={bgStyle}
      >
        <p className={cn("text-lg", isDark ? "text-white" : "text-foreground")}>
          Loading committee data...
        </p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={bgStyle}
      >
        <div className="text-center">
          <p
            className={cn(
              "text-lg mb-2",
              isDark ? "text-red-400" : "text-red-600"
            )}
          >
            Error loading committee data
          </p>
          <p
            className={cn(
              "text-sm",
              isDark ? "text-white/70" : "text-muted-foreground"
            )}
          >
            {hasError instanceof Error
              ? hasError.message
              : "Please try again later"}
          </p>
        </div>
      </div>
    );
  }

  if (!cur || pages.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={bgStyle}
      >
        <p
          className={cn(
            "text-lg",
            isDark ? "text-white/70" : "text-muted-foreground"
          )}
        >
          No committee data available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Hero Section with Background Image */}
      <section
        className="relative min-h-screen bg-cover bg-center flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url('${BG1}')`,
          backgroundAttachment: "fixed",
        }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-4 md:left-10 w-40 md:w-72 h-40 md:h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-4 md:right-10 w-48 md:w-96 h-48 md:h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
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
              ? "Empowering Future Leaders Since 1993"
              : "1993 முதல் ஆற்றல் சேர்ப்பு"}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
          >
            {language === "en" ? (
              <>
                Executive <span className="text-cyan-400">Committee</span>
              </>
            ) : (
              renderCyanTail("நிர்வாக குழு")
            )}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto"
          >
            {language === "en"
              ? "Know the people in the AUSDAV"
              : "AUSDAV இல் உள்ளவர்களை அறிந்து கொள்ளுங்கள்"}
          </motion.p>
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

      {cur.blocks.map((b, bi) => {
        const membersForBlock =
          b.type === "patrons"
            ? patronsMembers.length
              ? patronsMembers
              : b.members
            : b.members;
        return (
          <React.Fragment key={`${cur.year}-${bi}`}>
            <Section
              title={lang === "en" ? b.tEn : renderCyanTail(b.tTa)}
              sub={lang === "en" ? b.sEn : b.sTa}
              members={membersForBlock}
              cols={b.cols}
              gradient={b.gradient}
              lang={lang}
              isDark={isDark}
              isMobile={isMobile}
              expandedCardId={expandedCardId}
              onToggleCard={toggleCard}
            />
          </React.Fragment>
        );
      })}

      <div className="flex items-center justify-center gap-3 pb-14">
        <ArrowBtn
          direction="prev"
          disabled={idx === 0}
          onClick={() => setIdx((v) => Math.max(v - 1, 0))}
        />

        <div className="flex items-center gap-2">
          {visibleYears.map(({ page, index }) => (
            <YearBtn
              key={page.year}
              active={index === idx}
              onClick={() => setIdx(index)}
            >
              {page.year + 3}
            </YearBtn>
          ))}
        </div>

        <ArrowBtn
          direction="next"
          disabled={idx === pages.length - 1}
          onClick={() =>
            setIdx((v) => Math.min(v + 1, Math.max(pages.length - 1, 0)))
          }
        />
      </div>
    </div>
  );
};

export default CommitteePage;
