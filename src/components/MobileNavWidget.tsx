import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Info, FileText, BookOpen, Calendar, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ElementType;
  labelEn: string;
  labelTa: string;
}

const navItems: NavItem[] = [
  { href: "/", icon: Home, labelEn: "Home", labelTa: "முகப்பு" },
  { href: "/about", icon: Info, labelEn: "About", labelTa: "எங்களை" },
  { href: "/exam", icon: FileText, labelEn: "Exam", labelTa: "தேர்வு" },
  { href: "/resources", icon: BookOpen, labelEn: "Resources", labelTa: "வளங்கள்" },
  { href: "/events", icon: Calendar, labelEn: "Events", labelTa: "நிகழ்வுகள்" },
  { href: "/committee", icon: Users, labelEn: "Committee", labelTa: "குழு" },
];

const MobileNavWidget: React.FC = () => {
  const location = useLocation();
  const { language } = useLanguage();

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("fixed bottom-0  inset-x-0 flex justify-center z-[70] lg:hidden")}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center gap-1.5 px-2 py-3 rounded-t-3xl rounded-b-none glass-card border border-border/30 neon-glow">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const label = language === "en" ? item.labelEn : item.labelTa;

          return (
            <Link
              key={item.href}
              to={item.href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex bottom-1 flex-col items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.1 }}
              >
                <Icon className="w-4 h-4" />
              </motion.div>

              {active && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute inset-0 rounded-full bg-primary/15 border border-primary/30"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}

              {active && (
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "absolute -bottom-4 text-[10px] font-medium text-primary whitespace-nowrap",
                    language === "ta" && "font-tamil"
                  )}
                >
                  {label}
                </motion.span>
              )}
            </Link>
          );
        })}

      </div>
    </motion.nav>
  );
};

export default MobileNavWidget;
