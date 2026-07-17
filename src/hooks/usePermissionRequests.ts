import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export interface PermissionRequest {
  id: string;
  admin_id: string;
  permission_key: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  admin_name?: string;
  admin_username?: string;
}

export interface AdminGrantedPermission {
  id: string;
  admin_id: string;
  permission_key: string;
  granted_by: string | null;
  granted_at: string;
  is_active: boolean;
}

export interface AdminWithPermissions {
  auth_user_id: string;
  mem_id: number;
  fullname: string;
  username: string;
  role: string;
  permissions: string[];
}

export interface AdminNotification {
  id: string;
  admin_id: string;
  type: 'permission_approved' | 'permission_rejected' | 'permission_revoked' | 'permission_granted' | 'info';
  title: string;
  message: string;
  is_read: boolean;
  related_permission: string | null;
  created_at: string;
}

// Type-safe wrapper for new tables not yet in the generated types
const db = supabase as any;

export const usePermissionRequests = () => {
  const { user, isSuperAdmin, isMasterAdmin, isAdmin } = useAdminAuth();
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [myRequests, setMyRequests] = useState<PermissionRequest[]>([]);
  const [adminsWithPermissions, setAdminsWithPermissions] = useState<AdminWithPermissions[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [masterAdminSuperView, setMasterAdminSuperView] = useState(false);

  const masterAdminSuperViewKey = user?.id
    ? `ausdav-master-admin-super-view-${user.id}`
    : null;
  const effectiveSuperAdmin = isSuperAdmin || (isMasterAdmin && masterAdminSuperView);

  useEffect(() => {
    if (!masterAdminSuperViewKey) {
      setMasterAdminSuperView(false);
      return;
    }

    const syncMasterAdminSuperView = () => {
      setMasterAdminSuperView(localStorage.getItem(masterAdminSuperViewKey) === 'true');
    };

    syncMasterAdminSuperView();
    window.addEventListener('storage', syncMasterAdminSuperView);
    window.addEventListener('ausdav-master-admin-super-view-change', syncMasterAdminSuperView);

    return () => {
      window.removeEventListener('storage', syncMasterAdminSuperView);
      window.removeEventListener('ausdav-master-admin-super-view-change', syncMasterAdminSuperView);
    };
  }, [masterAdminSuperViewKey]);

  // Fetch all pending requests (for super admin)
  const fetchPendingRequests = useCallback(async () => {
    if (!user || !effectiveSuperAdmin) return;

    try {
      const { data, error } = await db
        .from('permission_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch admin names for each request
      if (data && data.length > 0) {
        const adminIds = [...new Set(data.map((r: any) => r.admin_id))];
        const { data: members } = await supabase
          .from('members')
          .select('auth_user_id, fullname, username')
          .in('auth_user_id', adminIds as string[]);

        const memberMap = new Map(members?.map(m => [m.auth_user_id, m]) || []);

        const enrichedRequests = data.map((r: any) => ({
          ...r,
          admin_name: memberMap.get(r.admin_id)?.fullname || 'Unknown',
          admin_username: memberMap.get(r.admin_id)?.username || 'unknown',
        })) as PermissionRequest[];

        setRequests(enrichedRequests);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    }
  }, [user, effectiveSuperAdmin]);

  // Fetch my requests (for regular admin)
  const fetchMyRequests = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await db
        .from('permission_requests')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyRequests((data || []) as PermissionRequest[]);
    } catch (err) {
      console.error('Error fetching my requests:', err);
    }
  }, [user]);

  // Fetch all admins with their permissions (for super admin)
  const fetchAdminsWithPermissions = useCallback(async () => {
    if (!user || !effectiveSuperAdmin) return;

    try {
      // Fetch all admins
      const { data: admins, error: adminsError } = await supabase
        .from('members')
        .select('auth_user_id, mem_id, fullname, username, role')
        .in('role', ['admin', 'super_admin'])
        .not('auth_user_id', 'is', null);

      if (adminsError) throw adminsError;

      if (!admins || admins.length === 0) {
        setAdminsWithPermissions([]);
        return;
      }

      // Fetch all granted permissions
      const adminIds = admins.map(a => a.auth_user_id).filter(Boolean) as string[];
      const { data: permissions, error: permsError } = await db
        .from('admin_granted_permissions')
        .select('*')
        .in('admin_id', adminIds)
        .eq('is_active', true);

      if (permsError) throw permsError;

      // Map permissions to admins
      const permissionsByAdmin = new Map<string, string[]>();
      (permissions || []).forEach((p: any) => {
        const current = permissionsByAdmin.get(p.admin_id) || [];
        current.push(p.permission_key);
        permissionsByAdmin.set(p.admin_id, current);
      });

      const result: AdminWithPermissions[] = admins.map(admin => ({
        auth_user_id: admin.auth_user_id!,
        mem_id: admin.mem_id,
        fullname: admin.fullname,
        username: admin.username,
        role: admin.role,
        permissions: permissionsByAdmin.get(admin.auth_user_id!) || [],
      }));

      setAdminsWithPermissions(result);
    } catch (err) {
      console.error('Error fetching admins with permissions:', err);
    }
  }, [user, effectiveSuperAdmin]);

  // Fetch notifications for current user
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await db
        .from('admin_notifications')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const notifs = (data || []) as AdminNotification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [user]);

  // Submit a permission request
  const submitRequest = async (permissionKey: string, reason: string) => {
    if (!user || !isAdmin) return { success: false, error: 'Not authorized' };

    try {
      // Check if there's already a pending request
      const { data: existing } = await db
        .from('permission_requests')
        .select('id')
        .eq('admin_id', user.id)
        .eq('permission_key', permissionKey)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'You already have a pending request for this permission' };
      }

      const { error } = await db
        .from('permission_requests')
        .insert({
          admin_id: user.id,
          permission_key: permissionKey,
          reason,
        });

      if (error) throw error;

      await fetchMyRequests();
      return { success: true };
    } catch (err: any) {
      console.error('Error submitting request:', err);
      return { success: false, error: err.message };
    }
  };

  // Approve a permission request (super admin only)
  const approveRequest = async (requestId: string, note?: string) => {
    if (!user || !effectiveSuperAdmin) return { success: false, error: 'Not authorized' };

    try {
      // Get the request details
      const { data: request, error: fetchError } = await db
        .from('permission_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) throw fetchError || new Error('Request not found');

      // Update request status
      const { error: updateError } = await db
        .from('permission_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          review_note: note || null,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Grant the permission
      const { error: grantError } = await db
        .from('admin_granted_permissions')
        .upsert({
          admin_id: request.admin_id,
          permission_key: request.permission_key,
          granted_by: user.id,
          is_active: true,
        }, {
          onConflict: 'admin_id,permission_key',
        });

      if (grantError) throw grantError;

      // Create notification for the admin
      await db
        .from('admin_notifications')
        .insert({
          admin_id: request.admin_id,
          type: 'permission_approved',
          title: 'Permission Approved',
          message: `Your request for "${request.permission_key}" permission has been approved.${note ? ` Note: ${note}` : ''}`,
          related_permission: request.permission_key,
        });

      await fetchPendingRequests();
      await fetchAdminsWithPermissions();
      return { success: true };
    } catch (err: any) {
      console.error('Error approving request:', err);
      return { success: false, error: err.message };
    }
  };

  // Reject a permission request (super admin only)
  const rejectRequest = async (requestId: string, note?: string) => {
    if (!user || !effectiveSuperAdmin) return { success: false, error: 'Not authorized' };

    try {
      // Get the request details
      const { data: request, error: fetchError } = await db
        .from('permission_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) throw fetchError || new Error('Request not found');

      // Update request status
      const { error: updateError } = await db
        .from('permission_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          review_note: note || null,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Create notification for the admin
      await db
        .from('admin_notifications')
        .insert({
          admin_id: request.admin_id,
          type: 'permission_rejected',
          title: 'Permission Rejected',
          message: `Your request for "${request.permission_key}" permission has been rejected.${note ? ` Reason: ${note}` : ''}`,
          related_permission: request.permission_key,
        });

      await fetchPendingRequests();
      return { success: true };
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      return { success: false, error: err.message };
    }
  };

  // Grant permission directly (super admin only, without request)
  const grantPermission = async (adminId: string, permissionKey: string) => {
    if (!user || !effectiveSuperAdmin) return { success: false, error: 'Not authorized' };

    try {
      const { error } = await db
        .from('admin_granted_permissions')
        .upsert({
          admin_id: adminId,
          permission_key: permissionKey,
          granted_by: user.id,
          is_active: true,
        }, {
          onConflict: 'admin_id,permission_key',
        });

      if (error) throw error;

      // Create notification for the admin
      await db
        .from('admin_notifications')
        .insert({
          admin_id: adminId,
          type: 'permission_granted',
          title: 'Permission Granted',
          message: `You have been granted the "${permissionKey}" permission by a Super Admin.`,
          related_permission: permissionKey,
        });

      await fetchAdminsWithPermissions();
      return { success: true };
    } catch (err: any) {
      console.error('Error granting permission:', err);
      return { success: false, error: err.message };
    }
  };

  // Revoke permission (super admin only)
  const revokePermission = async (adminId: string, permissionKey: string) => {
    if (!user || !effectiveSuperAdmin) return { success: false, error: 'Not authorized' };

    try {
      const { error } = await db
        .from('admin_granted_permissions')
        .update({ is_active: false })
        .eq('admin_id', adminId)
        .eq('permission_key', permissionKey);

      if (error) throw error;

      // Create notification for the admin
      await db
        .from('admin_notifications')
        .insert({
          admin_id: adminId,
          type: 'permission_revoked',
          title: 'Permission Revoked',
          message: `Your "${permissionKey}" permission has been revoked by a Super Admin.`,
          related_permission: permissionKey,
        });

      await fetchAdminsWithPermissions();
      return { success: true };
    } catch (err: any) {
      console.error('Error revoking permission:', err);
      return { success: false, error: err.message };
    }
  };

  // Mark notification as read
  const markNotificationRead = async (notificationId: string) => {
    if (!user) return;

    try {
      await db
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      await fetchNotifications();
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  // Mark all notifications as read
  const markAllNotificationsRead = async () => {
    if (!user) return;

    try {
      await db
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('admin_id', user.id)
        .eq('is_read', false);

      await fetchNotifications();
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  // Get my granted permissions
  const getMyGrantedPermissions = useCallback(async (): Promise<string[]> => {
    if (!user) return [];

    try {
      const { data, error } = await db
        .from('admin_granted_permissions')
        .select('permission_key')
        .eq('admin_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data?.map((p: any) => p.permission_key) || [];
    } catch (err) {
      console.error('Error fetching my granted permissions:', err);
      return [];
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchPendingRequests(),
        fetchMyRequests(),
        fetchAdminsWithPermissions(),
        fetchNotifications(),
      ]);
      setLoading(false);
    };

    if (user) {
      fetchAll();
    }
  }, [user, fetchPendingRequests, fetchMyRequests, fetchAdminsWithPermissions, fetchNotifications]);

  return {
    // Data
    requests,
    myRequests,
    adminsWithPermissions,
    notifications,
    unreadCount,
    loading,
    // Actions
    submitRequest,
    approveRequest,
    rejectRequest,
    grantPermission,
    revokePermission,
    markNotificationRead,
    markAllNotificationsRead,
    getMyGrantedPermissions,
    // Refresh
    refresh: async () => {
      await Promise.all([
        fetchPendingRequests(),
        fetchMyRequests(),
        fetchAdminsWithPermissions(),
        fetchNotifications(),
      ]);
    },
  };
};
