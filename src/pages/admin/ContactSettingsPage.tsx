import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

export default function ContactSettingsPage() {
  const { isAdmin, isSuperAdmin, isMasterAdmin, user } = useAdminAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branch, setBranch] = useState('');

  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [masterAdminSuperView, setMasterAdminSuperView] = useState(false);
  const queryClient = useQueryClient();

  const masterAdminSuperViewKey = user?.id
    ? `ausdav-master-admin-super-view-${user.id}`
    : null;
  const effectiveSuperAdmin = isSuperAdmin || (isMasterAdmin && masterAdminSuperView);
  const effectiveAdmin = isAdmin || effectiveSuperAdmin;

  useEffect(() => {
    if (!effectiveAdmin) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res: any = await (supabase as any)
          .from('org_contact_settings')
          .select('phone,email,address,bank_name,account_name,account_number,branch,updated_at,updated_by,is_enabled')
          .eq('id', 1)
          .maybeSingle();

        const data = res?.data;
        const err = res?.error;
        if (err) {
          setError('Failed to load contact settings.');
        } else if (data) {
          setPhone(data.phone ?? '');
          setEmail(data.email ?? '');
          setAddress(data.address ?? '');
          setBankName(data.bank_name ?? '');
          setAccountName(data.account_name ?? '');
          setAccountNumber(data.account_number ?? '');
          setBranch(data.branch ?? '');
          setUpdatedAt(data.updated_at ?? null);
          setUpdatedBy(data.updated_by ?? null);
        }
      } catch (e) {
        setError('Failed to load contact settings.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [effectiveAdmin]);

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

  const save = async () => {
    if (!effectiveSuperAdmin || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: 1,
        phone: phone || null,
        email: email || null,
        address: address || null,
        bank_name: bankName || null,
        account_name: accountName || null,
        account_number: accountNumber || null,
        branch: branch || null,
        updated_by: user?.id ?? null,
      };

      const res: any = await (supabase as any)
        .from('org_contact_settings')
        .upsert(payload, { returning: 'representation', onConflict: 'id' })
        .select()
        .maybeSingle();

      const data = res?.data;
      const err = res?.error;
      if (err) {
        setError(err.message || 'Save failed');
      } else if (data) {
        setUpdatedAt(data.updated_at ?? null);
        setUpdatedBy(data.updated_by ?? null);
        // Refresh cached org contact so footer/donate update immediately
        try {
          queryClient.invalidateQueries({ queryKey: ['org_contact'] });
        } catch (e) {
          // ignore
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!effectiveAdmin) {
    return (
      <div className="min-h-screen">
        <AdminHeader title="Contact Settings" breadcrumb="System" />
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="max-w-md w-full bg-card/50 backdrop-blur-sm border-border p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">This area is for admins only.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AdminHeader title="Contact Settings" breadcrumb="System" />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-card/60 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Organisation Contact & Finance</CardTitle>
              <CardDescription>
                Contact phone, email, address and bank details shown on the public site. Super administrators may edit; other admins can view only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!effectiveSuperAdmin} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!effectiveSuperAdmin} />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} disabled={!effectiveSuperAdmin} />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={!effectiveSuperAdmin} />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} disabled={!effectiveSuperAdmin} />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} disabled={!effectiveSuperAdmin} />
                </div>
                <div>
                  <Label>Branch</Label>
                  <Input value={branch} onChange={(e) => setBranch(e.target.value)} disabled={!effectiveSuperAdmin} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}${updatedBy ? ` by ${updatedBy}` : ''}` : ''}
                  {error && <div className="text-destructive">{error}</div>}
                </div>

                <div className="flex items-center gap-2">
                  {!effectiveSuperAdmin && <div className="text-sm text-muted-foreground">View only</div>}
                  {effectiveSuperAdmin && (
                    <Button onClick={save} disabled={saving || loading}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
