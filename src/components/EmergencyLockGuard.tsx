import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const EmergencyLockGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lastRedirect, setLastRedirect] = React.useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const checkEmergencyLock = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Skip checks if already on access-denied or emergency-lock pages
        if (
          location.pathname.includes('access-denied') || 
          location.pathname.includes('emergency-lock') ||
          location.pathname.includes('login')
        ) {
          return;
        }

        // Check if emergency lock is enabled
        // @ts-expect-error - Column exists in database after migration
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('master_admin_emergency_lock')
          .maybeSingle();

        if (!active) return;

        const locked = settingsData?.master_admin_emergency_lock === true;

        // If locked AND on admin page -> check if user is master admin
        if (locked && location.pathname.startsWith('/admin')) {
          try {
            // Check if user is master admin
            // @ts-expect-error - Column exists in database
            const { data: memberData } = await supabase
              .from('members')
              .select('is_master_admin')
              .eq('user_id', user.id)
              .maybeSingle();

            // If not master admin, redirect to access denied (only once per redirect)
            if (memberData?.is_master_admin !== true && lastRedirect !== '/access-denied') {
              setLastRedirect('/access-denied');
              navigate('/access-denied', { replace: true });
            }
          } catch (err) {
            console.error('Error checking master admin status:', err);
            // On error, assume not master admin and redirect to be safe
            if (lastRedirect !== '/access-denied') {
              setLastRedirect('/access-denied');
              navigate('/access-denied', { replace: true });
            }
          }
        } else if (!locked && lastRedirect === '/access-denied' && location.pathname.startsWith('/admin')) {
          // If lock was disabled and user is on admin page, clear the redirect state
          setLastRedirect(null);
        }
      } catch (err) {
        console.error('Emergency lock check failed:', err);
      }
    };

    checkEmergencyLock();

    // Poll every 2 seconds for lock status changes
    const interval = setInterval(checkEmergencyLock, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [location.pathname, navigate, lastRedirect]);

  return <>{children}</>;
};
