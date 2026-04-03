import { supabase } from '@/integrations/supabase/client';

/**
 * Master Admin Service
 * Provides utilities for managing Master Admin roles and viewing admin lists
 */

export interface MasterAdmin {
  mem_id: number;
  auth_user_id: string;
  fullname: string;
  username: string;
  public_role: string;
  master_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminMember {
  mem_id: number;
  auth_user_id: string;
  fullname: string;
  username: string;
  role: string;
  is_master_admin: boolean;
  designation: string;
  created_at: string;
}

export interface MasterAdminAuditLog {
  id: string;
  master_admin_id: string;
  assigned_by: string;
  action: 'assigned' | 'revoked' | 'role_changed';
  previous_role: string | null;
  new_role: string | null;
  reason: string | null;
  assigned_at: string;
}

/**
 * Fetch all users with master_admin status
 * Only accessible by Super Admins
 */
export async function fetchMasterAdmins(): Promise<MasterAdmin[]> {
  try {
    const { data, error } = await (supabase as any).rpc('get_master_admins');
    
    if (error) {
      throw new Error(`Failed to fetch master admins: ${error.message}`);
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching master admins:', err);
    throw err;
  }
}

/**
 * Fetch all admin and super_admin users
 * Accessible by Master Admins and Super Admins
 */
export async function fetchAllAdmins(): Promise<AdminMember[]> {
  try {
    const { data, error } = await (supabase as any).rpc('get_all_admins');
    
    if (error) {
      throw new Error(`Failed to fetch admins: ${error.message}`);
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching all admins:', err);
    throw err;
  }
}

/**
 * Assign master_admin role to a member
 * Only Super Admins can perform this action
 * @param memId - Member ID to promote
 * @param reason - Optional reason for assignment
 */
export async function assignMasterAdmin(
  memId: number,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await (supabase as any).rpc('assign_master_admin', {
      p_mem_id: memId,
      p_reason: reason || null,
    });

    if (error) {
      throw new Error(`Failed to assign master admin: ${error.message}`);
    }

    return {
      success: true,
      message: (data as any)?.message || 'Master admin role assigned successfully',
    };
  } catch (err: any) {
    console.error('Error assigning master admin:', err);
    throw err;
  }
}

/**
 * Revoke master_admin role from a member
 * Only Super Admins can perform this action
 * @param memId - Member ID to demote
 * @param reason - Optional reason for revocation
 */
export async function revokeMasterAdmin(
  memId: number,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await (supabase as any).rpc('revoke_master_admin', {
      p_mem_id: memId,
      p_reason: reason || null,
    });

    if (error) {
      throw new Error(`Failed to revoke master admin: ${error.message}`);
    }

    return {
      success: true,
      message: (data as any)?.message || 'Master admin role revoked successfully',
    };
  } catch (err: any) {
    console.error('Error revoking master admin:', err);
    throw err;
  }
}

/**
 * Fetch audit log for master admin assignments/revocations
 * Only Super Admins can view this
 * @param limit - Maximum number of records to fetch
 */
export async function fetchMasterAdminAuditLog(
  limit: number = 100
): Promise<MasterAdminAuditLog[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('master_admin_audit')
      .select('*')
      .order('assigned_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }

    return ((data || []) as unknown as MasterAdminAuditLog[]);
  } catch (err) {
    console.error('Error fetching audit log:', err);
    throw err;
  }
}

/**
 * Check if a specific member is a master admin
 * @param memId - Member ID to check
 */
export async function isMasterAdmin(memId: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('is_master_admin')
      .eq('mem_id', memId)
      .single();

    if (error) {
      console.error('Error checking master admin status:', error);
      return false;
    }

    return (data as any)?.is_master_admin || false;
  } catch (err) {
    console.error('Error in isMasterAdmin:', err);
    return false;
  }
}

/**
 * Get member details by ID (for master admins to view)
 * Master Admins can view any member's details
 */
export async function getMemberDetails(memId: number) {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('mem_id', memId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch member details: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Error fetching member details:', err);
    throw err;
  }
}

