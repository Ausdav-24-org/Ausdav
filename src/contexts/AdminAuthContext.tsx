import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'member' | 'honourable' | 'admin' | 'super_admin';

// Mirrors the new "members" table schema used by the SQL migrations.
interface MemberProfile {
  mem_id: number;
  fullname: string;
  username: string;
  nic: string;
  gender: boolean;
  role: AppRole;
  batch: number;
  university: string;
  uni_degree?: string | null;
  school: string;
  phone: string;
  designation: string;
  auth_user_id: string | null;
  profile_bucket: string;
  profile_path: string | null;
  is_master_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminAuthContextType {
  user: User | null;
  session: Session | null;
  profile: MemberProfile | null;
  role: AppRole | null;
  loading: boolean;
  needsProfileSetup: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isMasterAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const { data: memberData, error } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (memberData) {
        setProfile(memberData as MemberProfile);
        setRole(memberData.role as AppRole);
        setNeedsProfileSetup(false);
      } else {
        // No members row found, check user metadata for role fallback
        const { data: userData, error: userErr } = await supabase.auth.getUser(userId);
        if (!userErr && userData?.user) {
          const meta = userData.user.user_metadata;
          let fallbackRole: AppRole | null = null;
          if (meta?.is_super_admin === true) fallbackRole = 'super_admin';
          else if (Array.isArray(meta?.roles) && meta.roles.includes('super_admin')) fallbackRole = 'super_admin';
          else if (Array.isArray(meta?.roles) && meta.roles.includes('admin')) fallbackRole = 'admin';
          
          if (fallbackRole) {
            setProfile(null);
            setRole(fallbackRole);
            setNeedsProfileSetup(false);
            return;
          }
        }
        // No role found anywhere
        setProfile(null);
        setRole(null);
        setNeedsProfileSetup(true);
      }
    } catch (error) {
      console.error('Error fetching member data:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user!.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setNeedsProfileSetup(false);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const isMasterAdmin = profile?.is_master_admin === true;

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        needsProfileSetup,
        isAdmin,
        isSuperAdmin,
        isMasterAdmin,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
