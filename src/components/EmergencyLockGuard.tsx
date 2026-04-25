import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const EmergencyLockGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    const checkEmergencyLock = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (active) setChecking(false);
          return;
        }

        // Check if user is master admin
        const { data: memberData } = await supabase
          .from('members')
          .select('is_master_admin')
          .eq('user_id', user.id)
          .maybeSingle();

        const isMaster = memberData?.is_master_admin === true;
        if (active) setIsMasterAdmin(isMaster);

        // Check if emergency lock is enabled
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('master_admin_emergency_lock')
          .eq('id', 1)
          .maybeSingle();

        if (!active) return;

        const locked = settingsData?.master_admin_emergency_lock === true;
        setIsLocked(locked);

        // If locked AND user is not master admin AND on admin page -> redirect
        if (locked && !isMaster && location.pathname.startsWith('/admin')) {
          // Don't redirect from emergency-lock page itself (master admin can manage from there)
          if (!location.pathname.includes('emergency-lock')) {
            navigate('/access-denied', { replace: true });
          }
        }
      } catch (err) {
        console.error('Emergency lock check failed:', err);
      } finally {
        if (active) setChecking(false);
      }
    };

    checkEmergencyLock();

    // Poll every 2 seconds for lock status changes
    const interval = setInterval(checkEmergencyLock, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [location.pathname, navigate]);

  if (checking) {
    return <>{children}</>;
  }

  return <>{children}</>;
};
