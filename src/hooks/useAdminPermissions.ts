import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export interface AdminPermission {
  id: string;
  permission_key: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  updated_at: string;
}

export const useAdminPermissions = () => {
  const { user, role, isSuperAdmin, isAdmin } = useAdminAuth();
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("admin_permissions")
        .select("*")
        .order("display_name");

      if (error) throw error;
      setPermissions(data || []);
    } catch (err) {
      console.error("Error fetching permissions:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const togglePermission = async (permissionKey: string, newValue: boolean) => {
    if (!isSuperAdmin) return false;

    try {
      const { error } = await supabase
        .from("admin_permissions")
        .update({
          is_enabled: newValue,
          updated_by: user?.id,
        })
        .eq("permission_key", permissionKey);

      if (error) throw error;

      // Log audit
      await supabase.rpc("log_audit_event", {
        _action: newValue ? "enable_permission" : "disable_permission",
        _entity_type: "admin_permission",
        _entity_id: permissionKey,
        _details: { permission_key: permissionKey, new_value: newValue },
      });

      await fetchPermissions();
      return true;
    } catch (err) {
      console.error("Error toggling permission:", err);
      return false;
    }
  };

  const checkPermission = (permissionKey: string): boolean => {
    // Super admin always has all permissions
    if (isSuperAdmin) return true;

    // Admin needs the permission to be enabled
    if (isAdmin) {
      const permission = permissions.find(
        (p) => p.permission_key === permissionKey
      );
      return permission?.is_enabled ?? false;
    }

    return false;
  };

  return {
    permissions,
    loading,
    togglePermission,
    checkPermission,
    refresh: fetchPermissions,
  };
};
