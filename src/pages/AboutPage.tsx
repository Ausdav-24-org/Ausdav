import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Eye,
  Heart,
  Users,
  Award,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import BG1 from "@/assets/AboutUs/BG1.jpg";
import History from "@/assets/AboutUs/hostory.jpg";
import WhoWeAre from "@/assets/AboutUs/who we are.png";
import WhatWeDo from "@/assets/AboutUs/what we do.jpg";

const AboutPage: React.FC = () => {
  const { t, language } = useLanguage();
  const missionTitle = language === "en" ? "Our Mission" : "எங்கள் தூர நோக்கு";
  const [openCard, setOpenCard] = useState<string | null>(missionTitle);

  useEffect(() => {
    setOpenCard(missionTitle);
  }, [missionTitle]);

  const missionVisionValues = [
    {
      icon: Target,
      title: language === "en" ? "Our Mission" : "எங்கள் தூர நோக்கு",
      content:
        language === "en"
          ? "Our mission is to inspire and guide young students to become responsible, confident individuals who make a positive impact on society."
          : "இளம் மாணவர்கள் சமூகத்தில் நேர்மறையான தாக்கத்தை ஏற்படுத்தும் பொறுப்புள்ள, தன்னம்பிக்கை கொண்ட நபர்களாக மாற ஊக்குவித்து வழிகாட்டுவதே எங்கள் நோக்கம்.",
      color: "bg-cyan-500/20",
      icon_color: "text-cyan-500",
    },
    {
      icon: Eye,
      title: language === "en" ? "Our Vision" : "எங்கள் பணிக்கூற்று",
      content:
        language === "en"
          ? "To build a future where empowered, socially responsible young leaders drive positive change in their communities and beyond."
          : "அதிகாரம் பெற்ற, சமூகப் பொறுப்புள்ள இளம் தலைவர்கள் தங்கள் சமூகங்களிலும் அதற்கு அப்பாலும் நேர்மறையான மாற்றத்தை ஏற்படுத்தும் எதிர்காலத்தை உருவாக்குதல்.",
      color: "bg-cyan-500/20",
      icon_color: "text-cyan-500",
    },
    {
      icon: Heart,
      title: language === "en" ? "Our Values" : "எங்கள் மதிப்புகள்",
      content:
        language === "en"
          ? "We believe in honesty, teamwork, and respect for everyone. We aim to guide and support young minds to grow as responsible individuals. Through meaningful activities, we strive to make a positive impact on society."
          : "நாங்கள் நேர்மை, குழுப்பணி மற்றும் அனைவருக்கும் மரியாதை ஆகியவற்றில் நம்பிக்கை கொண்டுள்ளோம். இளம் மனங்கள் பொறுப்புள்ள நபர்களாக வளர வழிகாட்டுவதையும் ஆதரிப்பதையும் நாங்கள் நோக்கமாகக் கொண்டுள்ளோம். அர்த்தமுள்ள செயல்பாடுகள் மூலம், சமூகத்தில் நேர்மறையான தாக்கத்தை ஏற்படுத்த நாங்கள் பாடுபடுகிறோம்.",
      color: "bg-cyan-500/20",
      icon_color: "text-cyan-500",
    },
  ];

  const values = [
    { icon: Heart, en: "Integrity", ta: "நேர்மை" },
    { icon: Users, en: "Collaboration", ta: "ஒத்துழைப்பு" },
    { icon: Lightbulb, en: "Innovation", ta: "புதுமை" },
    { icon: Award, en: "Excellence", ta: "சிறந்து விளங்குதல்" },
  ];

  const stats = [
    {
      number: "2500+",
      label: language === "en" ? "Students Helped" : "உதவிய மாணவர்கள்",
    },
    {
      number: "100+",
      label: language === "en" ? "Events Organized" : "அமைத்த நிகழ்வுகள்",
    },
    {
      number: "32+",
      label: language === "en" ? "Years of Service" : "சேவை ஆண்டுகள்",
    },
    { number: "100%", label: language === "en" ? "Commitment" : "உறுதிப்பாடு" },
  ];

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Hero Section with Background Image */}
      <section
        className="relative min-h-screen bg-cover bg-center md:bg-fixed flex items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url('${BG1}')`,
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
              ? "Empowering Future Leaders Since 1993"
              : "1993 முதல் எதிர்காலத் தலைவர்களை உருவாக்குகிறோம்"}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
          >
            Building <span className="text-cyan-400">Tomorrow</span>'s Leaders
            Today
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto"
          >
            {language === "en"
              ? "Discover who we are and what we offer"
              : "நாங்கள் யார், என்ன செய்கிறோம் என்பதை அறிந்து கொள்ளுங்கள்"}
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

      {/* Mission, Vision, Values Cards */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Mobile accordion cards */}
          <div className="md:hidden space-y-4">
            {missionVisionValues.map((item, idx) => {
              const isOpen = openCard === item.title;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className="rounded-2xl border border-cyan-500/30 bg-slate-800/70 backdrop-blur-sm shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => setOpenCard(isOpen ? null : item.title)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center`}>
                        <item.icon className={`w-5 h-5 ${item.icon_color}`} />
                      </div>
                      <span className="text-base font-semibold text-white">{item.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-cyan-300 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 pb-4 text-slate-300 text-sm leading-relaxed"
                      >
                        {item.content}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Desktop/grid view */}
          <div className="hidden md:grid md:grid-cols-3 gap-8">
            {missionVisionValues.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05, y: -10 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`${item.color} backdrop-blur-sm rounded-2xl p-8 border border-cyan-500/40 hover:border-cyan-500/60 hover:bg-cyan-500/30 transition-all duration-300`}
              >
                <div
                  className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center mb-6`}
                >
                  <item.icon className={`w-6 h-6 ${item.icon_color}`} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {item.title}
                </h3>
                <p className="text-slate-300 leading-relaxed">{item.content}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Are Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="h-[400px] rounded-xl overflow-hidden border border-cyan-500/20">
                <img
                  src={WhoWeAre}
                  alt="Who We Are"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Who <span className="text-cyan-400">We</span> Are
              </h2>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "The All University Students' Development Association Vavuniya (AUSDAV) is a pioneering non-governmental organization registered under NP/DS/V/SS/153 in the Northern Province. Established in 1993, we have been committed to the comprehensive development of university students and A/L students in the Vavuniya district for over 32 years."
                  : "ஆல் யுனிவர்சிட்டி ஸ்டூடென்ட்ஸ் டெவலப்மென்ட் அசோசியேஷன் வவுனியா (AUSDAV) என்பது வடக்கு மாகாணத்தில் NP/DS/V/SS/153 என்ற எண்ணில் பதிவுசெய்யப்பட்ட ஒரு முன்னோடி அரசு சாரா நிறுவனமாகும். 1993 இல் நிறுவப்பட்ட நாங்கள், 32 ஆண்டுகளுக்கும் மேலாக வவுனியா மாவட்டத்தில் பல்கலைக்கழக மாணவர்கள் மற்றும் உயர்தர மாணவர்களின் விரிவான வளர்ச்சிக்கு அர்ப்பணிப்புடன் செயல்படுகிறோம்."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Our address is YMCA ROAD, VAVUNIYA, and we operate under the guidance of distinguished patrons including Dr.(Eng.).S.S.Sivakumar, Prof.Y.Nanthagopan, Mr.P.Anton Punethanayagam, and Mr.M.Rajmohan. We are a community of volunteer university students dedicated to serving our district."
                  : "எங்கள் முகவரி YMCA ROAD, VAVUNIYA, மேலும் Dr.(Eng.).S.S.Sivakumar, Prof.Y.Nanthagopan, Mr.P.Anton Punethanayagam, மற்றும் Mr.M.Rajmohan உள்ளிட்ட சிறந்த ஆதரவாளர்களின் வழிகாட்டுதலின் கீழ் நாங்கள் செயல்படுகிறோம். எங்கள் மாவட்டத்திற்கு சேவை செய்ய அர்ப்பணிப்புள்ள தன்னார்வ பல்கலைக்கழக மாணவர்களின் சமூகமாக நாங்கள் இருக்கிறோம்."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "Since 1993, AUSDAV has grown from a small group of dedicated students to a vibrant organization that has helped thousands of students achieve academic excellence and personal growth. Our rich history spans over three decades of continuous service."
                  : "1993 முதல், AUSDAV ஒரு சிறிய அர்ப்பணிப்புள்ள மாணவர் குழுவிலிருந்து ஆயிரக்கணக்கான மாணவர்களுக்கு கல்வி சிறப்பு மற்றும் தனிப்பட்ட வளர்ச்சியை அடைய உதவிய ஒரு உயிரோட்டமான அமைப்பாக வளர்ந்துள்ளது. எங்கள் வளமான வரலாறு மூன்று தசாப்தங்களுக்கும் மேலான தொடர்ச்சியான சேவையை உள்ளடக்கியது."}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="relative py-20 px-4 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative order-1 md:order-2"
            >
              <div className="h-[300px] md:h-[500px] rounded-xl overflow-hidden border border-cyan-500/20">
                <img
                  src={WhatWeDo}
                  alt="What We Do"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 md:order-1"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                What We <span className="text-cyan-400">Do</span>
              </h2>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "We conduct free Annual Pilot Examinations for A/L, O/L, and Grade 5 students, along with Monthly Examinations throughout the year. Our 3-day Practical Seminars provide hands-on Physics and Chemistry training for A/L students in the Vavuniya district."
                  : "நாங்கள் A/L, O/L மற்றும் 5ம் வகுப்பு மாணவர்களுக்கு இலவச வருடாந்திர பைலட் தேர்வுகளை நடத்துகிறோம், ஆண்டு முழுவதும் மாதாந்திர தேர்வுகளையும் நடத்துகிறோம். எங்கள் 3 நாள் நடைமுறை கருத்தரங்குகள் வவுனியா மாவட்டத்தில் உள்ள A/L மாணவர்களுக்கு இயற்பியல் மற்றும் வேதியியலில் நடைமுறை பயிற்சியை வழங்குகின்றன."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Through our Kalvikaram Project, we bring educational opportunities to rural and underprivileged schools. We organize Pentathlon (inter-school quiz competitions), INOVIA (science exhibitions), and Anpu Sangamam (celebrations for elders and children at orphanages and elder homes)."
                  : "எங்கள் கல்விகரம் திட்டத்தின் மூலம், கிராமப்புற மற்றும் பின்தங்கிய பள்ளிகளுக்கு கல்வி வாய்ப்புகளைக் கொண்டு செல்கிறோம். பெண்டத்லான் (பள்ளிகளுக்கிடையேயான வினாடி வினா போட்டிகள்), இன்னோவியா (அறிவியல் கண்காட்சிகள்), மற்றும் அன்பு சங்கமம் (அனாதை இல்லங்கள் மற்றும் முதியோர் இல்லங்களில் முதியோர் மற்றும் குழந்தைகளுக்கான கொண்டாட்டங்கள்) ஆகியவற்றை நாங்கள் ஏற்பாடு செய்கிறோம்."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "We also conduct Blood Donation Camps, and plan future projects including Chess Campaigns, Career Guidance Seminars, library facilities for rural schools, medical camps, and disaster relief through our 'Olirvum Vaalvum' initiative."
                  : "நாங்கள் இரத்ததான முகாம்களையும் நடத்துகிறோம், மேலும் செஸ் பிரச்சாரங்கள், தொழில் வழிகாட்டுதல் கருத்தரங்குகள், கிராமப்புற பள்ளிகளுக்கு நூலக வசதிகள், மருத்துவ முகாம்கள், மற்றும் எங்கள் 'ஒளிர்வும் வாழ்வும்' முன்முயற்சி மூலம் பேரிடர் நிவாரணம் உள்ளிட்ட எதிர்கால திட்டங்களை திட்டமிட்டுள்ளோம்."}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="relative py-20 px-4 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="h-[400px] rounded-xl overflow-hidden border border-cyan-500/20">
                <img
                  src={History}
                  alt="Our Story"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                <span className="text-cyan-400">Our</span> Story
              </h2>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "AUSDAV was established in 1993 with a vision to support and develop university students and A/L students in the Vavuniya district. What began as a small group of dedicated volunteers has grown into a recognized organization serving thousands of students each year."
                  : "1993 இல் வவுனியா மாவட்டத்தில் பல்கலைக்கழக மாணவர்கள் மற்றும் உயர்தர மாணவர்களை ஆதரிக்கவும் வளர்க்கவும் ஒரு தொலைநோக்குடன் AUSDAV நிறுவப்பட்டது. ஒரு சிறிய அர்ப்பணிப்புள்ள தன்னார்வலர்கள் குழுவாகத் தொடங்கியது ஒவ்வொரு ஆண்டும் ஆயிரக்கணக்கான மாணவர்களுக்கு சேவை செய்யும் அங்கீகரிக்கப்பட்ட அமைப்பாக வளர்ந்துள்ளது."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "For over 32 years, we've remained committed to our founding principles - providing free educational support, conducting examinations, and creating opportunities for students to excel. Our journey has been marked by countless success stories of students who have benefited from our programs."
                  : "32 ஆண்டுகளுக்கும் மேலாக, எங்கள் நிறுவனக் கொள்கைகளுக்கு நாங்கள் உறுதிபூண்டு வருகிறோம் - இலவச கல்வி ஆதரவை வழங்குதல், தேர்வுகளை நடத்துதல், மாணவர்கள் சிறந்து விளங்க வாய்ப்புகளை உருவாக்குதல். எங்கள் நிகழ்ச்சிகளிலிருந்து பயனடைந்த மாணவர்களின் எண்ணற்ற வெற்றிக் கதைகளால் எங்கள் பயணம் குறிக்கப்பட்டுள்ளது."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "Today, we're proud to be a leading student development organization in the Vavuniya district, continuously expanding our programs and reaching more students through initiatives like Kalvikaram, INOVIA, and our pilot examinations."
                  : "இன்று, வவுனியா மாவட்டத்தில் முன்னணி மாணவர் மேம்பாட்டு அமைப்பாக இருப்பதில் நாங்கள் பெருமிதம் கொள்கிறோம், கல்விகரம், இன்னோவியா மற்றும் எங்கள் பைலட் தேர்வுகள் போன்ற முயற்சிகள் மூலம் எங்கள் நிகழ்ச்சிகளை தொடர்ந்து விரிவுபடுத்தி மேலும் மாணவர்களை அடைகிறோம்."}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="text-center"
              >
                <motion.p
                  initial={{ scale: 0.5 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 + 0.2 }}
                  className="text-4xl md:text-5xl font-bold text-cyan-400 mb-2"
                >
                  {stat.number}
                </motion.p>
                <p className="text-slate-300 text-lg">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
