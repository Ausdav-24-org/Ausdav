import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useLiveViewerCount = () => {
  const [viewerCount, setViewerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);
  const updateTimeoutRef = useRef<number | null>(null);
  const lastCountRef = useRef<number>(0);
  
  useEffect(() => {
    // Check for authenticated user
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = user?.id || crypto.randomUUID();
    
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    let mounted = true;

    // Debounced update function to batch presence changes
    const scheduleUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        if (mounted) {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          
          // Only update if count changed
          if (count !== lastCountRef.current) {
            lastCountRef.current = count;
            setViewerCount(count);
          }
        }
      }, 50); // 50ms debounce to batch rapid updates
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        scheduleUpdate();
      })
      .on('presence', { event: 'join' }, () => {
        scheduleUpdate();
      })
      .on('presence', { event: 'leave' }, () => {
        scheduleUpdate();
      })
      .subscribe(async (status) => {
        if (!mounted) return;
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      mounted = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      channel.unsubscribe();
      setIsConnected(false);
    };
  }, [user]);

  return { viewerCount, isConnected, isAuthenticated: !!user };
};
