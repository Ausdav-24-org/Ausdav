import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, Award, ImageDown, Check, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { renderCyanTail } from "@/utils/text";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import emblemImg from "@/assets/Exam/AUSDAV_llogo.png";

// ✅ NEW: images for the two newly added teaser cards
// Change these paths to your actual image paths
import applyCardImg from "@/assets/Exam/apply_portal_banner.png";
import regCardImg from "@/assets/Exam/check_registration_banner.png";

import { supabase } from "@/integrations/supabase/client";
import BG1 from "@/assets/AboutUs/BG1.jpg";
import BG2 from "@/assets/Exam/BG2.jpg";

type AppSettings = {
  allow_exam_applications: boolean;
  allow_results_view: boolean;
};

// Result type from database
interface ResultRecord {
  result_id: number;
  index_no: string;
  stream: string;
  physics_marks: number | null;
  chemistry_marks: number | null;
  maths_marks: number | null;
  bio_marks: number | null;
  physics_grade: string | null;
  chemistry_grade: string | null;
  maths_grade: string | null;
  bio_grade: string | null;
  zscore: number | null;
  rank: number | null;
  year: number;
}

// Applicant type from database
interface ApplicantRecord {
  applicant_id: number;
  index_no: string;
  fullname: string;
  stream: string;
  gender: boolean;
  nic: string;
  phone: string | null;
  email: string | null;
  school: string;
  year: number;
}

// Combined result for display
interface ResultDisplay {
  name: string;
  school: string;
  nic: string;
  stream: string;
  physics_grade: string;
  chemistry_grade: string;
  maths_or_bio_grade: string;
  maths_or_bio_label: string;
  zscore: string;
  rank: number | null;
}

// Apply form options
const applyExams = ["-- Select Your Stream --", "Maths", "Biology"];
const schoolOptions = [
  "Vavuniya Tamil Madhya Maha Vidyalayam",
  "V/Rambaikulam Girls' Maha Vidyalayam",
  "Saivapragasa Ladies College",
  "Vipulanantha College Vavuniya",
  "Puthukkulam Maha Vidyalayam",
  "Vavuniya Nelukkulam Kalaimakal Maha Vidyalayam",
  "Cheddikulam Maha Vidyalayam",
];

const resultsStreams = ["Maths", "Biology"];
const idTypes = ["Index No", "NIC No"];

const collapseVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const onlyDigitsMax = (value: string, maxLen: number) =>
  value.replace(/\D/g, "").slice(0, maxLen);

/*results sheet row */
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-[180px_1fr] gap-4 items-center">
    <div className="text-slate-500">{label}</div>
    <div className="font-semibold text-slate-900 break-words">{value}</div>
  </div>
);

