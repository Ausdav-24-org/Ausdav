import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldAlert,
  Loader2,
  Plus,
  X,
  Eye,
  Users,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface MasterAdmin {
  mem_id: number;
  auth_user_id: string;
  fullname: string;
  username: string;
  public_role: string;
  master_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminMember {
  mem_id: number;
  auth_user_id: string;
  fullname: string;
  username: string;
  role: string;
  is_master_admin: boolean;
  designation: string;
  created_at: string;
}

interface MasterAdminAuditLog {
  id: string;
  master_admin_id: string;
  assigned_by: string;
  action: 'assigned' | 'revoked' | 'role_changed';
  previous_role: string;
  new_role: string;
  reason: string | null;
  assigned_at: string;
}

interface AdminPermission {
  id: string;
  member_id: number;
  granted_by_id: number;
  permission_type: string;
  granted_at?: string;
  created_at?: string;
  assigned_at?: string;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  member_name?: string;
  member_email?: string;
  granted_by_name?: string;
}

interface MemberDetails {
  mem_id: number;
  auth_user_id: string;
  fullname: string;
  username: string;
  email: string;
  role: string;
  is_master_admin: boolean;
  designation: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  profile_bucket: string;
  profile_path: string | null;
  created_at: string;
  updated_at: string;
}

interface FinanceTransaction {
  fin_id: number;
  exp_type: 'income' | 'expense';
  party_role: 'payer' | 'payee';
  amount: number;
  txn_date: string | null;
  category: string;
  description: string;
  created_at: string;
  submitted_by: string | null;
  approved: boolean;
}

interface AuditAction {
  id: number;
  year: number;
  event: string;
  bucket_id: string;
  object_path: string;
  file_name: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export default function AdminMasterAdminPage() {
  const { isMasterAdmin } = useAdminAuth();
  const { toast } = useToast();
  const [masterAdmins, setMasterAdmins] = useState<MasterAdmin[]>([]);
  const [members, setMembers] = useState<MemberDetails[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'master-admins' | 'members' | 'permissions' | 'finance' | 'audit'>('master-admins');
  const [financeSearchQuery, setFinanceSearchQuery] = useState('');
  const [financeFilterType, setFinanceFilterType] = useState<string>('all');
  const [expandedAuditYear, setExpandedAuditYear] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterBatch, setFilterBatch] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDetails | null>(null);
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<MemberDetails | null>(null);
  const [memberPhotoUrls, setMemberPhotoUrls] = useState<Map<number, string>>(new Map());
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [showRevokePasswordDialog, setShowRevokePasswordDialog] = useState(false);
  const [revokePassword, setRevokePassword] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<{ memId: number; fullname: string } | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'finance') {
      fetchFinanceTransactions();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    let isActive = true;

    const loadMemberPhotos = async () => {
      if (!members?.length) {
        if (isActive) setMemberPhotoUrls(new Map());
        return;
      }

      const entries = await Promise.all(
        members
          .filter((member) => member.profile_path) // Only process members with profile_path
          .map(async (member) => {
            const bucket = member.profile_bucket || 'member-profiles';
            
            try {
              // Create signed URL using the profile_path from the database
              const { data, error } = await supabase.storage
                .from(bucket)
                .createSignedUrl(member.profile_path!, 60 * 60); // 1 hour validity
              
              if (!error && data?.signedUrl) {
                return [member.mem_id, data.signedUrl] as const;
              }

              return [member.mem_id, ""] as const;
            } catch (err) {
              // Silently fail for individual members
              return [member.mem_id, ""] as const;
            }
          })
      );

      if (!isActive) return;
      setMemberPhotoUrls(new Map(entries));
    };

    loadMemberPhotos();

    return () => {
      isActive = false;
    };
  }, [members]);

  const fetchFinanceTransactions = async () => {
    setFinanceLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('finance')
        .select('*')
        .eq('approved', true)
        .order('txn_date', { ascending: false });
      
      if (error) throw error;
      setFinanceTransactions((data as FinanceTransaction[]) || []);
    } catch (err: any) {
      console.error('Error fetching finance transactions:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load finance transactions',
      });
    } finally {
      setFinanceLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('audit_actions')
        .select('*')
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAuditLogs((data as AuditAction[]) || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load audit logs',
      });
    } finally {
      setAuditLoading(false);
    }
  };

  const handleOpenAuditFile = async (record: AuditAction) => {
    try {
      const { data, error } = await supabase.storage
        .from(record.bucket_id)
        .createSignedUrl(record.object_path, 300);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Failed to create file link');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('Error opening audit file:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to open audit file',
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch master admins
      const { data: masterAdminsData, error: masterError } = await (supabase as any).rpc(
        'get_master_admins'
      );
      if (masterError) throw masterError;
      setMasterAdmins((masterAdminsData as MasterAdmin[]) || []);

      // Fetch all members
      const { data: membersData, error: membersError } = await (supabase as any)
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });
      if (membersError) throw membersError;
      setMembers((membersData as MemberDetails[]) || []);

      // Fetch admin permissions from admin_granted_permissions table with granted_by user details
      try {
        const { data: permissionsData, error: permissionsError } = await (supabase as any)
          .from('admin_granted_permissions')
          .select('*')
          .eq('is_active', true);
        
        if (permissionsError) {
          console.warn('Error fetching permissions:', permissionsError);
          setPermissions([]);
        } else {
          console.log('✅ All active permissions fetched:', permissionsData);
          
          // Transform and group permissions by admin
          const permissionsByAdmin: Record<string, AdminPermission> = {};
          
          (permissionsData || []).forEach((perm: any) => {
            // Get admin info from members data (search by auth_user_id)
            const admin = (membersData || []).find(m => m.auth_user_id === perm.admin_id);
            
            // Get the user who granted this permission (search by auth_user_id)
            const grantedByUser = (membersData || []).find(m => m.auth_user_id === perm.granted_by);
            
            const adminKey = admin?.email || perm.admin_id; // Use email as unique key
            
            if (!permissionsByAdmin[adminKey]) {
              // Create first permission entry for this admin
              permissionsByAdmin[adminKey] = {
                id: perm.id,
                member_id: admin?.mem_id || 0,
                granted_by_id: 0,
                permission_type: perm.permission_key, // Will be converted to array later
                member_name: admin?.fullname || 'Unknown',
                member_email: admin?.email || '',
                granted_by_name: grantedByUser?.fullname || 'Super Admin',
                created_at: perm.granted_at,
              };
            } else {
              // Add to existing admin's permissions
              const existing = permissionsByAdmin[adminKey];
              existing.permission_type = (existing.permission_type as string) + ', ' + perm.permission_key;
            }
          });
          
          const transformedPermissions = Object.values(permissionsByAdmin);
          console.log('🎯 Grouped permissions by admin:', transformedPermissions);
          console.log(`Total admin(s) with permissions: ${transformedPermissions.length}`);
          setPermissions(transformedPermissions);
        }
      } catch (err) {
        console.warn('Permissions feature not available:', err);
        setPermissions([]);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignMasterAdmin = useCallback(async () => {
    if (!selectedMember) return;

    setIsAssigning(true);
    try {
      const { data, error } = await (supabase as any).rpc('assign_master_admin', {
        p_mem_id: selectedMember.mem_id,
        p_reason: reason || null,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${selectedMember.fullname} has been assigned as Master Admin`,
      });

      setShowAssignModal(false);
      setSelectedMember(null);
      setReason('');
      await fetchData();
    } catch (err: any) {
      console.error('Error assigning master admin:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to assign master admin',
      });
    } finally {
      setIsAssigning(false);
    }
  }, [selectedMember, reason, toast]);

  const handleRevokeMasterAdmin = useCallback((memId: number, fullname: string) => {
    setRevokeTarget({ memId, fullname });
    setRevokePassword('');
    setShowRevokePasswordDialog(true);
  }, []);

  const handleViewMemberDetails = useCallback((member: MemberDetails) => {
    setSelectedMemberDetails(member);
    setShowDetailsModal(true);
  }, []);

  const confirmRevokeWithPassword = useCallback(async () => {
    if (!revokeTarget) return;

    // Check password
    const PROTECTION_PASSWORD = '26/11/2003';
    if (revokePassword !== PROTECTION_PASSWORD) {
      toast({
        variant: 'destructive',
        title: 'Invalid Password',
        description: 'The password you entered is incorrect. Master admin was not removed.',
      });
      setRevokePassword('');
      setShowRevokePasswordDialog(false);
      return;
    }

    setIsRevoking(true);
    try {
      const { data, error } = await (supabase as any).rpc('revoke_master_admin', {
        p_mem_id: revokeTarget.memId,
        p_reason: 'Revoked by super admin',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Master admin role revoked from ${revokeTarget.fullname}`,
      });

      setShowRevokePasswordDialog(false);
      setRevokeTarget(null);
      setRevokePassword('');
      await fetchData();
    } catch (err: any) {
      console.error('Error revoking master admin:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to revoke master admin',
      });
    } finally {
      setIsRevoking(false);
    }
  }, [revokeTarget, revokePassword, toast]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        member.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false);

      const matchesRole = filterRole === '' || member.role === filterRole;
      const matchesBatch = filterBatch === '' || (member as any).batch === parseInt(filterBatch);

      return matchesSearch && matchesRole && matchesBatch;
    });
  }, [members, searchQuery, filterRole, filterBatch]);

  const filteredMasterAdmins = useMemo(
    () =>
      masterAdmins.filter((admin) =>
        admin.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.username.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [masterAdmins, searchQuery]
  );

  const assignableAdmins = useMemo(
    () =>
      members.filter(
        (admin) => !admin.is_master_admin && (admin.role === 'admin' || admin.role === 'super_admin')
      ),
    [members]
  );

  const uniqueBatches = useMemo(
    () => [...new Set(members.map((m: any) => m.batch))].filter(Boolean).sort(),
    [members]
  );

  const uniqueRoles = useMemo(() => [...new Set(members.map((m) => m.role))].sort(), [members]);

  const filteredFinanceTransactions = useMemo(() => {
    return financeTransactions.filter((txn) => {
      const matchesSearch =
        txn.category.toLowerCase().includes(financeSearchQuery.toLowerCase()) ||
        txn.description.toLowerCase().includes(financeSearchQuery.toLowerCase());
      const matchesType = financeFilterType === 'all' || txn.exp_type === financeFilterType;
      return matchesSearch && matchesType;
    });
  }, [financeTransactions, financeSearchQuery, financeFilterType]);

  const financeStats = useMemo(() => {
    const income = filteredFinanceTransactions
      .filter((t) => t.exp_type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredFinanceTransactions
      .filter((t) => t.exp_type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredFinanceTransactions]);

  // Check if user is Master Admin (after all hooks)
  if (!isMasterAdmin) {
    return (
      <div className="p-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-sm text-muted-foreground mt-2">Only master admins can access master admin controls.</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <AdminHeader
        title="Master Admin Control Center"
        breadcrumb="Admin / Master Admin Control"
      />

      {/* Tabs */}
      <div className="mt-6 border-b border-border">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('master-admins')}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === 'master-admins'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="inline mr-2 h-4 w-4" />
            Master Admins
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === 'members'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="inline mr-2 h-4 w-4" />
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === 'permissions'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert className="inline mr-2 h-4 w-4" />
            Access Permissions ({permissions.length})
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === 'finance'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <DollarSign className="inline mr-2 h-4 w-4" />
            Finance Ledger
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === 'audit'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="inline mr-2 h-4 w-4" />
            Audit Logs
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-6">
          {/* MASTER ADMINS TAB */}
          {activeTab === 'master-admins' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search master admins..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Assign Master Admin
                </button>
              </div>

              {filteredMasterAdmins.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No master admins found' : 'No master admins assigned yet'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredMasterAdmins.map((admin) => (
                    <motion.div
                      key={admin.mem_id}
                      className="p-4 border border-border rounded-lg bg-card/50 hover:bg-card transition-colors"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{admin.fullname}</h3>
                            <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">
                              Master Admin
                            </span>
                            <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                              {admin.public_role}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">@{admin.username}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Assigned: {new Date(admin.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRevokeMasterAdmin(admin.mem_id, admin.fullname)}
                          className="px-3 py-2 text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* MEMBERS TAB */}
          {activeTab === 'members' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search members by name, email or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Filter by Role</label>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">All Roles</option>
                      {uniqueRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Filter by Batch</label>
                    <select
                      value={filterBatch}
                      onChange={(e) => setFilterBatch(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">All Batches</option>
                      {uniqueBatches.map((batch) => (
                        <option key={batch} value={batch}>
                          Batch {batch}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No members found</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredMembers.map((member) => (
                    <motion.div
                      key={member.mem_id}
                      className="p-4 border border-border rounded-lg bg-card/50 hover:bg-card transition-colors"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{member.fullname}</h3>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                member.role === 'super_admin'
                                  ? 'bg-red-500/20 text-red-400'
                                  : member.role === 'admin'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {member.role}
                            </span>
                            {member.is_master_admin && (
                              <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                                Master Admin
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">@{member.username}</p>
                          <p className="text-sm text-muted-foreground">{member.email || 'No email'}</p>
                          {member.designation && (
                            <p className="text-sm text-muted-foreground">{member.designation}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Joined: {new Date(member.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleViewMemberDetails(member)}
                          className="px-3 py-2 text-xs bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ACCESS PERMISSIONS TAB */}
          {activeTab === 'permissions' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {permissions.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No permissions granted yet</p>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search by admin name, email or permission..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {permissions
                      .sort((a, b) => {
                        // Sort by created_at, newest first
                        const dateA = new Date(a.created_at || 0).getTime();
                        const dateB = new Date(b.created_at || 0).getTime();
                        return dateB - dateA;
                      })
                      .filter((perm) => {
                        const query = searchQuery.toLowerCase();
                        return (
                          perm.member_name?.toLowerCase().includes(query) ||
                          perm.member_email?.toLowerCase().includes(query) ||
                          (perm.permission_type as string).toLowerCase().includes(query)
                        );
                      })
                      .length === 0 ? (
                        <div className="col-span-1 text-center py-8">
                          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">No matching permissions found</p>
                        </div>
                      ) : (
                        // Render filtered and sorted permissions
                        permissions
                        .sort((a, b) => {
                          const dateA = new Date(a.created_at || 0).getTime();
                          const dateB = new Date(b.created_at || 0).getTime();
                          return dateB - dateA;
                        })
                        .filter((perm) => {
                          const query = searchQuery.toLowerCase();
                          return (
                            perm.member_name?.toLowerCase().includes(query) ||
                            perm.member_email?.toLowerCase().includes(query) ||
                            (perm.permission_type as string).toLowerCase().includes(query)
                          );
                        })
                        .map((perm) => (
                      <motion.div
                        key={perm.id}
                        className="p-4 border border-border rounded-lg bg-card/50 hover:bg-card transition-colors"
                        whileHover={{ scale: 1.01 }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="mb-3">
                              <p className="text-sm font-semibold">{perm.member_name}</p>
                              {perm.member_email && (
                                <p className="text-xs text-muted-foreground">{perm.member_email}</p>
                              )}
                            </div>
                            <div className="mb-3">
                              <label className="text-xs font-medium text-muted-foreground block mb-1">
                                Permissions ({(perm.permission_type as string).split(', ').length})
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {(perm.permission_type as string).split(', ').map((permission, idx) => (
                                  <span
                                    key={idx}
                                    className="px-3 py-1 text-sm bg-green-500/20 text-green-400 rounded-full font-medium capitalize"
                                  >
                                    {permission}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="mb-3">
                              <label className="text-xs font-medium text-muted-foreground block mb-1">
                                Granted By
                              </label>
                              <p className="text-sm text-muted-foreground">{perm.granted_by_name}</p>
                            </div>
                            {perm.created_at && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">
                                  Granted At
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(perm.created_at).toLocaleDateString()} {new Date(perm.created_at).toLocaleTimeString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                      )}
                    </div>
                </div>
              )}
            </motion.div>
          )}

          {/* FINANCE LEDGER TAB */}
          {activeTab === 'finance' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {financeLoading ? (
                <div className="flex items-center justify-center min-h-[50vh]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className="bg-green-500/10 border-green-500/20">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Income</p>
                              <p className="text-2xl font-bold text-green-400">
                                Rs. {financeStats.income.toLocaleString()}
                              </p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-green-400" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Card className="bg-red-500/10 border-red-500/20">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Expense</p>
                              <p className="text-2xl font-bold text-red-400">
                                Rs. {financeStats.expense.toLocaleString()}
                              </p>
                            </div>
                            <TrendingDown className="h-8 w-8 text-red-400" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Card className="bg-primary/10 border-primary/20">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Net Balance</p>
                              <p
                                className={cn(
                                  'text-2xl font-bold',
                                  financeStats.balance >= 0 ? 'text-primary' : 'text-red-400'
                                )}
                              >
                                Rs. {financeStats.balance.toLocaleString()}
                              </p>
                            </div>
                            <DollarSign className="h-8 w-8 text-primary" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Filters */}
                  <Card className="bg-card/50 backdrop-blur-sm border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search transactions..."
                            value={financeSearchQuery}
                            onChange={(e) => setFinanceSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                          />
                        </div>
                        <select
                          value={financeFilterType}
                          onChange={(e) => setFinanceFilterType(e.target.value)}
                          className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                        >
                          <option value="all">All Types</option>
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Transactions Table */}
                  <Card className="bg-card/50 backdrop-blur-sm border-border">
                    <CardContent className="p-0">
                      {filteredFinanceTransactions.length === 0 ? (
                        <div className="text-center py-12">
                          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">No transactions found</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Event</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredFinanceTransactions.map((txn) => (
                              <TableRow key={txn.fin_id}>
                                <TableCell>
                                  {txn.txn_date
                                    ? new Date(txn.txn_date).toLocaleDateString()
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={cn(
                                      txn.exp_type === 'income'
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-red-500/20 text-red-400'
                                    )}
                                  >
                                    {txn.exp_type}
                                  </Badge>
                                </TableCell>
                                <TableCell>{txn.category}</TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {txn.description || '-'}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    'text-right font-medium',
                                    txn.exp_type === 'income'
                                      ? 'text-green-400'
                                      : 'text-red-400'
                                  )}
                                >
                                  {txn.exp_type === 'income' ? '+' : '-'} Rs.{' '}
                                  {txn.amount.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {/* AUDIT LOGS TAB */}
          {activeTab === 'audit' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {auditLoading ? (
                <div className="flex items-center justify-center min-h-[50vh]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No audit logs found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(new Set(auditLogs.map((log) => log.year)))
                    .sort((a, b) => b - a)
                    .map((year) => {
                      const logsForYear = auditLogs.filter((log) => log.year === year);
                      const isOpen = expandedAuditYear === year;

                      return (
                        <Card key={year} className="bg-card/50 backdrop-blur-sm border-border">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">Year {year}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {logsForYear.length} event{logsForYear.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              <button
                                onClick={() => setExpandedAuditYear(isOpen ? null : year)}
                                className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-card transition-colors"
                              >
                                {isOpen ? 'Hide' : 'View'}
                              </button>
                            </div>
                          </CardHeader>

                          {isOpen && (
                            <CardContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Event Name</TableHead>
                                    <TableHead>File</TableHead>
                                    <TableHead>Date Uploaded</TableHead>
                                  </TableRow>
                                </TableHeader>

                                <TableBody>
                                  {logsForYear.map((record) => (
                                    <TableRow key={record.id}>
                                      <TableCell>{record.event}</TableCell>
                                      <TableCell>
                                        {record.object_path ? (
                                          <button
                                            onClick={() => handleOpenAuditFile(record)}
                                            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm"
                                          >
                                            <FileText className="h-4 w-4" />
                                            {record.file_name || 'View File'}
                                          </button>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">No file</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {new Date(record.created_at).toLocaleDateString()}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            className="bg-card border border-border rounded-lg p-6 w-full max-w-md"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-lg font-semibold mb-4">Assign Master Admin</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Admin</label>
                <select
                  value={selectedMember?.mem_id || ''}
                  onChange={(e) => {
                    const member = assignableAdmins.find((a) => a.mem_id === parseInt(e.target.value));
                    setSelectedMember(member || null);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Choose an admin...</option>
                  {assignableAdmins.map((admin) => (
                    <option key={admin.mem_id} value={admin.mem_id}>
                      {admin.fullname} ({admin.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason (Optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this admin being assigned master admin role?"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                />
              </div>

              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700">
                    Master admin role is hidden and the user will display their public role (admin/super admin/member/honourable).
                    Master admins can view all admins and member details.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedMember(null);
                    setReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-card transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignMasterAdmin}
                  disabled={!selectedMember || isAssigning}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Assign Master Admin
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Member Details Modal */}
      {showDetailsModal && selectedMemberDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Member Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedMemberDetails(null);
                }}
                className="p-1 hover:bg-card rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Picture Section */}
            <div className="mb-6 flex justify-center">
              {memberPhotoUrls.get(selectedMemberDetails.mem_id) ? (
                <div className="relative">
                  <img
                    src={memberPhotoUrls.get(selectedMemberDetails.mem_id)}
                    alt={selectedMemberDetails.fullname}
                    className="w-32 h-32 rounded-lg object-cover border-2 border-border"
                    onError={() => {
                      // Remove from map on error
                      const newMap = new Map(memberPhotoUrls);
                      newMap.delete(selectedMemberDetails.mem_id);
                      setMemberPhotoUrls(newMap);
                    }}
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                  <div className="text-center">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No profile picture</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
                <p className="text-sm font-medium">{selectedMemberDetails.fullname}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Username</label>
                <p className="text-sm font-medium">@{selectedMemberDetails.username}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                <p className="text-sm font-medium">{selectedMemberDetails.email || 'Not provided'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                <p className="text-sm font-medium">{selectedMemberDetails.phone || 'Not provided'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Role</label>
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium inline-block ${
                    selectedMemberDetails.role === 'super_admin'
                      ? 'bg-red-500/20 text-red-400'
                      : selectedMemberDetails.role === 'admin'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {selectedMemberDetails.role}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Designation</label>
                <p className="text-sm font-medium">{selectedMemberDetails.designation || 'Not provided'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">City</label>
                <p className="text-sm font-medium">{selectedMemberDetails.city || 'Not provided'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">State</label>
                <p className="text-sm font-medium">{selectedMemberDetails.state || 'Not provided'}</p>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-1">Address</label>
                <p className="text-sm font-medium">{selectedMemberDetails.address || 'Not provided'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Master Admin</label>
                <p className="text-sm font-medium flex items-center gap-2">
                  {selectedMemberDetails.is_master_admin ? (
                    <>
                      <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full">Yes</span>
                    </>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded-full">No</span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Member ID</label>
                <p className="text-sm font-medium text-muted-foreground">#{selectedMemberDetails.mem_id}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Joined</label>
                <p className="text-sm font-medium">
                  {new Date(selectedMemberDetails.created_at).toLocaleDateString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Last Updated</label>
                <p className="text-sm font-medium">
                  {new Date(selectedMemberDetails.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedMemberDetails(null);
                }}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-card transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Password Confirmation Dialog for Revoking Master Admin */}
      {showRevokePasswordDialog && revokeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            className="bg-card border border-red-500/30 rounded-lg p-6 w-full max-w-md"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h2 className="text-lg font-semibold">Revoke Master Admin</h2>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              You are about to remove master admin privileges from <strong>{revokeTarget.fullname}</strong>. 
              This is a critical action. Please enter the password to confirm.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium block mb-2">Password</label>
                <input
                  type="password"
                  value={revokePassword}
                  onChange={(e) => setRevokePassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && revokePassword.length > 0) {
                      confirmRevokeWithPassword();
                    }
                  }}
                  placeholder="Enter password"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRevokePasswordDialog(false);
                  setRevokeTarget(null);
                  setRevokePassword('');
                }}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
                disabled={isRevoking}
              >
                Cancel
              </button>
              <button
                onClick={confirmRevokeWithPassword}
                disabled={isRevoking || revokePassword.length === 0}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRevoking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  'Revoke Master Admin'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
