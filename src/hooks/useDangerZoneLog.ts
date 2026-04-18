import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

interface DangerZoneLogEntry {
  page: string;
  action: string;
  targetId?: string;
  targetName?: string;
  reasonNote?: string;
}

export const useDangerZoneLog = () => {
  const { user } = useAdminAuth();

  const logDangerAction = async (entry: DangerZoneLogEntry) => {
    if (!user?.id) {
      console.warn('Cannot log danger zone action: User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { error } = await (supabase as any)
        .from('admin_danger_zone_logs')
        .insert({
          admin_id: user.id,
          page: entry.page,
          action: entry.action,
          target_id: entry.targetId || null,
          target_name: entry.targetName || null,
          reason_note: entry.reasonNote || null,
          status: 'completed',
        });

      if (error) {
        console.error('Failed to log danger action:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Logged danger zone action: ${entry.action} on ${entry.page}`);
      return { success: true };
    } catch (err: any) {
      console.error('Error logging danger action:', err);
      return { success: false, error: err.message };
    }
  };

  const getDangerLogs = async (page?: string, action?: string) => {
    try {
      let query = (supabase as any)
        .from('admin_danger_zone_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (page) query = query.eq('page', page);
      if (action) query = query.eq('action', action);

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Error fetching danger logs:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    logDangerAction,
    getDangerLogs,
  };
};
