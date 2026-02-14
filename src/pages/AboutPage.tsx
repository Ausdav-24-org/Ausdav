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
        </motion.div>        </motion.div>
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
                  ? "We are a passionate community of leaders, innovators, and changemakers dedicated to creating positive impact in our society. Our diverse team brings together unique perspectives and expertise to drive meaningful change."
                  : "எங்கள் சமூகத்தில் நேர்மறையான தாக்கத்தை உருவாக்க அர்ப்பணிப்புடன் செயல்படும் தலைவர்கள், புதுமைப்பித்தர்கள் மற்றும் மாற்றத்தை ஏற்படுத்துபவர்களைக் கொண்ட ஒரு தீவிர சமூகமாக நாங்கள் இருக்கிறோம். அர்த்தமுள்ள மாற்றத்தை ஏற்படுத்த எங்கள் பன்முகத்தன்மை கொண்ட குழு தனித்துவமான கண்ணோட்டங்களையும் நிபுணத்துவத்தையும் ஒன்றிணைக்கிறது."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Founded by students for students, we understand the challenges and opportunities that come with building a better future. Our organization serves as a platform for growth, learning, and collaboration."
                  : "மாணவர்களுக்காக மாணவர்களால் நிறுவப்பட்ட நாங்கள், சிறந்த எதிர்காலத்தை உருவாக்குவதில் வரும் சவால்கள் மற்றும் வாய்ப்புகளைப் புரிந்துகொள்கிறோம். எங்கள் அமைப்பு வளர்ச்சி, கற்றல் மற்றும் ஒத்துழைப்புக்கான தளமாக செயல்படுகிறது."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "Through dedication, innovation, and a commitment to excellence, we continue to expand our reach and deepen our impact in communities around the world."
                  : "அர்ப்பணிப்பு, புதுமை மற்றும் சிறந்து விளங்குவதற்கான அர்ப்பணிப்பு மூலம், உலகெங்கிலும் உள்ள சமூகங்களில் எங்கள் வரம்பை விரிவுபடுத்தி எங்கள் தாக்கத்தை ஆழப்படுத்துகிறோம்."}
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
                  ? "We organize workshops, seminars, and networking events that equip participants with the skills and knowledge needed to excel in today's dynamic environment. Our programs focus on leadership development, professional skills, and personal growth."
                  : "இன்றைய மாறும் சூழலில் சிறந்து விளங்கத் தேவையான திறன்கள் மற்றும் அறிவை பங்கேற்பாளர்களுக்கு வழங்கும் பட்டறைகள், கருத்தரங்குகள் மற்றும் நெட்வொர்க்கிங் நிகழ்வுகளை நாங்கள் ஏற்பாடு செய்கிறோம். எங்கள் திட்டங்கள் தலைமைத்துவ மேம்பாடு, தொழில்முறை திறன்கள் மற்றும் தனிப்பட்ட வளர்ச்சியில் கவனம் செலுத்துகின்றன."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Through membership programs, we connect aspiring leaders with experienced professionals who provide guidance, support, and valuable insights to help navigate career paths and overcome challenges."
                  : "உறுப்பினர் திட்டங்கள் மூலம், ஆர்வமுள்ள தலைவர்களை அனுபவம் வாய்ந்த நிபுணர்களுடன் இணைக்கிறோம், அவர்கள் வாழ்க்கைப் பாதைகளில் செல்லவும் சவால்களை சமாளிக்கவும் வழிகாட்டுதல், ஆதரவு மற்றும் மதிப்புமிக்க நுண்ணறிவுகளை வழங்குகிறார்கள்."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "We also engage in community service initiatives, collaborating with local organizations to address pressing social issues and create lasting positive change in the communities we serve."
                  : "சமூக சேவை முயற்சிகளிலும் நாங்கள் ஈடுபடுகிறோம், உள்ளூர் அமைப்புகளுடன் இணைந்து அழுத்தும் சமூகப் பிரச்சினைகளைத் தீர்க்கவும், நாங்கள் சேவை செய்யும் சமூகங்களில் நீடித்த நேர்மறையான மாற்றத்தை உருவாக்கவும் செய்கிறோம்."}
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
                  ? "Founded with a vision to transform the industry, our organization has grown from a small team of passionate individuals into a thriving company that serves clients worldwide."
                  : "தொழில்துறையை மாற்றும் தொலைநோக்குப் பார்வையுடன் நிறுவப்பட்ட எங்கள் நிறுவனம், ஆர்வமுள்ள தனிநபர்களின் ஒரு சிறிய குழுவிலிருந்து உலகளாவிய வாடிக்கையாளர்களுக்கு சேவை செய்யும் ஒரு செழிப்பான நிறுவனமாக வளர்ந்துள்ளது."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Over the years, we've remained committed to our founding principles, putting our clients first and fostering innovation and building lasting relationships based on trust and mutual success."
                  : "பல ஆண்டுகளாக, எங்கள் நிறுவனக் கொள்கைகளுக்கு நாங்கள் உறுதிபூண்டு வருகிறோம், எங்கள் வாடிக்கையாளர்களை முதன்மையாக வைத்து, புதுமைகளை வளர்த்து, நம்பிக்கை மற்றும் பரஸ்பர வெற்றியின் அடிப்படையில் நீடித்த உறவுகளை உருவாக்குகிறோம்."}
              </p>

              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "Today, we're proud to be at the forefront of our industry, continuously pushing boundaries and setting new standards for excellence."
                  : "இன்று, எங்கள் தொழில்துறையின் முன்னணியில் இருப்பதில் நாங்கள் பெருமை கொள்கிறோம், தொடர்ந்து எல்லைகளைத் தாண்டி, சிறந்து விளங்குவதற்கான புதிய தரநிலைகளை அமைக்கிறோம்."}
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