/**
 * Bulk assign multiple members as master admins
 * Only for Super Admin use
 */
export async function bulkAssignMasterAdmins(
  memIds: number[]
): Promise<{ assigned: number; failed: number }> {
  let assigned = 0;
  let failed = 0;

  for (const memId of memIds) {
    try {
      await assignMasterAdmin(memId, 'Bulk assignment');
      assigned++;
    } catch (err) {
      console.error(`Failed to assign master admin to member ${memId}:`, err);
      failed++;
    }
  }

  return { assigned, failed };
}

/**
 * Get all master admins for a specific admin role
 */
export async function getMasterAdminsByPublicRole(
  publicRole: string
): Promise<MasterAdmin[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('members')
      .select('mem_id, auth_user_id, fullname, username, role, is_master_admin, created_at, updated_at')
      .eq('is_master_admin', true)
      .eq('role', publicRole as any);

    if (error) {
      throw new Error(`Failed to fetch master admins: ${error.message}`);
    }

    return ((data || []) as any).map((m: any) => ({
      ...m,
      public_role: m.role,
      master_admin: m.is_master_admin,
    })) as MasterAdmin[];
  } catch (err) {
    console.error('Error fetching master admins by role:', err);
    throw err;
  }
}

/**
 * Get audit log for a specific master admin
 */
export async function getAuditLogForMember(
  authUserId: string
): Promise<MasterAdminAuditLog[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('master_admin_audit')
      .select('*')
      .eq('master_admin_id', authUserId)
      .order('assigned_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }

    return ((data || []) as unknown as MasterAdminAuditLog[]);
  } catch (err) {
    console.error('Error fetching member audit log:', err);
    throw err;
  }
}

/**
 * Count total master admins
 */
export async function countMasterAdmins(): Promise<number> {
  try {
    const { data, error } = await (supabase as any)
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('is_master_admin', true);

    if (error) {
      throw new Error(`Failed to count master admins: ${error.message}`);
    }

    return (data as any)?.length || 0;
  } catch (err) {
    console.error('Error counting master admins:', err);
    return 0;
  }
}

/**
 * Search master admins by name or username
 */
export async function searchMasterAdmins(query: string): Promise<MasterAdmin[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('members')
      .select('mem_id, auth_user_id, fullname, username, role, is_master_admin, created_at, updated_at')
      .eq('is_master_admin', true)
      .or(`fullname.ilike.%${query}%,username.ilike.%${query}%`);

    if (error) {
      throw new Error(`Failed to search master admins: ${error.message}`);
    }

    return ((data || []) as any).map((m: any) => ({
      ...m,
      public_role: m.role,
      master_admin: m.is_master_admin,
    })) as MasterAdmin[];
  } catch (err) {
    console.error('Error searching master admins:', err);
    throw err;
  }
}

/**
 * Get administration statistics
 */
export async function getAdminStats() {
  try {
    const masterAdmins = await fetchMasterAdmins();
    const allAdmins = await fetchAllAdmins();
    const superAdmins = allAdmins.filter(a => a.role === 'super_admin');
    const regularAdmins = allAdmins.filter(a => a.role === 'admin');

    return {
      totalMasterAdmins: masterAdmins.length,
      totalAdmins: allAdmins.length,
      superAdminsCount: superAdmins.length,
      regularAdminsCount: regularAdmins.length,
      masterAdminsWithAdminRole: masterAdmins.filter(m => m.public_role === 'admin').length,
      masterAdminsWithSuperAdminRole: masterAdmins.filter(m => m.public_role === 'super_admin').length,
    };
  } catch (err) {
    console.error('Error getting admin stats:', err);
    throw err;
  }
}

export default {
  fetchMasterAdmins,
  fetchAllAdmins,
  assignMasterAdmin,
  revokeMasterAdmin,
  fetchMasterAdminAuditLog,
  isMasterAdmin,
  getMemberDetails,
  bulkAssignMasterAdmins,
  getMasterAdminsByPublicRole,
  getAuditLogForMember,
  countMasterAdmins,
  searchMasterAdmins,
  getAdminStats,
};
