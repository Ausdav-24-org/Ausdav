// Shared type definitions for Admin components
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

export interface MemberDetails {
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

export interface AdminPermission {
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

export interface FinanceTransaction {
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

export interface AuditAction {
  id: number;
  year: number;
  event: string;
  bucket_id: string;
  object_path: string;
  file_name: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  batch_name?: string;
}
