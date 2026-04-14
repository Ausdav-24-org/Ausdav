import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type AdminGrantedPermission = {
  permission_key: string;
  admin_id: string;
  is_active: boolean;
};

const db = supabase;

export const useAdminGrantedPermissions = () => {
  const { user, isSuperAdmin, isAdmin, role } = useAdminAuth();
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGrantedPermissions = useCallback(async () => {
    if (!user) {
      setGrantedPermissions([]);
      setLoading(false);
      return;
    }

    // Super admin has all permissions
    if (isSuperAdmin) {
      setGrantedPermissions([
        "member",
        "applicant",
        "events",
        "exam",
        "seminar",
        "finance",
        "announcement",
        "patrons",
        "feedback",
      ]);
      setLoading(false);
      return;
    }

    // Fetch explicit grants for the current authenticated user (members and admins alike)
    try {
      const { data, error } = await db
        .from("admin_granted_permissions")
        .select("permission_key")
        .eq("admin_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setGrantedPermissions(data?.map((p) => p.permission_key) || []);
    } catch (err) {
      console.error("Error fetching granted permissions:", err);
      setGrantedPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin, isAdmin]);

  useEffect(() => {
    fetchGrantedPermissions();
  }, [fetchGrantedPermissions]);

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      // Super admin always has all permissions
      if (isSuperAdmin) return true;

      // Check if the permission is granted
      return grantedPermissions.includes(permissionKey);
    },
    [isSuperAdmin, grantedPermissions]
  );

  const hasAnyPermission = useCallback(
    (permissionKeys: string[]): boolean => {
      if (isSuperAdmin) return true;
      return permissionKeys.some((key) => grantedPermissions.includes(key));
    },
    [isSuperAdmin, grantedPermissions]
  );

  return {
    grantedPermissions,
    loading,
    hasPermission,
    hasAnyPermission,
    refresh: fetchGrantedPermissions,
  };
};