const ExamPage: React.FC = () => {
  const { t, language } = useLanguage();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("apply");
  const [submitting, setSubmitting] = useState(false);

  // ✅ NEW: collapsible cards inside Apply tab
  const [applyPortalOpen, setApplyPortalOpen] = useState(false);
  const [regPortalOpen, setRegPortalOpen] = useState(false);
  const applyPortalRef = useRef<HTMLDivElement | null>(null);
  const regPortalRef = useRef<HTMLDivElement | null>(null);

  const initialApplyForm = {
    fullName: "",
    email: "",
    phone: "",
    nic: "",
    exam: "",
    schoolName: "",
    gender: "" as "male" | "female" | "",
    agree: true,
  };
  const [applyForm, setApplyForm] = useState(initialApplyForm);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const [nicValid, setNicValid] = useState<boolean | null>(null);
  const [nicDuplicate, setNicDuplicate] = useState<boolean | null>(null);
  const nicCheckTimeoutRef = useRef<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState({
    fullName: false,
    email: false,
    phone: false,
    nic: false,
    schoolName: false,
    exam: false,
    gender: false,
  });
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [generatedIndexNo, setGeneratedIndexNo] = useState<string>("");
  const [registeredFullName, setRegisteredFullName] = useState<string>("");

  // ✅ moved: Registration check states (now rendered inside Apply tab)
  const [regCheckIndex, setRegCheckIndex] = useState<string>("");
  const [regCheckIdType, setRegCheckIdType] = useState<string>("NIC No");
  const [regCheckResult, setRegCheckResult] = useState<{
    found: boolean;
    applicant?: ApplicantRecord;
  } | null>(null);
  const [regChecking, setRegChecking] = useState<boolean>(false);

  // ✅ UPDATED: year is now a 4-digit input (string) instead of a Select
  const defaultResultsForm = {
    stream: "",
    idType: "Index No",
    idValue: "",
    year: "",
  };
  const [resultsForm, setResultsForm] = useState(defaultResultsForm);

  const [resultData, setResultData] = useState<ResultDisplay | null>(null);
  const [showResultSheet, setShowResultSheet] = useState(false);

  // ✅ NEW: store the applicant's real index number (works even when searching by NIC)
  const [foundIndexNo, setFoundIndexNo] = useState<string>("");

  const [downloading, setDownloading] = useState(false);
  const [examApplicationsOpen, setExamApplicationsOpen] = useState(true);
  const [examSettingLoading, setExamSettingLoading] = useState(true);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [resultsSettingLoading, setResultsSettingLoading] = useState(true);

  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadSetting = async () => {
      setExamSettingLoading(true);
      setResultsSettingLoading(true);
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (error) throw error;

        const settings = data as unknown as AppSettings | null;
        setExamApplicationsOpen(settings?.allow_exam_applications ?? false);
        setResultsPublished(settings?.allow_results_view ?? false);
      } catch (error) {
        console.error("Error loading exam application setting:", error);
        toast.error(
          language === "en"
            ? "Unable to load exam application status"
            : "தேர்வு விண்ணப்ப நிலையை ஏற்ற முடியவில்லை"
        );
        setExamApplicationsOpen(false);
        setResultsPublished(false);
      } finally {
        setExamSettingLoading(false);
        setResultsSettingLoading(false);
      }
    };

    loadSetting();
  }, [language]);

  // ✅ NEW: dynamic tab order based on open/closed states (no other code changes)
  const tabOrder = useMemo(() => {
    // when apply + results open OR apply open & results closed => normal order
    if (examApplicationsOpen) return ["apply", "results"] as const;

    // apply closed & results open => results, apply
    if (!examApplicationsOpen && resultsPublished)
      return ["results", "apply"] as const;

    // apply closed & results closed => apply, results
    return ["apply", "results"] as const;
  }, [examApplicationsOpen, resultsPublished]);

  // ✅ NEW: set default active tab once after settings are loaded (keeps your requested order focus)
  const didInitTabRef = useRef(false);
  useEffect(() => {
    if (didInitTabRef.current) return;
    if (examSettingLoading || resultsSettingLoading) return;

    const initialHash = (location.hash || "").replace("#", "");
    if (initialHash === "apply" || initialHash === "results") {
      setActiveTab(initialHash as "apply" | "results");
    } else {
      setActiveTab(tabOrder[0]);
    }

    didInitTabRef.current = true;
  }, [tabOrder, examSettingLoading, resultsSettingLoading, location.hash]);

  // Listen to URL hash to allow deep-linking to specific exam sections
  useEffect(() => {
    const hash = (location.hash || "").replace("#", "");
    if (!hash) return;
    if (hash === "apply" || hash === "results") {
      setActiveTab(hash as "apply" | "results");
      const el = document.getElementById("exam-tabs");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const tabMeta = useMemo(() => {
    return {
      apply: {
        icon: ClipboardList,
        full: t("exam.apply.title"),
        short: language === "en" ? "Apply" : "விண்ணப்பி",
      },
      results: {
        icon: Award,
        full: t("exam.results.title"),
        short: language === "en" ? "Results" : "முடிவுகள்",
      },
    } as const;
  }, [t, language]);

  const handleApplyReset = () => {
    setApplyForm(initialApplyForm);
    setEmailValid(null);
    setPhoneValid(null);
    setNicValid(null);
    setNicDuplicate(null);
    if (nicCheckTimeoutRef.current) {
      window.clearTimeout(nicCheckTimeoutRef.current);
      nicCheckTimeoutRef.current = null;
    }
    setFieldErrors({
      fullName: false,
      email: false,
      phone: false,
      nic: false,
      schoolName: false,
      exam: false,
      gender: false,
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nicCheckTimeoutRef.current) {
        window.clearTimeout(nicCheckTimeoutRef.current);
        nicCheckTimeoutRef.current = null;
      }
    };
  }, []);

  // Clear dialog-related temporary data when dialog is closed
  useEffect(() => {
    if (!successDialogOpen) {
      setGeneratedIndexNo("");
      setRegisteredFullName("");
    }
  }, [successDialogOpen]);

  // Email validation function
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Phone validation function
  const validatePhone = (phone: string) => {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  };

  // NIC validation function
  const validateNIC = (nic: string) => {
    const nicRegex = /^\d{12}$/;
    return nicRegex.test(nic);
  };

  // ✅ NEW: Year validation (4 digits)
  const validateYear = (year: string) => /^\d{4}$/.test(year);

  // Check if NIC already exists
  const checkNicDuplicate = async (nic: string) => {
    try {
      const { data, error } = await supabase.rpc("check_nic_exists", {
        p_nic: nic,
      });
      if (error) throw error;
      setNicDuplicate(data as boolean);
    } catch (error) {
      console.error("Error checking NIC:", error);
      setNicDuplicate(null); // Reset on error
    }
  };

  // Handle email input change with validation
  const handleEmailChange = (value: string) => {
    setApplyForm({ ...applyForm, email: value });
    if (value.trim() === "") {
      setEmailValid(null);
    } else {
      setEmailValid(validateEmail(value));
    }
  };

  // Handle phone input change with validation
  const handlePhoneChange = (value: string) => {
    const digitsOnly = onlyDigitsMax(value, 10);
    setApplyForm({ ...applyForm, phone: digitsOnly });
    if (digitsOnly === "") {
      setPhoneValid(null);
    } else {
      setPhoneValid(validatePhone(digitsOnly));
    }
  };

  // Handle NIC input change with validation (debounced duplicate check)
  const handleNicChange = (value: string) => {
    // Allow only digits and limit to 12 characters
    const digitsOnly = value.replace(/\D/g, "").slice(0, 12);
    setApplyForm({ ...applyForm, nic: digitsOnly });

    // Reset duplicate state when clearing input
    if (digitsOnly === "") {
      setNicValid(null);
      setNicDuplicate(null);
      if (nicCheckTimeoutRef.current) {
        window.clearTimeout(nicCheckTimeoutRef.current);
        nicCheckTimeoutRef.current = null;
      }
      return;
    }

    const isValid = validateNIC(digitsOnly);
    setNicValid(isValid);

    // Debounce RPC calls to avoid spamming the backend while typing
    if (isValid) {
      if (nicCheckTimeoutRef.current)
        window.clearTimeout(nicCheckTimeoutRef.current);
      nicCheckTimeoutRef.current = window.setTimeout(() => {
        checkNicDuplicate(digitsOnly);
        nicCheckTimeoutRef.current = null;
      }, 350) as unknown as number;
    } else {
      if (nicCheckTimeoutRef.current) {
        window.clearTimeout(nicCheckTimeoutRef.current);
        nicCheckTimeoutRef.current = null;
      }
      setNicDuplicate(null);
    }
  };

  // ✅ UPDATED: use DB function to atomically generate index and insert
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFieldErrors({
      fullName: false,
      email: false,
      phone: false,
      nic: false,
      schoolName: false,
      exam: false,
      gender: false,
    });

    const errors = {
      fullName: !applyForm.fullName.trim(),
      email: !applyForm.email.trim(),
      phone: !applyForm.phone.trim(),
      nic: !applyForm.nic.trim(),
      schoolName: !applyForm.schoolName.trim(),
      exam: !applyForm.exam.trim(),
      gender: !applyForm.gender,
    };

    setFieldErrors(errors);

    if (Object.values(errors).some((error) => error)) {
      toast.error(
        language === "en"
          ? "Please fill all required fields"
          : "தயவுசெய்து அனைத்து தேவையான புலங்களையும் நிரப்பவும்"
      );
      return;
    }

    if (applyForm.phone.length !== 10) {
      toast.error(
        language === "en"
          ? "Phone number must be 10 digits"
          : "தொலைபேசி எண் 10 இலக்கங்கள் இருக்க வேண்டும்"
      );
      return;
    }

    if (!examApplicationsOpen) {
      toast.error(
        language === "en"
          ? "Applications are closed"
          : "விண்ணப்பங்கள் மூடப்பட்டுள்ளது"
      );
      return;
    }

    setSubmitting(true);
    try {
      const year = new Date().getFullYear();

      const { data: indexNo, error } = await supabase.rpc("insert_applicant", {
        p_fullname: applyForm.fullName.trim(),
        p_gender: applyForm.gender === "male",
        p_stream: applyForm.exam,
        p_nic: applyForm.nic.trim(),
        p_phone: applyForm.phone.trim(),
        p_email: applyForm.email.trim().toLowerCase(),
        p_school: applyForm.schoolName,
        p_year: year,
      });

      if (error) throw error;

      setRegisteredFullName(applyForm.fullName.trim());
      setGeneratedIndexNo(indexNo as string);
      setSuccessDialogOpen(true);
      toast.success(
        language === "en"
          ? "Application submitted successfully!"
          : "விண்ணப்பம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!"
      );
      handleApplyReset();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error submitting application:", error);
      let errorMessage =
        language === "en"
          ? "Failed to submit application. Please try again."
          : "விண்ணப்பத்தை சமர்ப்பிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.";

      if (
        error?.code === "23505" &&
        error?.message?.includes("applicants_nic_unique")
      ) {
        errorMessage =
          language === "en"
            ? "An application with this NIC already exists."
            : "இந்த NIC கொண்ட விண்ணப்பம் ஏற்கனவே உள்ளது.";
      }

      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResultsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resultsForm.stream || !resultsForm.year || !resultsForm.idValue) {
      toast.error(
        language === "en"
          ? "Please fill all fields"
          : "அனைத்து புலங்களையும் நிரப்பவும்"
      );
      return;
    }

    // ✅ NEW: enforce 4-digit year
    if (!validateYear(resultsForm.year)) {
      toast.error(
        language === "en"
          ? "Year must be 4 digits (e.g. 2025)"
          : "ஆண்டு 4 இலக்கமாக இருக்க வேண்டும் (எ.கா. 2025)"
      );
      return;
    }

    try {
      let applicantQuery = supabase
        .from("applicants")
        .select("*")
        .eq("stream", resultsForm.stream)
        .eq("year", parseInt(resultsForm.year));

      if (resultsForm.idType === "Index No") {
        applicantQuery = applicantQuery.eq("index_no", resultsForm.idValue);
      } else {
        applicantQuery = applicantQuery.eq("nic", resultsForm.idValue);
      }

      const { data: applicantData, error: applicantError } =
        await applicantQuery.maybeSingle();
      if (applicantError) throw applicantError;

      if (!applicantData) {
        toast.error(
          language === "en"
            ? "No applicant found"
            : "விண்ணப்பதாரர் கிடைக்கவில்லை"
        );
        setResultData(null);
        setShowResultSheet(false);
        setFoundIndexNo("");
        return;
      }
      const applicant = applicantData as unknown as ApplicantRecord;

      setFoundIndexNo(applicant.index_no);

      // @ts-expect-error - Supabase type instantiation issue
      const { data: resultData, error: resultError } = await supabase
        .from("results")
        .select("*")
        .eq("index_no", applicant.index_no)
        .eq("year", parseInt(resultsForm.year))
        .maybeSingle();

      if (resultError) throw resultError;

      if (!resultData) {
        toast.error(
          language === "en"
            ? "No results found for this applicant"
            : "இந்த விண்ணப்பதாரருக்கு முடிவுகள் கிடைக்கவில்லை"
        );
        setResultData(null);
        setShowResultSheet(false);
        setFoundIndexNo("");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = resultData as any;

      const isMaths = applicant.stream === "Maths";

      const displayResult: ResultDisplay = {
        name: applicant.fullname,
        school: applicant.school,
        nic: applicant.nic,
        stream: applicant.stream,
        physics_grade: result.physics_grade || "-",
        chemistry_grade: result.chemistry_grade || "-",
        maths_or_bio_grade: isMaths
          ? result.maths_grade || "-"
          : result.bio_grade || "-",
        maths_or_bio_label: isMaths ? "Maths" : "Biology",
        zscore: result.zscore?.toFixed(4) || "-",
        rank: result.rank,
      };

      setResultData(displayResult);
      setShowResultSheet(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error fetching results:", error);
      toast.error(
        language === "en"
          ? "Failed to fetch results"
          : "முடிவுகளைப் பெற முடியவில்லை"
      );
      setResultData(null);
      setShowResultSheet(false);
      setFoundIndexNo("");
    }
  };

  const handleResultsReset = () => {
    setResultsForm(defaultResultsForm);
    setResultData(null);
    setShowResultSheet(false);
    setFoundIndexNo("");
  };

  // Check whether an index number is registered
  const handleCheckIndex = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let idx = regCheckIndex.trim();
    if (!idx) {
      toast.error(
        regCheckIdType === "Index No"
          ? language === "en"
            ? "Please enter an index number"
            : "ஒரு குறிப்பு எண்ணை உள்ளிடவும்"
          : language === "en"
          ? "Please enter an NIC"
          : "NIC ஒன்றை உள்ளிடவும்"
      );
      return;
    }

    if (regCheckIdType === "NIC No") {
      idx = idx.replace(/\D/g, "");
    }

    try {
      setRegChecking(true);
      setRegCheckResult(null);

      const query = supabase.from("applicants").select("*");
      const res =
        regCheckIdType === "Index No"
          ? await query.eq("index_no", idx).maybeSingle()
          : await query.eq("nic", idx).maybeSingle();

      if (res.error) throw res.error;

      if (!res.data) {
        setRegCheckResult({ found: false });
      } else {
        setRegCheckResult({
          found: true,
          applicant: res.data as unknown as ApplicantRecord,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error checking index:", err);
      toast.error(
        language === "en"
          ? "Failed to check registration"
          : "பதிவை சரிபார்க்க முடியவில்லை"
      );
      setRegCheckResult(null);
    } finally {
      setRegChecking(false);
    }
  };

  // Certificate display (from resultData)
  const certName = resultData?.name ?? "-";
  const certSchool = resultData?.school ?? "-";
  const certNIC = resultData?.nic ?? "-";
  const certRank = resultData?.rank ?? "-";

  // From search form + applicant result
  const certStream = resultsForm.stream || "-";
  const certYear = resultsForm.year || "-";

  // ✅ UPDATED: always show the real index no (even when searched by NIC)
  const certIndex =
    foundIndexNo ||
    (resultsForm.idType === "Index No" ? resultsForm.idValue || "-" : "-");

  // Subject grades (from result)
  const physicsGrade = resultData?.physics_grade ?? "-";
  const chemistryGrade = resultData?.chemistry_grade ?? "-";
  const mathsOrBioGrade = resultData?.maths_or_bio_grade ?? "-";
  const mathsOrBioLabel = resultData?.maths_or_bio_label ?? "Maths/Bio";
  const zScore = resultData?.zscore ?? "-";

  const downloadSheetAsImage = async () => {
    try {
      if (!sheetRef.current) {
        toast.error(
          language === "en"
            ? "Result sheet not found"
            : "முடிவு தாள் கிடைக்கவில்லை"
        );
        return;
      }

      setDownloading(true);

      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `GCE-AL-${certYear}-${certIndex}.png`;
      a.click();

      toast.success(language === "en" ? "Downloaded!" : "பதிவிறக்கப்பட்டது!");
    } catch (e) {
      toast.error(
        language === "en"
          ? "Download failed (check html2canvas install)"
          : "பதிவிறக்கம் தோல்வி (html2canvas நிறுவலை சரிபார்க்கவும்)"
      );
    } finally {
      setDownloading(false);
    }
  };

  // ✅ helper: open & scroll
  const openApplyPortal = () => {
    setApplyPortalOpen(true);
    setRegPortalOpen(false);
    window.setTimeout(
      () =>
        applyPortalRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      50
    );
  };
  const openRegPortal = () => {
    setRegPortalOpen(true);
    setApplyPortalOpen(false);
    window.setTimeout(
      () =>
        regPortalRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      50
    );
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
            {language === "en" ? (
              <>
                Examination <span className="text-cyan-400">Services</span>
              </>
            ) : (
              renderCyanTail(t("exam.title"))
            )}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto"
          >
            {language === "en"
              ? "Register for exams and check your results"
              : "தேர்வுகளுக்கு பதிவு செய்யுங்கள் மற்றும் உங்கள் முடிவுகளை சரிபார்க்கவும்"}
          </motion.p>
        </motion.div>
      </section>

      <section className="relative py-16 md:py-24">
        <div className="relative z-10 container mx-auto px-4">
          <Tabs
            id="exam-tabs"
            value={activeTab}
            onValueChange={setActiveTab}
            className="max-w-4xl mx-auto"
          >
            <TabsList className="grid w-full grid-cols-2 mb-8">
              {tabOrder.map((key) => {
                const Icon = tabMeta[key].icon;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="flex items-center gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {tabMeta[key].full}
                    </span>
                    <span className="sm:hidden">{tabMeta[key].short}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* APPLY TAB */}
            <TabsContent value="apply">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* ✅ NEW: two clickable sub-cards */}
                <div className="space-y-6">
                  {/* Exam Application Portal teaser card */}
                  <Card className="overflow-hidden border border-border">
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
                        <div className="bg-gradient-to-br from-cyan-500/20 via-cyan-400/10 to-transparent p-6 flex items-center justify-center">
                          {/* ✅ IMAGE HERE */}
                          <div className="h-40 w-full rounded-2xl overflow-hidden border border-border bg-white/60">
                            <img
                              src={applyCardImg}
                              alt="Exam Application"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>

                        <div className="p-6 md:p-8 flex flex-col justify-center gap-4">
                          <div>
                            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                              {language === "en"
                                ? "Exam Application Portal"
                                : "தேர்வு விண்ணப்ப தளம்"}
                            </h2>
                            <p className="text-muted-foreground mt-2">
                              {language === "en"
                                ? "Sign up for the entrance examination by filling out the application form."
                                : "விண்ணப்பப் படிவத்தை நிரப்பி நுழைவுத் தேர்விற்கு பதிவு செய்யுங்கள்."}
                            </p>
                          </div>

                          <div>
                            <Button
                              type="button"
                              variant="donate"
                              onClick={() => {
                                if (!applyPortalOpen) openApplyPortal();
                                else setApplyPortalOpen(false);
                              }}
                              className="px-10"
                            >
                              {applyPortalOpen
                                ? language === "en"
                                  ? "Close"
                                  : "மூடு"
                                : language === "en"
                                ? "Register Now"
                                : "இப்போது பதிவு செய்"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Collapsible: Application form */}
                  <AnimatePresence initial={false}>
                    {applyPortalOpen && (
                      <motion.div
                        ref={applyPortalRef}
                        variants={collapseVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="bg-card rounded-xl p-6 md:p-8 shadow-lg">
                          <div className="mx-auto w-full max-w-md md:max-w-lg">
                            <div className="rounded-xl overflow-hidden border border-border">
                              <div className="bg-primary/90 text-primary-foreground px-5 py-4 text-center">
                                <h2 className="text-2xl md:text-3xl font-serif font-bold tracking-wide">
                                  {language === "en"
                                    ? "Apply for Your Exam"
                                    : "உங்கள் தேர்விற்கு விண்ணப்பிக்கவும்"}
                                </h2>
                              </div>

                              <div className="p-5 md:p-6 bg-card">
                                {!examSettingLoading &&
                                !examApplicationsOpen ? (
                                  <Card className="border-destructive/30 bg-destructive/5">
                                    <CardContent className="p-6 space-y-2">
                                      <h3 className="text-xl font-semibold text-destructive">
                                        {language === "en"
                                          ? "Applications are closed"
                                          : "விண்ணப்பங்கள் மூடப்பட்டுள்ளது"}
                                      </h3>
                                      <p className="text-muted-foreground">
                                        {language === "en"
                                          ? "Exam applications are currently closed. Please check back later."
                                          : "தேர்வு விண்ணப்பங்கள் தற்போது மூடப்பட்டுள்ளது. தயவுசெய்து பின்னர் மீண்டும் பார்க்கவும்."}
                                      </p>
                                    </CardContent>
                                  </Card>
                                ) : (
                                  <form
                                    onSubmit={handleApplySubmit}
                                    className="space-y-5"
                                  >
                                    <div>
                                      <label className="block text-sm font-semibold text-foreground mb-2">
                                        {language === "en"
                                          ? "Full Name"
                                          : "முழு பெயர்"}
                                      </label>
                                      <Input
                                        value={applyForm.fullName}
                                        onChange={(e) =>
                                          setApplyForm({
                                            ...applyForm,
                                            fullName: e.target.value,
                                          })
                                        }
                                        required
                                        placeholder={
                                          language === "en"
                                            ? "Enter your full name"
                                            : "உங்கள் முழு பெயரை உள்ளீடு செய்யவும்"
                                        }
                                        className={
                                          fieldErrors.fullName
                                            ? "border-red-500"
                                            : ""
                                        }
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-foreground mb-2">
                                        {language === "en"
                                          ? "Email Address"
                                          : "மின்னஞ்சல் முகவரி"}
                                      </label>
                                      <div className="relative">
                                        <Input
                                          type="email"
                                          value={applyForm.email}
                                          onChange={(e) =>
                                            handleEmailChange(e.target.value)
                                          }
                                          required
                                          placeholder={
                                            language === "en"
                                              ? "your.email@example.com"
                                              : "your.email@example.com"
                                          }
                                          className={`${
                                            emailValid === false
                                              ? "border-red-500 pr-10"
                                              : emailValid === true
                                              ? "border-green-500 pr-10"
                                              : "pr-10"
                                          } ${
                                            fieldErrors.email
                                              ? "border-red-500"
                                              : ""
                                          }`}
                                        />
                                        {applyForm.email && (
                                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            {emailValid === true && (
                                              <Check className="h-4 w-4 text-green-500" />
                                            )}
                                            {emailValid === false && (
                                              <X className="h-4 w-4 text-red-500" />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      {emailValid === false && (
                                        <p className="text-sm text-red-500 mt-1">
                                          {language === "en"
                                            ? "Please enter a valid email address"
                                            : "சரியான மின்னஞ்சல் முகவரியை உள்ளீடு செய்யவும்"}
                                        </p>
                                      )}
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-foreground mb-2">
                                        {language === "en"
                                          ? "Phone Number"
                                          : "தொலைபேசி எண்"}
                                      </label>
                                      <div className="relative">
                                        <Input
                                          inputMode="numeric"
                                          value={applyForm.phone}
                                          onChange={(e) =>
                                            handlePhoneChange(e.target.value)
                                          }
                                          required
                                          placeholder={
                                            language === "en"
                                              ? "0757575757"
                                              : "0757575757"
                                          }
                                          className={`${
                                            phoneValid === false
                                              ? "border-red-500 pr-10"
                                              : phoneValid === true
                                              ? "border-green-500 pr-10"
                                              : "pr-10"
                                          } ${
                                            fieldErrors.phone
                                              ? "border-red-500"
                                              : ""
                                          }`}
                                        />
                                        {applyForm.phone && (
                                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            {phoneValid === true && (
                                              <Check className="h-4 w-4 text-green-500" />
                                            )}
                                            {phoneValid === false && (
                                              <X className="h-4 w-4 text-red-500" />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      {phoneValid === false && (
                                        <p className="text-sm text-red-500 mt-1">
                                          {language === "en"
                                            ? "Phone number must be exactly 10 digits"
                                            : "தொலைபேசி எண் சரியாக 10 இலக்கங்கள் இருக்க வேண்டும்"}
                                        </p>
                                      )}
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {language === "en"
                                          ? "Format: 0757575757 (10 digits)"
                                          : "வடிவம்: 0757575757 (10 இலக்கங்கள்)"}
                                      </p>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-foreground mb-2">
                                        {language === "en"
                                          ? "NIC No"
                                          : "தேசிய அடையாள எண்"}
                                      </label>
                                      <div className="relative">
                                        <Input
                                          value={applyForm.nic}
                                          onChange={(e) =>
                                            handleNicChange(e.target.value)
                                          }
                                          required
                                          inputMode="numeric"
                                          placeholder={
                                            language === "en"
                                              ? "123456789012"
                                              : "123456789012"
                                          }
                                          className={`${
                                            nicValid === false ||
                                            nicDuplicate === true
                                              ? "border-red-500 pr-10"
                                              : nicValid === true &&
                                                nicDuplicate === false
                                              ? "border-green-500 pr-10"
                                              : "pr-10"
                                          } ${
                                            fieldErrors.nic
                                              ? "border-red-500"
                                              : ""
                                          }`}
                                        />
                                        {applyForm.nic && (
                                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            {nicValid === true &&
                                              nicDuplicate === false && (
                                                <Check className="h-4 w-4 text-green-500" />
                                              )}
                                            {(nicValid === false ||
                                              nicDuplicate === true) && (
                                              <X className="h-4 w-4 text-red-500" />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      {nicValid === false && (
                                        <p className="text-sm text-red-500 mt-1">
                                          {language === "en"
                                            ? "NIC number must be exactly 12 digits"
                                            : "தேசிய அடையாள எண் சரியாக 12 இலக்கங்கள் இருக்க வேண்டும்"}
                                        </p>
                                      )}
                                      {nicDuplicate === true &&
                                        nicValid === true && (
                                          <p className="text-sm text-red-500 mt-1">
                                            {language === "en"
                                              ? "This NIC has already been used for an application"
                                              : "இந்த தேசிய அடையாள எண் ஏற்கனவே விண்ணப்பத்திற்கு பயன்படுத்தப்பட்டுள்ளது"}
                                          </p>
                                        )}
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {language === "en"
                                          ? "Format: 123456789012 (12 digits)"
                                          : "வடிவம்: 123456789012 (12 இலக்கங்கள்)"}
                                      </p>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-foreground mb-2">
                                        {language === "en"
                                          ? "Select Stream"
                                          : "தேர்வைத் தேர்ந்தெடுக்கவும்"}
                                      </label>
                                      <Select
                                        value={applyForm.exam}
                                        onValueChange={(v) =>
                                          setApplyForm({
                                            ...applyForm,
                                            exam: v,
                                          })
                                        }
                                      >
                                        <SelectTrigger
                                          className={
                                            fieldErrors.exam
                                              ? "border-red-500"
                                              : ""
                                          }
                                        >
                                          <SelectValue
                                            placeholder={
                                              language === "en"
                                                ? "-- Select Your Stream --"
                                                : "-- தேர்வு --"
                                            }
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {applyExams
                                            .filter(
                                              (x) =>
                                                x !== "-- Select Your Stream --"
                                            )
                                            .map((exam) => (
                                              <SelectItem
                                                key={exam}
                                                value={exam}
                                              >
                                                {exam}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-foreground mb-2">
                                        {language === "en"
                                          ? "School Name"
                                          : "பள்ளி பெயர்"}
                                      </label>
                                      <Select
                                        value={applyForm.schoolName}
                                        onValueChange={(v) =>
                                          setApplyForm({
                                            ...applyForm,
                                            schoolName: v,
                                          })
                                        }
                                      >
                                        <SelectTrigger
                                          className={
                                            fieldErrors.schoolName
                                              ? "border-red-500"
                                              : ""
                                          }
                                        >
                                          <SelectValue
                                            placeholder={
                                              language === "en"
                                                ? "Select school"
                                                : "பள்ளியை தேர்வு செய்க"
                                            }
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {schoolOptions.map((s) => (
                                            <SelectItem key={s} value={s}>
                                              {s}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-foreground mb-2">
                                        {language === "en"
                                          ? "Gender"
                                          : "பாலினம்"}
                                      </label>
                                      <RadioGroup
                                        value={applyForm.gender}
                                        onValueChange={(v) =>
                                          setApplyForm({
                                            ...applyForm,
                                            gender: v as "male" | "female",
                                          })
                                        }
                                        className={`flex flex-row space-x-6 ${
                                          fieldErrors.gender
                                            ? "border border-red-500 rounded-md p-2"
                                            : ""
                                        }`}
                                      >
                                        <div className="flex items-center space-x-2">
                                          <RadioGroupItem
                                            value="male"
                                            id="male"
                                          />
                                          <Label htmlFor="male">
                                            {language === "en" ? "Male" : "ஆண்"}
                                          </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <RadioGroupItem
                                            value="female"
                                            id="female"
                                          />
                                          <Label htmlFor="female">
                                            {language === "en"
                                              ? "Female"
                                              : "பெண்"}
                                          </Label>
                                        </div>
                                      </RadioGroup>
                                    </div>

                                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        onClick={handleApplyReset}
                                        disabled={
                                          examSettingLoading || submitting
                                        }
                                      >
                                        {language === "en"
                                          ? "Reset"
                                          : "மீட்டமை"}
                                      </Button>
                                      <Button
                                        type="submit"
                                        variant="donate"
                                        className="w-full"
                                        disabled={
                                          !examApplicationsOpen ||
                                          examSettingLoading ||
                                          submitting
                                        }
                                      >
                                        {submitting
                                          ? language === "en"
                                            ? "Submitting..."
                                            : "சமர்ப்பிக்கிறது..."
                                          : language === "en"
                                          ? "Submit Application"
                                          : "சமர்ப்பிக்கவும்"}
                                      </Button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Check Registration Status teaser card */}
                  <Card className="overflow-hidden border border-border">
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
                        <div className="bg-gradient-to-br from-cyan-500/20 via-cyan-400/10 to-transparent p-6 flex items-center justify-center">
                          {/* ✅ IMAGE HERE */}
                          <div className="h-40 w-full rounded-2xl overflow-hidden border border-border bg-white/60">
                            <img
                              src={regCardImg}
                              alt="Check Registration"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>

                        <div className="p-6 md:p-8 flex flex-col justify-center gap-4">
                          <div>
                            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                              {language === "en"
                                ? "Check Registration Status"
                                : "பதிவு நிலையைச் சரிபார்க்கவும்"}
                            </h2>
                            <p className="text-muted-foreground mt-2">
                              {language === "en"
                                ? "Find out if you are already registered using your Index No or NIC No."
                                : "Index No அல்லது NIC No மூலம் நீங்கள் பதிவு செய்துள்ளீர்களா என்பதைச் சரிபார்க்கவும்."}
                            </p>
                          </div>

                          <div>
                            <Button
                              type="button"
                              onClick={() => {
                                if (!regPortalOpen) openRegPortal();
                                else setRegPortalOpen(false);
                              }}
                              className="px-10"
                            >
                              {regPortalOpen
                                ? language === "en"
                                  ? "Close"
                                  : "மூடு"
                                : language === "en"
                                ? "Check Registration"
                                : "பதிவைச் சரிபார்"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Collapsible: Registration check */}
                  <AnimatePresence initial={false}>
                    {regPortalOpen && (
                      <motion.div
                        ref={regPortalRef}
                        variants={collapseVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="max-w-2xl mx-auto">
                          <Card>
                            <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
                              <div className="w-full sm:w-40">
                                <Select
                                  value={regCheckIdType}
                                  onValueChange={(v) => setRegCheckIdType(v)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Index No">
                                      {language === "en"
                                        ? "Index No"
                                        : "குறிப்பு எண்"}
                                    </SelectItem>
                                    <SelectItem value="NIC No">
                                      {language === "en"
                                        ? "NIC No"
                                        : "தேசிய அடையாள எண்"}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <Input
                                value={regCheckIndex}
                                onChange={(e) =>
                                  setRegCheckIndex(e.target.value)
                                }
                                placeholder={
                                  regCheckIdType === "Index No"
                                    ? language === "en"
                                      ? "Enter Index Number (e.g. 250001M)"
                                      : "குறிப்பு எண் உள்ளிடவும் (எ.கா. 250001M)"
                                    : language === "en"
                                    ? "Enter NIC (12 digits)"
                                    : "NIC உள்ளிடவும் (12 இலக்கங்கள்)"
                                }
                                className="flex-1"
                              />

                              <div className="flex gap-2">
                                <Button
                                  onClick={(e) => handleCheckIndex(e)}
                                  disabled={regChecking}
                                  className="whitespace-nowrap"
                                >
                                  {regChecking
                                    ? language === "en"
                                      ? "Checking..."
                                      : "சரிபாரித்தல்..."
                                    : language === "en"
                                    ? "Check Registration"
                                    : "பதிவைச் சரிபார்"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setRegCheckIndex("");
                                    setRegCheckResult(null);
                                  }}
                                >
                                  {language === "en" ? "Clear" : "அழி"}
                                </Button>
                              </div>
                            </CardContent>

                            {regCheckResult && (
                              <CardContent className="border-t">
                                {regCheckResult.found ? (
                                  <div>
                                    <div className="text-sm text-muted-foreground">
                                      {language === "en"
                                        ? "Registered"
                                        : "பதிவுசெய்யப்பட்டுள்ளது"}
                                    </div>
                                    <div className="font-semibold mt-1">
                                      {regCheckResult.applicant?.fullname}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {regCheckResult.applicant?.index_no} •{" "}
                                      {regCheckResult.applicant?.school} •{" "}
                                      {regCheckResult.applicant?.nic}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm text-destructive">
                                    {regCheckIdType === "Index No"
                                      ? language === "en"
                                        ? "No registration found for that index number."
                                        : "அந்த குறிப்பு எண்ணிற்கு பதிவு கிடைக்கவில்லை."
                                      : language === "en"
                                      ? "No registration found for that NIC."
                                      : "அந்த NICக்கான பதிவு கிடைக்கவில்லை."}
                                  </div>
                                )}
                              </CardContent>
                            )}
                          </Card>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </TabsContent>

            {/* RESULTS TAB */}
            <TabsContent value="results">
              {/* unchanged except year field */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl p-6 md:p-8 shadow-lg"
              >
                <div className="min-h-[40vh] flex items-center justify-center">
                  <div className="w-full max-w-3xl">
                    {!resultsSettingLoading && !resultsPublished ? (
                      <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="p-6 space-y-2">
                          <h3 className="text-xl font-semibold text-destructive">
                            {language === "en"
                              ? "Results not published yet"
                              : "முடிவுகள் இன்னும் வெளியிடப்படவில்லை"}
                          </h3>
                          <p className="text-muted-foreground">
                            {language === "en"
                              ? "Examination results are not yet available. Please check back later."
                              : "தேர்வு முடிவுகள் இன்னும் கிடைக்கவில்லை. தயவுசெய்து பின்னர் மீண்டும் பார்க்கவும்."}
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <AnimatePresence mode="wait">
                        {!showResultSheet ? (
                          <motion.div
                            key="results-form"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.2 }}
                          >
                            <h2 className="text-2xl font-bold text-foreground mb-2">
                              {language === "en"
                                ? "View Results"
                                : "முடிவுகளை காண"}
                            </h2>
                            <p className="text-muted-foreground mb-6">
                              {language === "en"
                                ? "Check your examination results"
                                : "உங்கள் தேர்வு முடிவுகளை சரிபார்க்கவும்"}
                            </p>

                            <form
                              onSubmit={handleResultsSubmit}
                              className="space-y-4 max-w-lg"
                            >
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                  {language === "en"
                                    ? "Select Stream"
                                    : "பிரிவைத் தேர்ந்தெடுக்கவும்"}
                                </label>
                                <Select
                                  value={resultsForm.stream}
                                  onValueChange={(v) =>
                                    setResultsForm({
                                      ...resultsForm,
                                      stream: v,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        language === "en"
                                          ? "Choose stream"
                                          : "பிரிவை தேர்வு செய்க"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {resultsStreams.map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {s}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                  {language === "en"
                                    ? "Select Index / NIC"
                                    : "Index / NIC தேர்ந்தெடுக்கவும்"}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <Select
                                    value={resultsForm.idType}
                                    onValueChange={(v) =>
                                      setResultsForm({
                                        ...resultsForm,
                                        idType: v,
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {idTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                          {type}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    value={resultsForm.idValue}
                                    onChange={(e) =>
                                      setResultsForm({
                                        ...resultsForm,
                                        idValue: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      language === "en"
                                        ? "Enter value"
                                        : "உள்ளிடவும்"
                                    }
                                  />
                                </div>
                              </div>

                              {/* ✅ UPDATED: Year input (4 digits) */}
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                  {language === "en"
                                    ? "Enter Year"
                                    : "ஆண்டை உள்ளிடவும்"}
                                </label>
                                <Input
                                  inputMode="numeric"
                                  value={resultsForm.year}
                                  onChange={(e) =>
                                    setResultsForm({
                                      ...resultsForm,
                                      year: onlyDigitsMax(e.target.value, 4),
                                    })
                                  }
                                  placeholder={
                                    language === "en"
                                      ? "e.g. 2025"
                                      : "எ.கா. 2025"
                                  }
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={handleResultsReset}
                                >
                                  {language === "en" ? "Reset" : "மீட்டமை"}
                                </Button>
                                <Button
                                  type="submit"
                                  variant="donate"
                                  className="w-full"
                                >
                                  {language === "en"
                                    ? "View Results"
                                    : "முடிவுகளை காண"}
                                </Button>
                              </div>
                            </form>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="results-sheet"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.25 }}
                          >
                            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-cyan-50 via-white to-cyan-100 shadow-xl">
                              <div className="pointer-events-none absolute inset-0 opacity-40">
                                <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-cyan-200 blur-3xl" />
                                <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-cyan-200 blur-3xl" />
                              </div>

                              <div className="relative px-6 py-10 md:px-10">
                                <div
                                  ref={sheetRef}
                                  className="mx-auto w-full max-w-3xl"
                                >
                                  <div className="flex flex-col items-center text-center">
                                    <div className="h-16 w-16 rounded-full bg-white shadow-sm ring-1 ring-black/5 flex items-center justify-center overflow-hidden">
                                      <img
                                        src={emblemImg}
                                        alt="Emblem"
                                        className="h-full w-full object-cover"
                                        onError={(e) =>
                                          (e.currentTarget.style.display =
                                            "none")
                                        }
                                      />
                                    </div>

                                    <div className="mt-4 flex items-center gap-3 w-full max-w-2xl">
                                      <div className="h-px flex-1 bg-cyan-200" />
                                      <div className="h-2 w-2 rounded-full bg-cyan-300" />
                                      <div className="h-px flex-1 bg-cyan-200" />
                                    </div>

                                    <h3 className="mt-5 text-2xl md:text-3xl font-bold tracking-wide text-slate-900">
                                      G.C.E. (A/L) EXAMINATION - {certYear}
                                    </h3>
                                  </div>

                                  <div className="mt-8 rounded-2xl bg-white/90 backdrop-blur border border-cyan-200 shadow-sm">
                                    <div className="p-8">
                                      <div className="grid grid-cols-1 gap-5 text-base">
                                        <Row label="Name" value={certName} />
                                        <Row
                                          label="Index Number"
                                          value={certIndex}
                                        />
                                        <Row
                                          label="NIC Number"
                                          value={certNIC}
                                        />
                                        <Row
                                          label="School"
                                          value={certSchool}
                                        />
                                        <Row
                                          label="Stream"
                                          value={certStream}
                                        />
                                        <Row label="Z-Score" value={zScore} />
                                        <Row label="Rank" value={certRank} />
                                      </div>

                                      <div className="mt-10 overflow-hidden rounded-xl border border-slate-700">
                                        <div className="grid grid-cols-2 bg-slate-700 text-white font-semibold">
                                          <div className="px-6 py-4 text-left">
                                            Subject
                                          </div>
                                          <div className="px-6 py-4 text-center">
                                            Result
                                          </div>
                                        </div>

                                        <div className="bg-white">
                                          {[
                                            {
                                              subject:
                                                mathsOrBioLabel.toUpperCase(),
                                              result: mathsOrBioGrade,
                                            },
                                            {
                                              subject: "PHYSICS",
                                              result: physicsGrade,
                                            },
                                            {
                                              subject: "CHEMISTRY",
                                              result: chemistryGrade,
                                            },
                                          ].map((r) => (
                                            <div
                                              key={r.subject}
                                              className="grid grid-cols-2 border-t border-slate-200"
                                            >
                                              <div className="px-6 py-6 text-slate-700 font-semibold">
                                                {r.subject}
                                              </div>
                                              <div className="px-6 py-6 text-center font-extrabold text-cyan-700 text-xl">
                                                {r.result}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <p className="mt-12 text-center text-sm text-slate-500">
                                        This result is provisional and subject
                                        to official confirmation.
                                      </p>
                                      <p className="mt-3 text-center text-sm text-slate-500">
                                        Copyright © Ausdav, Vavuniya. All Rights
                                        Reserved.
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                                  <Button
                                    onClick={downloadSheetAsImage}
                                    disabled={downloading}
                                    className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                                  >
                                    <ImageDown className="w-4 h-4 mr-2" />
                                    {downloading
                                      ? language === "en"
                                        ? "Downloading..."
                                        : "பதிவிறக்கம்..."
                                      : language === "en"
                                      ? "Download"
                                      : "பதிவிறக்கு"}
                                  </Button>

                                  <Button
                                    onClick={handleResultsReset}
                                    className="bg-cyan-600 text-white hover:bg-cyan-500"
                                  >
                                    {language === "en" ? "Back" : "மீண்டும்"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              {language === "en"
                ? "Application Submitted Successfully!"
                : "விண்ணப்பம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!"}
            </DialogTitle>
            <DialogDescription>
              {language === "en" ? (
                <>
                  <div className="text-lg font-medium mb-2">
                    {registeredFullName
                      ? `Hello ${registeredFullName}!`
                      : "Hello!"}
                  </div>
                  <div>
                    Congratulations! Your exam application has been submitted
                    successfully. Please save your reference number for future
                    reference.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-medium mb-2">
                    {registeredFullName
                      ? `வணக்கம் ${registeredFullName}!`
                      : "வணக்கம்!"}
                  </div>
                  <div>
                    வாழ்த்துக்கள்! உங்கள் தேர்வு விண்ணப்பம் வெற்றிகரமாக
                    சமர்ப்பிக்கப்பட்டது. எதிர்கால குறிப்புக்கு உங்கள் குறிப்பு
                    எண்ணை சேமிக்கவும்.
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {language === "en"
                  ? "Your Reference Number:"
                  : "உங்கள் குறிப்பு எண்:"}
              </p>
              <div className="bg-primary/10 border-2 border-primary rounded-lg px-6 py-3">
                <p className="text-2xl font-bold text-primary font-mono">
                  {generatedIndexNo}
                </p>
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                {language === "en"
                  ? "Use this number to check your results and for any future communications."
                  : "உங்கள் முடிவுகளை சரிபார்க்க மற்றும் எதிர்கால தகவல்தொடர்புகளுக்கு இந்த எண்ணைப் பயன்படுத்தவும்."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setSuccessDialogOpen(false)}
              className="w-full"
            >
              {language === "en" ? "Close" : "மூடு"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExamPage;
