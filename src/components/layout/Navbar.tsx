import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sun, Moon, Globe, Heart, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import logoImg from '@/assets/logo/AUSDAV_llogo.png';
import { cn } from '@/lib/utils';

const PROFILE_IMG = "/ausdav/src/assets/Committee/2022/Ruthu.jpg";

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasUser, setHasUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userLabel, setUserLabel] = useState('');
  const [isQuizEnabled, setIsQuizEnabled] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAvatarForUser = async (userId: string) => {
      const { data: member } = await supabase
        .from('members')
        .select('fullname, profile_bucket, profile_path, role')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (isMounted && member?.fullname) setUserLabel(member.fullname);

      if (!member?.profile_path) {
        if (isMounted) setAvatarUrl(null);
        // also set admin flag from member row if available
        if (isMounted) setIsAdmin(!!(member && (member.role === 'admin' || member.role === 'super_admin')));
        return;
      }

      // set admin flag when member exists
      if (isMounted) setIsAdmin(!!(member && (member.role === 'admin' || member.role === 'super_admin')));

      const bucket = member.profile_bucket || 'member-profiles';
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(member.profile_path, 60 * 60);

      if (isMounted) {
        setAvatarUrl(error ? null : data?.signedUrl ?? null);
      }
    };

    const loadFromSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        if (isMounted) {
          setAvatarUrl(null);
          setHasUser(false);
          setUserLabel('');
          setIsAdmin(false);
        }
        return;
      }
      if (isMounted) {
        const metaName = (session?.user?.user_metadata as any)?.full_name as string | undefined;
        setUserLabel(metaName || session?.user?.email || '');
        // check metadata roles fallback
        const meta = session?.user?.user_metadata as any;
        const metaIsAdmin = meta?.is_super_admin === true || (Array.isArray(meta?.roles) && (meta.roles.includes('admin') || meta.roles.includes('super_admin')));
        setIsAdmin(!!metaIsAdmin);
      }
      if (isMounted) setHasUser(true);
      await loadAvatarForUser(userId);
    };

    loadFromSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (!userId) {
        setAvatarUrl(null);
        setHasUser(false);
        setUserLabel('');
        setIsAdmin(false);
        return;
      }
      const metaName = (session?.user?.user_metadata as any)?.full_name as string | undefined;
      setUserLabel(metaName || session?.user?.email || '');
      setHasUser(true);
      loadAvatarForUser(userId);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchQuizStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("allow_exam_applications")
          .single();

        if (error) throw error;
        setIsQuizEnabled(data?.allow_exam_applications || false);
      } catch (error) {
        console.error("Error fetching quiz status:", error);
        setIsQuizEnabled(false);
      }
    };

    fetchQuizStatus();

    // Listen for changes to app_settings
    const channel = supabase
      .channel('quiz-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
        },
        () => {
          fetchQuizStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/about", label: t("nav.about") },
    { href: "/exam", label: t("nav.exam") },
    ...(isQuizEnabled ? [{ href: "/quiz", label: "Quiz" }] : []),
    { href: "/resources", label: t("nav.resources") },
    { href: "/events", label: t("nav.events") },
    { href: "/committee", label: t("nav.committee") },
  ];

  const isActive = (path: string) => location.pathname === path;
  const initials = userLabel
    ? userLabel
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled ? "glass-card shadow-lg" : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="relative"
            >
              <div className="w-12 h-12 bg-transparent rounded-full flex items-center justify-center">
                {/* <Sparkles className="w-6 h-6 text-primary-foreground" /> */}
                <img src={logoImg} alt="AUSDAV Logo" className="absolute inset-0 w-full h-full object-contain bg-transparent neon-glow rounded-full" />
              </div>
              <div className="absolute right-0 bottom-0 w-full h-full rounded-xl bg-primary/20 blur-xl group-hover:blur-2xl transition-all" />
            </motion.div>
            <div className="hidden sm:block">
              <span className="font-bold text-xl text-foreground tracking-tight">
                AUSDAV
              </span>
              <div className="h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-primary to-transparent transition-all duration-300" />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link, index) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={link.href}
                  className={cn(
                    "relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                    isActive(link.href)
                      ? "text-primary"
                      : "text-foreground/70 hover:text-foreground"
                  )}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Donate Button */}
            <Button
              asChild
              variant="donate"
              size="sm"
              className="hidden sm:flex"
            >
              <Link to="/donate">
                <Heart className="w-4 h-4 mr-1.5" />
                {t("nav.donate")}
              </Link>
            </Button>

            {/* Mobile-only Donate (icon-only, like floating widget) */}
            <Link
              to="/donate"
              aria-label={language === "en" ? "Donate" : "நன்கொடை"}
              className={cn(
                "relative flex items-center justify-center w-9 h-9 rounded-full sm:hidden",
                "bg-primary text-primary-foreground neon-glow",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "hover:scale-105 active:scale-95",
                isActive("/donate") && "ring-2 ring-primary-foreground/50"
              )}
            >
              <Heart className="w-4 h-4" />
            </Link>

            {/* Theme Toggle */}
            {/* <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-foreground/70 hover:text-primary hover:bg-primary/10"
              aria-label="Toggle theme"
            >
              <motion.div
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {theme === "light" ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </motion.div>
            </Button> */}

            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground/70 hover:text-primary hover:bg-primary/10 gap-1.5"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">
                    {language === "en" ? "EN" : "TA"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                <DropdownMenuItem
                  onClick={() => setLanguage("en")}
                  className={cn(
                    "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950",
                    language === "en" && "text-primary bg-primary/10"
                  )}
                >
                  English
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage("ta")}
                  className={cn(
                    "cursor-pointer font-tamil hover:bg-blue-100 dark:hover:bg-blue-950",
                    language === "ta" && "text-primary bg-primary/10"
                  )}
                >
                  தமிழ்
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ✅ Profile Avatar Dropdown */}
            {hasUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-1 flex items-center justify-center rounded-full p-0.5 hover:bg-primary/10 transition"
                    aria-label="Account menu"
                  >
                    <Avatar className="h-8 w-8 border border-primary/20">
                      <AvatarImage src={avatarUrl || PROFILE_IMG} alt="Profile" />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="glass-card w-40 p-1.5 border border-white/20 shadow-xl"
                >
                  {/* ?o. FIXED: use route path */}
                  <DropdownMenuItem asChild className="cursor-pointer rounded-md hover:bg-blue-100 dark:hover:bg-blue-950">
                    <Link to="/profile" className="w-full px-2 py-1.5">
                      Profile
                    </Link>
                  </DropdownMenuItem>

                  {isAdmin && (
                    <DropdownMenuItem asChild className="cursor-pointer rounded-md hover:bg-blue-100 dark:hover:bg-blue-950">
                      <Link to="/admin" className="w-full px-2 py-1.5">
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    className="cursor-pointer rounded-md hover:bg-blue-100 dark:hover:bg-blue-950"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate('/');
                    }}
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
