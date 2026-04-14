import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Callback error', error);
        navigate('/login?error=auth_failed');
        return;
      }

      if (session?.user?.id) {
        // ensure the Google account matches the email the user entered earlier
        const pending = localStorage.getItem('pendingGoogleEmail');
        if (pending && session.user.email && pending !== session.user.email.toLowerCase()) {
          await supabase.auth.signOut();
          localStorage.removeItem('pendingGoogleEmail');
          navigate('/login?error=email_mismatch');
          return;
        }
        // clean up pending value regardless
        localStorage.removeItem('pendingGoogleEmail');

        // membership is keyed by auth_user_id, so just look up the record directly
        const userId = session.user.id;
        const { data: member, error: mErr } = await supabase
          .from('members' as any)
          .select('role')
          .eq('auth_user_id', userId)
          .single();
        if (mErr || !member) {
          await supabase.auth.signOut();
          navigate('/login?error=not_member');
          return;
        }

        let role: string | undefined = (member as any)?.role;
        if (!role) {
          // fallback metadata for admin accounts
          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (!userErr && userData?.user) {
            const meta = userData.user.user_metadata as Record<string, any> | undefined;
            if (meta?.is_super_admin === true) role = 'super_admin';
            else if (Array.isArray(meta?.roles) && meta.roles.includes('super_admin')) role = 'super_admin';
            else if (Array.isArray(meta?.roles) && meta.roles.includes('admin')) role = 'admin';
          }
        }

        switch (role) {
          case 'super_admin':
          case 'admin':
            navigate('/admin/dashboard');
            break;
          case 'member':
          case 'honourable':
            navigate('/admin/profile');
            break;
          default:
            navigate('/admin/profile');
        }
      } else {
        navigate('/login');
      }
    };

    handle();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
};
