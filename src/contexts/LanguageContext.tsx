import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type Language = "en" | "ta";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.about": "About",
    "nav.exam": "Exam",
    "nav.resources": "Resources",
    "nav.events": "Events",
    "nav.gallery": "Gallery",
    "nav.committee": "Executive Committee",
    "nav.donate": "Donate",
    "nav.login": "Login as Member",

    // Home Page
    "home.hero.title":
      "All University Students' Development Association Vavuniya",
    "home.hero.subtitle": "Empowering students, transforming futures",
    "home.hero.cta": "Learn More",
    "home.who.title": "Who We Are",
    "home.who.description":
      "AUSDAV is a non-profit organization dedicated to the holistic development of university students in Vavuniya and beyond. Founded with a vision to bridge educational gaps and foster academic excellence, we work tirelessly to support students in their academic journey.",
    "home.what.title": "What We Do",
    "home.what.description":
      "We organize educational programs, conduct seminars, provide exam preparation resources, and create networking opportunities for students across all universities.",
    "home.events.title": "Annual Events",
    "home.committee.title": "Our Leadership",
    "home.committee.viewAll": "View All Members",
    "home.feedback.title": "Share Your Feedback",
    "home.feedback.name": "Your Name (Optional)",
    "home.feedback.contact": "Email or Phone (Optional)",
    "home.feedback.message": "Your Message",
    "home.feedback.submit": "Submit Feedback",
    "home.feedback.success": "Thank you for your feedback!",

    // About Page
    "about.title": "About AUSDAV",
    "about.who.title": "Who We Are",
    "about.who.content":
      "The All University Students' Development Association Vavuniya (AUSDAV) is a pioneering non-governmental organization committed to the comprehensive development of university students. Established with the noble mission of nurturing academic excellence and personal growth, AUSDAV has become a beacon of hope for students across Vavuniya and neighboring regions.",
    "about.what.title": "What We Do",
    "about.what.content":
      "AUSDAV organizes a wide range of educational programs including exam preparation seminars, career guidance workshops, skill development sessions, and community service initiatives. We provide free study materials, past papers, and mentorship programs to help students excel in their academic pursuits.",
    "about.vision.title": "Our Vision",
    "about.vision.content":
      "To be the leading catalyst for student empowerment and academic excellence in Sri Lanka, creating a generation of educated, skilled, and socially responsible citizens.",
    "about.mission.title": "Our Mission",
    "about.mission.content":
      "To provide comprehensive educational support, foster personal development, and create opportunities for university students to achieve their full potential through innovative programs and collaborative partnerships.",

    // Executive Committee
    "committee.title": "Executive Committee",
    "committee.subtitle": "Meet the dedicated team leading AUSDAV",

    // Exam Page
    "exam.title": "Examination Services",
    "exam.apply.title": "Apply for Exam",
    "exam.apply.subtitle": "Register for upcoming examinations",
    "exam.papers.title": "Past Papers",
    "exam.papers.subtitle": "Download previous examination papers",
    "exam.results.title": "View Results",
    "exam.results.subtitle": "Check your examination results",
    "exam.form.name": "Full Name",
    "exam.form.nic": "NIC/ID Number (Optional)",
    "exam.form.phone": "Phone Number",
    "exam.form.school": "School Name",
    "exam.form.district": "District",
    "exam.form.stream": "A/L Stream",
    "exam.form.subject": "Subject",
    "exam.form.session": "Exam Session",
    "exam.form.email": "Email (Optional)",
    "exam.form.submit": "Submit Application",
    "exam.form.success":
      "Application submitted successfully! Your reference number is:",

    // Resources Page
    "resources.title": "Resources",
    "seminar.upcoming": "Upcoming Seminars",
    "seminar.past": "Past Seminars",
    "seminar.download": "Download Booklet",

    // Events Page
    "events.title": "Events & Activities",
    "events.upcoming": "Upcoming Events",
    "events.past": "Past Events",
    "events.gallery": "Photo Gallery",
    "events.viewDetails": "View Details",

    // Donate Page
    "donate.title": "Support Our Cause",
    "donate.subtitle": "Your contribution helps us empower more students",
    "donate.bank.title": "Bank Details",
    "donate.contact.title": "Contact for Donations",

    // Footer
    "footer.quickLinks": "Quick Links",
    "footer.contact": "Contact Us",
    "footer.followUs": "Follow Us",
    "footer.rights": "All rights reserved.",

    // Common
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.submit": "Submit",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.view": "View",
    "common.download": "Download",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.all": "All",
    "common.noResults": "No results found",
  },
  ta: {
    // Navigation
    "nav.home": "முகப்பு",
    "nav.about": "எங்களைப் பற்றி",
    "nav.exam": "தேர்வு",
    "nav.resources": "வளங்கள்",
    "nav.events": "நிகழ்வுகள்",
    "nav.gallery": "கேலரி",
    "nav.committee": "நிர்வாகக் குழு",
    "nav.donate": "நன்கொடை",
    "nav.login": "உறுப்பினர் உள்நுழைவு",

    // Home Page
    "home.hero.title": "அனைத்து பல்கலைக்கழக மாணவர் அபிவிருத்தி சங்கம் வவுனியா",
    "home.hero.subtitle": "மாணவர்களை வலுப்படுத்துதல், எதிர்காலத்தை மாற்றுதல்",
    "home.hero.cta": "மேலும் அறிய",
    "home.who.title": "நாங்கள் யார்",
    "home.who.description":
      "AUSDAV என்பது வவுனியா மற்றும் அதற்கு அப்பாற்பட்ட பல்கலைக்கழக மாணவர்களின் முழுமையான வளர்ச்சிக்கு அர்ப்பணிக்கப்பட்ட ஒரு இலாப நோக்கற்ற அமைப்பாகும். கல்வி இடைவெளிகளைக் குறைத்து கல்விச் சிறப்பை வளர்க்கும் தொலைநோக்குடன் நிறுவப்பட்ட நாங்கள், மாணவர்களின் கல்விப் பயணத்தில் அவர்களுக்கு ஆதரவளிக்க அயராது உழைக்கிறோம்.",
    "home.what.title": "நாங்கள் என்ன செய்கிறோம்",
    "home.what.description":
      "நாங்கள் கல்வி நிகழ்ச்சிகளை ஏற்பாடு செய்கிறோம், கருத்தரங்குகளை நடத்துகிறோம், தேர்வுத் தயாரிப்பு வளங்களை வழங்குகிறோம், மேலும் அனைத்து பல்கலைக்கழகங்களிலும் உள்ள மாணவர்களுக்கு வலைப்பின்னல் வாய்ப்புகளை உருவாக்குகிறோம்.",
    "home.events.title": "வருடாந்த நிகழ்வுகள்",
    "home.committee.title": "எங்கள் தலைமை",
    "home.committee.viewAll": "அனைத்து உறுப்பினர்களையும் காண",
    "home.feedback.title": "உங்கள் கருத்தைப் பகிரவும்",
    "home.feedback.name": "உங்கள் பெயர் (விருப்பம்)",
    "home.feedback.contact": "மின்னஞ்சல் அல்லது தொலைபேசி (விருப்பம்)",
    "home.feedback.message": "உங்கள் செய்தி",
    "home.feedback.submit": "கருத்தை சமர்ப்பி",
    "home.feedback.success": "உங்கள் கருத்துக்கு நன்றி!",

    // About Page
    "about.title": "AUSDAV பற்றி",
    "about.who.title": "நாங்கள் யார்",
    "about.who.content":
      "அனைத்து பல்கலைக்கழக மாணவர் அபிவிருத்தி சங்கம் வவுனியா (AUSDAV) என்பது பல்கலைக்கழக மாணவர்களின் விரிவான வளர்ச்சிக்கு அர்ப்பணிக்கப்பட்ட ஒரு முன்னோடி அரசு சாரா நிறுவனமாகும். கல்விச் சிறப்பு மற்றும் தனிப்பட்ட வளர்ச்சியை வளர்க்கும் உன்னத நோக்கத்துடன் நிறுவப்பட்ட AUSDAV, வவுனியா மற்றும் அண்டை பகுதிகளில் உள்ள மாணவர்களுக்கு நம்பிக்கையின் கலங்கரை விளக்கமாக மாறியுள்ளது.",
    "about.what.title": "நாங்கள் என்ன செய்கிறோம்",
    "about.what.content":
      "AUSDAV தேர்வுத் தயாரிப்பு கருத்தரங்குகள், தொழில் வழிகாட்டுதல் பட்டறைகள், திறன் மேம்பாட்டு அமர்வுகள் மற்றும் சமூக சேவை முன்முயற்சிகள் உள்ளிட்ட பரந்த அளவிலான கல்வி நிகழ்ச்சிகளை ஏற்பாடு செய்கிறது. மாணவர்கள் தங்கள் கல்விப் பயணத்தில் சிறப்பாக செயல்பட உதவுவதற்காக இலவச பாடநூல்கள், கடந்த கால வினாத்தாள்கள் மற்றும் வழிகாட்டுதல் திட்டங்களை வழங்குகிறோம்.",
    "about.vision.title": "எங்கள் தொலைநோக்கு",
    "about.vision.content":
      "இலங்கையில் மாணவர் வலுவூட்டல் மற்றும் கல்விச் சிறப்புக்கான முன்னணி ஊக்கியாக இருத்தல், கல்வியறிவு, திறமையான மற்றும் சமூக பொறுப்புள்ள குடிமக்களின் தலைமுறையை உருவாக்குதல்.",
    "about.mission.title": "எங்கள் பணி",
    "about.mission.content":
      "புதுமையான நிகழ்ச்சிகள் மற்றும் கூட்டு பங்காளித்துவங்கள் மூலம் பல்கலைக்கழக மாணவர்கள் தங்கள் முழு திறனை அடைய விரிவான கல்வி ஆதரவை வழங்குதல், தனிப்பட்ட வளர்ச்சியை வளர்த்தல் மற்றும் வாய்ப்புகளை உருவாக்குதல்.",

    // Executive Committee
    "committee.title": "நிர்வாகக் குழு",
    "committee.subtitle":
      "AUSDAV ஐ வழிநடத்தும் அர்ப்பணிப்புள்ள குழுவை சந்தியுங்கள்",

    // Exam Page
    "exam.title": "தேர்வு சேவைகள்",
    "exam.apply.title": "தேர்வுக்கு விண்ணப்பிக்க",
    "exam.apply.subtitle": "வரவிருக்கும் தேர்வுகளுக்கு பதிவு செய்யுங்கள்",
    "exam.papers.title": "கடந்த கால வினாத்தாள்கள்",
    "exam.papers.subtitle": "முந்தைய தேர்வு வினாத்தாள்களை பதிவிறக்கவும்",
    "exam.results.title": "முடிவுகளைக் காண",
    "exam.results.subtitle": "உங்கள் தேர்வு முடிவுகளை சரிபார்க்கவும்",
    "exam.form.name": "முழு பெயர்",
    "exam.form.nic": "தேசிய அடையாள அட்டை எண் (விருப்பம்)",
    "exam.form.phone": "தொலைபேசி எண்",
    "exam.form.school": "பாடசாலை பெயர்",
    "exam.form.district": "மாவட்டம்",
    "exam.form.stream": "உயர்தர பிரிவு",
    "exam.form.subject": "பாடம்",
    "exam.form.session": "தேர்வு அமர்வு",
    "exam.form.email": "மின்னஞ்சல் (விருப்பம்)",
    "exam.form.submit": "விண்ணப்பத்தை சமர்ப்பி",
    "exam.form.success":
      "விண்ணப்பம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது! உங்கள் குறிப்பு எண்:",

    // Resources Page
    "resources.title": "வளங்கள்",
    "seminar.upcoming": "வரவிருக்கும் கருத்தரங்குகள்",
    "seminar.past": "கடந்த கருத்தரங்குகள்",
    "seminar.download": "கையேட்டை பதிவிறக்கு",

    // Events Page
    "events.title": "நிகழ்வுகள் & செயல்பாடுகள்",
    "events.upcoming": "வரவிருக்கும் நிகழ்வுகள்",
    "events.past": "கடந்த நிகழ்வுகள்",
    "events.gallery": "புகைப்பட தொகுப்பு",
    "events.viewDetails": "விவரங்களைக் காண",

    // Donate Page
    "donate.title": "எங்கள் நோக்கத்தை ஆதரியுங்கள்",
    "donate.subtitle": "உங்கள் பங்களிப்பு மேலும் பல மாணவர்களுக்கு உதவுகிறது",
    "donate.bank.title": "வங்கி விவரங்கள்",
    "donate.contact.title": "நன்கொடைகளுக்கு தொடர்பு",

    // Footer
    "footer.quickLinks": "விரைவு இணைப்புகள்",
    "footer.contact": "எங்களை தொடர்பு கொள்ள",
    "footer.followUs": "எங்களை பின்தொடரவும்",
    "footer.rights": "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",

    // Common
    "common.loading": "ஏற்றுகிறது...",
    "common.error": "ஏதோ தவறு நடந்துவிட்டது",
    "common.submit": "சமர்ப்பி",
    "common.cancel": "ரத்து செய்",
    "common.save": "சேமி",
    "common.delete": "நீக்கு",
    "common.edit": "திருத்து",
    "common.view": "காண்",
    "common.download": "பதிவிறக்கு",
    "common.search": "தேடு",
    "common.filter": "வடிகட்டு",
    "common.all": "அனைத்தும்",
    "common.noResults": "முடிவுகள் இல்லை",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("ausdav-language");
    return (saved as Language) || "en";
  });

  useEffect(() => {
    localStorage.setItem("ausdav-language", language);
    document.documentElement.lang = language;
    if (language === "ta") {
      document.body.classList.add("font-tamil");
    } else {
      document.body.classList.remove("font-tamil");
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
