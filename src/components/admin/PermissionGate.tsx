import React, { useEffect, useState } from 'react';
import { ShieldX, Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminGrantedPermissions } from '@/hooks/useAdminGrantedPermissions';
import { AdminHeader } from './AdminHeader';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface PermissionGateProps {
  permissionKey: string;
  permissionName: string;
  children: React.ReactNode;
}

export function PermissionGate({ permissionKey, permissionName, children }: PermissionGateProps) {
  const { user, isSuperAdmin, isMasterAdmin, role } = useAdminAuth();
  const { hasPermission, loading } = useAdminGrantedPermissions();
  const navigate = useNavigate();
  const [masterAdminSuperView, setMasterAdminSuperView] = useState(false);

  const masterAdminSuperViewKey = user?.id
    ? `ausdav-master-admin-super-view-${user.id}`
    : null;

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

  const effectiveSuperAdmin = isSuperAdmin || (isMasterAdmin && masterAdminSuperView);

  // Super admins always have access
  if (effectiveSuperAdmin) {
    return <>{children}</>;
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if admin has the permission
  if (role === 'admin' && !hasPermission(permissionKey)) {
    return (
      <div className="p-6">
        <AdminHeader title="Access Denied" breadcrumb="Admin / Access Denied" />
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <ShieldX className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Permission Required</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            You don't have permission to access {permissionName}. 
            Please request access from a Super Admin.
          </p>
          <Button onClick={() => navigate('/admin/claim-permission')}>
            Request Permission
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
