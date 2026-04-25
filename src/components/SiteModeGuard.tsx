import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  id?: number;
  site_under_construction?: boolean | null;
  restrict_public_access?: boolean | null;
  allow_admin_login?: boolean | null;
  allow_signup_when_construction?: boolean | null;
  allow_signup?: boolean | null;
  batch?: number | null;
  allow_exam_applications?: boolean | null;
  allow_results_view?: boolean | null;
  allow_finance_submissions?: boolean | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export function SiteModeGuard({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Check if user has admin role
          const { data: member, error: memberError } = await supabase
            .from('members')
            .select('role')
            .eq('auth_user_id', session.user.id)
            .maybeSingle();

          if (!memberError && member) {
            setIsAdmin(member.role === 'admin' || member.role === 'super_admin');
          }
        }
      } catch (err) {
        console.error('Failed to check admin status', err);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Load settings and poll for updates
  useEffect(() => {
    let active = true;
    let pollInterval: ReturnType<typeof setInterval>;

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;
        setSettings((data as AppSettings) ?? {});
      } catch (err) {
        console.error('Failed to load app settings', err);
      }
    };

    // Load immediately
    loadSettings().then(() => {
      if (active) setLoading(false);
    });

    // Poll every 3 seconds for setting changes
    pollInterval = setInterval(() => {
      if (active) {
        loadSettings();
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(pollInterval);
    };
  }, []);

  // Handle redirects based on site mode
  useEffect(() => {
    if (loading || !settings) return;

    const isAdminRoute = location.pathname.startsWith('/admin');
    const isAuthRoute = ['/login', '/signup', '/auth-callback', '/update-password'].includes(location.pathname);
    const isUnderConstructionRoute = location.pathname === '/under-construction';

    // If site is NOT under construction and user is on under construction page, redirect home
    if (!settings.site_under_construction && isUnderConstructionRoute) {
      navigate('/', { replace: true });
      return;
    }

    // If site is under construction
    if (settings.site_under_construction) {
      // Admins can access everything if allow_admin_login is true
      if (isAdmin && settings.allow_admin_login) {
        return;
      }

      // Public users should see under construction page
      if (!isAdmin && !isAdminRoute && !isAuthRoute && !isUnderConstructionRoute) {
        navigate('/under-construction', { replace: true });
        return;
      }

      // Auth pages should allow signup based on allow_signup_when_construction
      if (location.pathname === '/signup' && !settings.allow_signup_when_construction) {
        navigate('/under-construction', { replace: true });
        return;
      }
    }

    // If restrict_public_access is true
    if (settings.restrict_public_access && !isAdmin && !isAuthRoute && !isUnderConstructionRoute && !isAdminRoute) {
      navigate('/under-construction', { replace: true });
    }
  }, [settings, loading, isAdmin, location.pathname, navigate]);

  if (loading) {
    return children;
  }

  return children;
}
