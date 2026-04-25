import React, { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

interface AppSettings {
  id?: number;
  master_admin_emergency_lock?: boolean | null;
  emergency_lock_reason?: string | null;
  emergency_lock_enabled_at?: string | null;
  emergency_lock_enabled_by?: string | null;
}

export default function AdminEmergencyLockPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;
        setSettings(data ?? { id: 1 });
        setReason(data?.emergency_lock_reason ?? '');
      } catch (err) {
        console.error('Failed to load settings', err);
        toast.error('Unable to load settings');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleToggleLock = async (enabled: boolean) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const payload = {
        id: 1,
        master_admin_emergency_lock: enabled,
        emergency_lock_reason: reason || null,
        emergency_lock_enabled_at: enabled ? new Date().toISOString() : null,
        emergency_lock_enabled_by: enabled ? userData?.user?.id : null,
      };

      const { data, error } = await supabase
        .from('app_settings')
        .upsert(payload)
        .select();

      if (error) throw error;

      setSettings(data?.[0]);
      
      if (enabled) {
        toast.success('🔒 Emergency Lock ENABLED - All admins are now blocked', {
          duration: 5000,
        });
      } else {
        toast.success('🔓 Emergency Lock DISABLED - Admins can now access pages', {
          duration: 5000,
        });
      }
    } catch (err) {
      console.error('Failed to update lock', err);
      toast.error('Failed to update emergency lock');
    } finally {
      setSaving(false);
    }
  };

  const isLocked = settings?.master_admin_emergency_lock === true;

  return (
    <div>
      <AdminHeader title="Emergency Admin Lock" />
      <div className="space-y-4">
        {/* Status Card */}
        <Card className={isLocked ? 'border-red-500/50 bg-red-500/5' : 'border-green-500/50 bg-green-500/5'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {isLocked ? (
                  <>
                    <Lock className="w-5 h-5 text-red-500" />
                    <span className="text-red-500">🔒 LOCKED</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5 text-green-500" />
                    <span className="text-green-500">🔓 UNLOCKED</span>
                  </>
                )}
              </CardTitle>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${isLocked ? 'bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-green-500/20 text-green-700 dark:text-green-400'}`}>
                {isLocked ? 'Active' : 'Inactive'}
              </span>
            </div>
          </CardHeader>
        </Card>

        {/* Lock Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Emergency Lock Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 font-semibold mb-2">⚠️ Warning</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                When enabled, all regular admins and super admins will be <strong>LOCKED OUT</strong> from their sidebar pages.
                Only Master Admin can access pages. Use this in emergency situations only.
              </p>
            </div>

            {/* Lock Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-base font-semibold">
                Lock Reason (Optional)
              </Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for locking out admins (e.g., Emergency maintenance, Security issue, etc.)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={saving}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                This reason will be logged and visible when checking lock status
              </p>
            </div>

            {/* Lock Toggle */}
            <div className="flex items-start justify-between gap-4 p-4 border border-border/50 rounded-lg">
              <div className="flex-1">
                <Label className="text-base font-semibold">
                  {isLocked ? 'Disable Emergency Lock' : 'Enable Emergency Lock'}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {isLocked
                    ? 'Click to unlock all admins and allow normal operations'
                    : 'Click to lock all admins from accessing sidebar pages'}
                </p>
              </div>
              <Switch
                checked={isLocked}
                onCheckedChange={(checked) => handleToggleLock(checked)}
                disabled={saving}
                className="mt-1"
              />
            </div>

            {/* Lock Info */}
            {isLocked && settings?.emergency_lock_enabled_at && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-semibold">Lock Information</p>
                <p className="text-muted-foreground">
                  <strong>Enabled at:</strong> {new Date(settings.emergency_lock_enabled_at).toLocaleString()}
                </p>
                {settings.emergency_lock_reason && (
                  <p className="text-muted-foreground">
                    <strong>Reason:</strong> {settings.emergency_lock_reason}
                  </p>
                )}
              </div>
            )}

            {/* Status Messages */}
            {isLocked && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Current Status:</p>
                <ul className="text-sm text-red-600 dark:text-red-300 space-y-1 list-disc list-inside">
                  <li>Regular Admins: ❌ BLOCKED from sidebar pages</li>
                  <li>Super Admins: ❌ BLOCKED from sidebar pages</li>
                  <li>Master Admin: ✅ FULL ACCESS</li>
                </ul>
              </div>
            )}

            {!isLocked && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">Current Status:</p>
                <ul className="text-sm text-green-600 dark:text-green-300 space-y-1 list-disc list-inside">
                  <li>Regular Admins: ✅ Can access sidebar pages</li>
                  <li>Super Admins: ✅ Can access sidebar pages</li>
                  <li>Master Admin: ✅ Full access</li>
                </ul>
              </div>
            )}

            {/* Save Button */}
            {reason !== (settings?.emergency_lock_reason ?? '') && (
              <Button
                onClick={() => handleToggleLock(isLocked)}
                disabled={saving}
                className="w-full"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>ℹ️ How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>When Lock is Enabled:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>All regular admins see "Access Denied" on admin sidebar pages</li>
              <li>All super admins (except Master Admin) are blocked</li>
              <li>Only Master Admin can access admin pages normally</li>
              <li>Emergency reason is logged for audit purposes</li>
            </ul>

            <p className="mt-4">
              <strong>Use Cases:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Emergency maintenance requiring admin isolation</li>
              <li>Security incident response</li>
              <li>Investigating suspicious admin activity</li>
              <li>System-wide lockdown while troubleshooting</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
