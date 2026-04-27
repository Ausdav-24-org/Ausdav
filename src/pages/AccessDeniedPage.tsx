import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Home, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const [lockReason, setLockReason] = useState('');
  const [lockedAt, setLockedAt] = useState('');

  useEffect(() => {
    const fetchLockInfo = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('emergency_lock_reason, emergency_lock_enabled_at')
          .eq('id', 1)
          .eq('master_admin_emergency_lock', true)
          .maybeSingle();

        if (data) {
          setLockReason(data.emergency_lock_reason || 'Emergency maintenance in progress');
          if (data.emergency_lock_enabled_at) {
            setLockedAt(new Date(data.emergency_lock_enabled_at).toLocaleString());
          }
        }
      } catch (err) {
        console.error('Failed to fetch lock info:', err);
      }
    };

    fetchLockInfo();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    } catch (err) {
      console.error('Logout failed:', err);
      toast.error('Failed to logout');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="max-w-md w-full border-red-500/50 bg-red-500/5">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <CardTitle className="text-center text-2xl text-red-600 dark:text-red-400">
            🔒 Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Message */}
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Admin access is currently restricted
            </p>
            <p className="text-sm text-muted-foreground">
              {lockReason}
            </p>
          </div>

          {/* Lock Info */}
          {lockedAt && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Lock Information</p>
              <p className="text-xs text-red-600 dark:text-red-300">
                <strong>Enabled:</strong> {lockedAt}
              </p>
            </div>
          )}

          {/* Info Message */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              ⚠️ This emergency lockdown was activated by the Master Admin. 
              <br />
              <br />
              <strong>Regular Admins and Super Admins cannot access any admin pages until the lock is disabled.</strong>
              <br />
              <br />
              Only the Master Admin can lift this restriction.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => navigate('/', { replace: true })}
              className="w-full"
              variant="outline"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <Button
              onClick={handleLogout}
              className="w-full"
              variant="destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Footer */}
          <p className="text-xs text-center text-muted-foreground">
            If you believe this is an error, please contact the Master Admin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
