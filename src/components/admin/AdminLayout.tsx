import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { AdminSidebar } from './AdminSidebar';
import { Loader2 } from 'lucide-react';

export function AdminLayout() {
  const { user, profile, role, loading, needsProfileSetup } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login');
        return;
      }
      if (needsProfileSetup && !location.pathname.includes('/profile-setup')) {
        navigate('/admin/profile-setup');
        return;
      }
    }
  }, [user, loading, navigate, needsProfileSetup, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // User must be logged in to access admin panel
  if (!user) {
    return null;
  }

  // Allow these routes even without full profile setup
  const isSetupRoute = location.pathname.includes('/profile-setup');
  
  // Only block if user needs profile setup AND it's not a setup route
  if (!profile && needsProfileSetup && !isSetupRoute) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="pl-16 lg:pl-60 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
