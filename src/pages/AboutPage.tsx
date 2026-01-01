import React from "react";
import { motion } from "framer-motion";
import {
  Target,
  Eye,
  Heart,
  Users,
  BookOpen,
  Award,
  Lightbulb,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import BG1 from "@/assets/AboutUs/BG1.jpg";
import History from "@/assets/AboutUs/hostory.jpg";
import WhoWeAre from "@/assets/AboutUs/who we are.png";
import WhatWeDo from "@/assets/AboutUs/what we do.jpg";

const AboutPage: React.FC = () => {
  const { t, language } = useLanguage();

  const missionVisionValues = [
    {
      icon: Target,
      title: language === "en" ? "Our Mission" : "எங்கள் நோக்கம்",
      content:
        language === "en"
          ? "Our mission is to inspire and guide young students to become responsible, confident individuals who make a positive impact on society."
          : "எங்கள் கிளையன்டுகளுக்கு ஆற்றல் சேர்க்கும் மிகச்சிறந்த பொருட்கள் மற்றும் சேவைகளை வழங்குவது.",
      color: "bg-cyan-500/20",
      icon_color: "text-cyan-500",
    },
    {
      icon: Eye,
      title: language === "en" ? "Our Vision" : "எங்கள் பார்வை",
      content:
        language === "en"
          ? "To build a future where empowered, socially responsible young leaders drive positive change in their communities and beyond."
          : "நம் தொழிலில் ஒரு உலகளாவிய தலைவராக இருப்பது.",
      color: "bg-cyan-500/20",
      icon_color: "text-cyan-500",
    },
    {
      icon: Heart,
      title: language === "en" ? "Our Values" : "எங்கள் மதிப்புகள்",
      content:
        language === "en"
          ? "We believe in honesty, teamwork, and respect for everyone. We aim to guide and support young minds to grow as responsible individuals. Through meaningful activities, we strive to make a positive impact on society."
          : "மு誠誠integrity, collaboration, innovation மற்றும் excellence.",
      color: "bg-cyan-500/20",
      icon_color: "text-cyan-500",
    },
  ];

  const values = [
    { icon: Heart, en: "Integrity", ta: "நேர்மை" },
    { icon: Users, en: "Collaboration", ta: "சहยોकम्" },
    { icon: Lightbulb, en: "Innovation", ta: "புதுமை" },
    { icon: Award, en: "Excellence", ta: "சிறப்பு" },
  ];

  const stats = [
    {
      number: "500+",
      label: language === "en" ? "Students Helped" : "கல்வியறிந்த மாணவர்கள்",
    },
    {
      number: "50+",
      label: language === "en" ? "Events Organized" : "நிகழ்வுகள்",
    },
    {
      number: "10+",
      label: language === "en" ? "Years of Service" : "வருட சேவை",
    },
    { number: "100%", label: language === "en" ? "Commitment" : "உறுதிப்பாடு" },
  ];

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
            Building <span className="text-cyan-400">Tomorrow</span>'s Leaders
            Today
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto"
          >
            Discover who we are and what we offer
          </motion.p>
        </motion.div>
      </section>

      {/* Mission, Vision, Values Cards */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {missionVisionValues.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05, y: -10 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`${item.color} backdrop-blur-sm rounded-2xl p-8 border border-cyan-500/40 hover:border-cyan-500/60 hover:bg-cyan-500/30 transition-all duration-300 cursor-pointer`}
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
                  : "நாங்கள் ஒரு வேறுபட்ட குழு, நிபுணர்களின் தொகுப்பு."}
              </p>
              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Founded by students for students, we understand the challenges and opportunities that come with building a better future. Our organization serves as a platform for growth, learning, and collaboration."
                  : "நாங்கள் மாணவர்களுக்குத் தொடக்கத்திலிருந்து உதவுகிறோம்."}
              </p>
              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "Through dedication, innovation, and a commitment to excellence, we continue to expand our reach and deepen our impact in communities around the world."
                  : "நாங்கள் உலகெங்கும் பரவி வளர்ந்து வருகிறோம்."}
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
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                What We <span className="text-cyan-400">Do</span>
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "We organize workshops, seminars, and networking events that equip participants with the skills and knowledge needed to excel in today's dynamic environment. Our programs focus on leadership development, professional skills, and personal growth."
                  : "நாங்கள் பல்வேறு நிகழ்வுகள் ஏற்பாடு செய்கிறோம்."}
              </p>
              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Through membership programs, we connect aspiring leaders with experienced professionals who provide guidance, support, and valuable insights to help navigate career paths and overcome challenges."
                  : "நாங்கள் அभिજ્ઞ निपुणर્களૈప પોરुത્તુकिरોम्."}
              </p>
              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "We also engage in community service initiatives, collaborating with local organizations to address pressing social issues and create lasting positive change in the communities we serve."
                  : "நாங்கள் சமூகத்தில் பணி செய்கிறோம்."}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="h-[500px] rounded-xl overflow-hidden border border-cyan-500/20">
                <img
                  src={WhatWeDo}
                  alt="What We Do"
                  className="w-full h-full object-cover"
                />
              </div>
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
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="text-cyan-400">Our</span> Story
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Founded with a vision to transform the industry, our organization has grown from a small team of passionate individuals into a thriving company that serves clients worldwide."
                  : "எங்கள் நிறுவனம் பெரிய வெற்றிகளுடன் வளர்ந்துவிட்டது."}
              </p>
              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                {language === "en"
                  ? "Over the years, we've remained committed to our founding principles, putting our clients first and fostering innovation and building lasting relationships based on trust and mutual success."
                  : "நாங்கள் நமது கிளையன்டுகளுக்கு சிறந்த சேவை வழங்க உறுதிபட்டுள்ளோம்."}
              </p>
              <p className="text-slate-300 text-lg leading-relaxed">
                {language === "en"
                  ? "Today, we're proud to be at the forefront of our industry, continuously pushing boundaries and setting new standards for excellence."
                  : "இன்று நாங்கள் தொழிலில் முன்னணியில் இருக்கிறோம்."}
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
