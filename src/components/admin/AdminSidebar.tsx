import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Receipt,
  FileText,
  CheckSquare,
  CalendarDays,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Megaphone,
  Shield,
  Phone,
  GraduationCap,
  BookOpen,
  UserPlus,
  HandHelping,
  TrendingUp, // ✅ added for Results page icon
  Wrench,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoImg from '@/assets/logo/AUSDAV_llogo.png';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminGrantedPermissions } from '@/hooks/useAdminGrantedPermissions';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  permissionKey?: string; // Required permission for admins
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, roles: ['admin', 'super_admin'] },
  { title: 'Profile', href: '/admin/profile', icon: User, roles: ['member', 'honourable', 'admin', 'super_admin'] },

  { title: 'Members', href: '/admin/members', icon: Users, roles: ['admin', 'super_admin'], permissionKey: 'member' },

  { title: 'Applicants', href: '/admin/applicants', icon: UserPlus, roles: ['member', 'admin', 'super_admin'], permissionKey: 'applicant' },

  // ✅ ADDED: Results Page (uses same permissionKey as Applicants)
  // If your route is different, just change href.
  { title: 'Results', href: '/admin/results', icon: TrendingUp, roles: ['admin', 'super_admin'], permissionKey: 'applicant' },

  { title: 'Patrons', href: '/admin/patrons', icon: UserPlus, roles: ['super_admin'] },
  { title: 'Designations', href: '/admin/designations', icon: User, roles: ['super_admin'] },

  { title: 'Events', href: '/admin/events', icon: CalendarDays, roles: ['member', 'admin', 'super_admin'], permissionKey: 'events' },
  { title: 'Quiz', href: '/admin/quiz', icon: ClipboardCheck, roles: ['member', 'admin', 'super_admin'], permissionKey: 'quiz' },
  { title: 'Seminar', href: '/admin/seminar', icon: BookOpen, roles: ['member', 'admin', 'super_admin'], permissionKey: 'seminar' },
  { title: 'Past Papers', href: '/admin/past-paper', icon: FileText, roles: ['member', 'admin', 'super_admin'], permissionKey: 'exam' },

  { title: 'Submit Finance', href: '/admin/finance/submit', icon: Receipt, roles: ['member'] },
  { title: 'Verify Finance', href: '/admin/finance/verify', icon: CheckSquare, roles: ['admin', 'super_admin'], permissionKey: 'finance' },
  { title: 'Finance Ledger', href: '/admin/finance/ledger', icon: DollarSign, roles: ['admin', 'super_admin'], permissionKey: 'finance' },

  { title: 'Announcements', href: '/admin/announcements', icon: Megaphone, roles: ['admin', 'super_admin'], permissionKey: 'announcement' },

  { title: 'Feedback', href: '/admin/feedback', icon: Megaphone, roles: ['admin', 'super_admin'], permissionKey: 'feedback' },

  { title: 'Site Mode', href: '/admin/site-mode', icon: Wrench, roles: ['admin', 'super_admin'], permissionKey: 'settings' },

  { title: 'Claim Permission', href: '/admin/claim-permission', icon: HandHelping, roles: ['admin'] },
  { title: 'Permissions', href: '/admin/permissions', icon: Shield, roles: ['super_admin'] },
  { title: 'Contact', href: '/admin/contact', icon: Phone, roles: ['admin', 'super_admin'] },
  { title: 'Audit Log', href: '/admin/audit', icon: FileText, roles: ['super_admin'] },
  { title: 'Settings', href: '/admin/settings', icon: Settings, roles: ['super_admin'] },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { role, isSuperAdmin } = useAdminAuth();
  const { hasPermission } = useAdminGrantedPermissions();
  const [manualApplicantsOpen, setManualApplicantsOpen] = useState(false);

  useEffect(() => {
    if (!role || role === 'admin' || role === 'super_admin') return;
    let active = true;

    (async () => {
      try {
        // Select entire settings row so missing columns don't cause a DB error
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;
        if (active) setManualApplicantsOpen(Boolean((data as any)?.allow_manual_applications ?? false));
      } catch (err) {
        // Don't spam console when the column is absent; default to closed
        console.debug('Manual applications setting not available or failed to load', err);
        if (active) setManualApplicantsOpen(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [role]);

  const filteredNavItems = navItems.filter((item) => {
    if (!role) return false;

    // Check if role is allowed
    if (!item.roles.includes(role)) return false;

    // For super_admin, always show all items they have role access to
    if (isSuperAdmin) return true;

    // For admin, check if they have the required permission
    if (role === 'admin' && item.permissionKey) {
      // Allow admins to view the Feedback portal even if they don't have the granular 'feedback' grant.
      if (item.permissionKey === 'feedback') return true;
      return hasPermission(item.permissionKey);
    }

    // For members, require explicit grant for nav items that have permissionKey
    if (role === 'member' && item.permissionKey) {
      return hasPermission(item.permissionKey);
    }

    // For members, show Applicants only when manual applications are open
    if (role === 'member' && item.href === '/admin/applicants') {
      return manualApplicantsOpen;
    }

    return true;
  });

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      className="fixed left-0 top-0 z-40 h-screen bg-card/80 backdrop-blur-xl border-r border-border flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center overflow-hidden">
                <img src={logoImg} alt="AUSDAV" className="w-full h-full object-contain neon-glow" />
              </div>
              <span className="font-semibold text-foreground">
                {role === 'super_admin'
                  ? 'AUSDAV Super Admin'
                  : role === 'admin'
                    ? 'AUSDAV Admin'
                    : role === 'member'
                      ? 'AUSDAV Member'
                      : role === 'honourable'
                        ? 'AUSDAV Honourable'
                        : 'AUSDAV'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    'hover:bg-secondary/80',
                    isActive && 'bg-primary/10 text-primary border border-primary/20 neon-glow'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
                  <AnimatePresence mode="wait">
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-sm font-medium whitespace-nowrap"
                      >
                        {item.title}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Role Badge */}
      <div className="p-4 border-t border-border">
        <AnimatePresence mode="wait">
          {!collapsed && role && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div
                className={cn(
                  'px-2 py-1 rounded-md text-xs font-medium capitalize',
                  role === 'super_admin' && 'bg-red-500/20 text-red-400',
                  role === 'admin' && 'bg-primary/20 text-primary',
                  role === 'member' && 'bg-green-500/20 text-green-400',
                  role === 'honourable' && 'bg-yellow-500/20 text-yellow-400'
                )}
              >
                {role.replace('_', ' ')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
