import React, { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AppSettings = {
  id: number;
  site_under_construction?: boolean | null;
  restrict_public_access?: boolean | null;
  allow_signup_when_construction?: boolean | null;
  show_maintenance_countdown?: boolean | null;
  allow_admin_login?: boolean | null;
  show_under_construction_banner?: boolean | null;
  updated_at?: string | null;
};

export default function AdminSiteModePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings' as any)
          .select('*')
          .eq('id', 1)
          .maybeSingle<AppSettings>();

        if (error) throw error;
        if (!active) return;
        setSettings(data ?? { id: 1 });
      } catch (err) {
        console.error('Failed to load app settings', err);
        toast.error('Unable to load settings');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateSetting = (key: keyof AppSettings, value: boolean) => {
    setSettings((s) => (s ? { ...s, [key]: value } : { id: 1, [key]: value } as any));
  };

  const handleSettingChange = async (key: keyof AppSettings, value: boolean) => {
    // Update local state immediately
    updateSetting(key, value);
    
    // Auto-save to database
    setSaving(true);
    try {
      const newSettings = { ...settings, [key]: value };
      const payload = {
        id: 1,
        site_under_construction: !!newSettings.site_under_construction,
        restrict_public_access: !!newSettings.restrict_public_access,
        allow_signup_when_construction: !!newSettings.allow_signup_when_construction,
        show_maintenance_countdown: !!newSettings.show_maintenance_countdown,
        allow_admin_login: !!newSettings.allow_admin_login,
        show_under_construction_banner: !!newSettings.show_under_construction_banner,
      };

      // Use the correct Supabase upsert syntax
      const { data, error } = await supabase
        .from('app_settings')
        .upsert(payload)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      toast.success(`${key.replace(/_/g, ' ')} updated`);
      if (data?.[0]) {
        setSettings(data[0]);
      }
    } catch (err) {
      console.error('Failed to save setting', err);
      toast.error('Failed to save setting');
      // Revert the change if save failed
      setSettings((s) => (s ? { ...s, [key]: !value } : s));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminHeader title="Site Mode" />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Under Construction Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/50">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">Enable Under Construction Mode</Label>
                    <div className="text-sm text-muted-foreground mt-1">When enabled, public pages will show the under construction page.</div>
                  </div>
                  <Switch
                    checked={Boolean(settings?.site_under_construction)}
                    onCheckedChange={(v) => handleSettingChange('site_under_construction', Boolean(v))}
                    disabled={saving}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/50">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">Allow Signups</Label>
                    <div className="text-sm text-muted-foreground mt-1">Allow new users to sign up while in construction mode.</div>
                  </div>
                  <Switch
                    checked={Boolean(settings?.allow_signup_when_construction)}
                    onCheckedChange={(v) => handleSettingChange('allow_signup_when_construction', Boolean(v))}
                    disabled={saving}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">Allow Admin Login</Label>
                    <div className="text-sm text-muted-foreground mt-1">Allow admin users to sign in while site is under construction.</div>
                  </div>
                  <Switch
                    checked={Boolean(settings?.allow_admin_login)}
                    onCheckedChange={(v) => handleSettingChange('allow_admin_login', Boolean(v))}
                    disabled={saving}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/50">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">Restrict Public Access</Label>
                    <div className="text-sm text-muted-foreground mt-1">Block non-admin users from accessing most pages.</div>
                  </div>
                  <Switch
                    checked={Boolean(settings?.restrict_public_access)}
                    onCheckedChange={(v) => handleSettingChange('restrict_public_access', Boolean(v))}
                    disabled={saving}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/50">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">Show Maintenance Countdown</Label>
                    <div className="text-sm text-muted-foreground mt-1">Display a countdown timer on the under construction page.</div>
                  </div>
                  <Switch
                    checked={Boolean(settings?.show_maintenance_countdown)}
                    onCheckedChange={(v) => handleSettingChange('show_maintenance_countdown', Boolean(v))}
                    disabled={saving}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">Show Banner</Label>
                    <div className="text-sm text-muted-foreground mt-1">Show a small banner on top of pages indicating maintenance mode.</div>
                  </div>
                  <Switch
                    checked={Boolean(settings?.show_under_construction_banner)}
                    onCheckedChange={(v) => handleSettingChange('show_under_construction_banner', Boolean(v))}
                    disabled={saving}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3 pt-6 border-t border-border/50">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh
              </Button>
              {saving && (
                <span className="text-sm text-muted-foreground animate-pulse">Saving...</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
