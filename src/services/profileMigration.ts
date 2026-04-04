import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/integrations/supabase/functions';

export interface MigrationResult {
  success: boolean;
  total: number;
  migrated: number;
  failed: number;
  errors: Array<{ mem_id: number; error: string }>;
  message?: string;
}

export interface MemberProfile {
  mem_id: number;
  username: string;
  batch: number;
  profile_path: string | null;
  profile_bucket?: string;
  format_status: 'old' | 'new' | 'none';
}

/**
 * Check if profile path is in new format (batch/username_member_id.jpg)
 * Old format: batch/mem_id/username_member_id.jpg (3+ parts)
 * New format: batch/username_member_id.jpg (2 parts)
 */
function isNewFormat(profilePath: string | null, batch: number): boolean {
  if (!profilePath) return false;
  const parts = profilePath.split('/');
  // New format has exactly 2 parts: batch and filename (no intermediate mem_id folder)
  return parts.length === 2 && parts[0] === String(batch);
}

/**
 * Get all members with their profile information
 */
export async function getAllMembersWithProfiles(): Promise<MemberProfile[]> {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('mem_id, username, batch, profile_path, profile_bucket')
      .not('profile_path', 'is', null)
      .order('batch', { ascending: false })
      .order('mem_id', { ascending: true });

    if (error) throw error;

    return (data || []).map(m => ({
      mem_id: m.mem_id,
      username: m.username,
      batch: m.batch,
      profile_path: m.profile_path,
      profile_bucket: m.profile_bucket,
      format_status: isNewFormat(m.profile_path, m.batch) ? 'new' : 'old',
    }));
  } catch (err: any) {
    console.error('Failed to get members:', err);
    throw err;
  }
}

/**
 * Migrate a single member's profile picture
 */
export async function migrateSingleMemberProfile(memId: number): Promise<MigrationResult> {
  try {
    const { data, error } = await invokeFunction('migrate-member-profiles', {
      mem_id: memId,
    });

    if (error) {
      throw new Error(`Migration error: ${error}`);
    }

    return data as MigrationResult;
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown error during migration';
    console.error(`Migration failed for member ${memId}:`, errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Migrate all existing member profile pictures to new folder structure
 * Old: member-profiles/user_id/avatar-timestamp.jpg
 * New: member-profiles/batch/member_id/username_member_id.jpg
 */
export async function migrateMemberProfiles(): Promise<MigrationResult> {
  try {
    const { data, error } = await invokeFunction('migrate-member-profiles', {});

    if (error) {
      throw new Error(`Migration error: ${error}`);
    }

    return data as MigrationResult;
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown error during migration';
    console.error('Migration failed:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get migration status summary
 */
export async function getMemberProfileStats() {
  try {
    // Count members with profile pictures
    const { data, error } = await supabase
      .from('members')
      .select('mem_id, profile_path, batch')
      .not('profile_path', 'is', null);

    if (error) throw error;

    const total = data?.length || 0;
    const oldFormat = data?.filter(m => !isNewFormat(m.profile_path, m.batch)).length || 0;
    const newFormat = total - oldFormat;

    return {
      total,
      newFormat,
      oldFormat,
    };
  } catch (err: any) {
    console.error('Failed to get stats:', err);
    throw err;
  }
}
