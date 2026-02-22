import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Plus,
  Calendar,
  FileText,
  Megaphone,
  Settings,
  ShieldCheck,
  Key,
} from 'lucide-react';
import { useAdminGrantedPermissions } from '@/hooks/useAdminGrantedPermissions';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import invokeFunction from '@/integrations/supabase/functions';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
// Use a loose-typed client for queries against tables not present in generated types
const db = supabase as any;
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  monthlyIncome: number;
  monthlyExpense: number;
  pendingSubmissions: number;
  membersByBatch: { batch: string; count: number }[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    pendingSubmissions: 0,
    membersByBatch: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const batches = await fetchDashboardStats();
      if (batches.length === 0) {
        // fallback to direct query only when dashboard function returned nothing
        await fetchMembersByBatch();
      }
    })();
  }, []);

  const { session } = useAdminAuth();

  const fetchDashboardStats = async (): Promise<{ batch: string; count: number }[]> => {
    try {
      setLoading(true);
      const { data, error } = await invokeFunction('fetch-dashboard-stats', {});
      if (error) throw error;

      // debug: log payload to see if batches are included
      console.debug('dashboard stats payload', data);

      const batches = Array.isArray(data?.membersByBatch) ? data.membersByBatch : [];

      setStats((prev) => ({
        ...prev,
        totalMembers: data?.totalMembers || 0,
        activeMembers: data?.activeMembers || 0,
        monthlyIncome: data?.monthlyIncome || 0,
        monthlyExpense: data?.monthlyExpense || 0,
        pendingSubmissions: data?.pendingSubmissions || 0,
        membersByBatch: batches.length ? batches : prev.membersByBatch,
      }));

      return batches;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Members',
      value: stats.totalMembers,
      subtitle: `${stats.activeMembers} active`,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Monthly Income',
      value: `Rs. ${stats.monthlyIncome.toLocaleString()}`,
      subtitle: 'This month',
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Monthly Expense',
      value: `Rs. ${stats.monthlyExpense.toLocaleString()}`,
      subtitle: 'This month',
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Pending Verification',
      value: stats.pendingSubmissions,
      subtitle: 'Finance submissions',
      icon: Receipt,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  const { hasPermission, loading: permissionsLoading } = useAdminGrantedPermissions();

  const batchChartConfig: ChartConfig = {
    count: { label: 'Students', color: '#60A5FA' },
  };

  // explicit query for members by batch to back up the dashboard function
  const fetchMembersByBatch = async () => {
    try {
      const { data, error } = await db.from('members').select('batch');
      console.debug('direct batch query result', { data, error });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const counts: Record<string, number> = {};
      rows.forEach((r: any) => {
        const b = r.batch ?? 'Unknown';
        counts[b] = (counts[b] || 0) + 1;
      });
      const arr = Object.entries(counts)
        .map(([batch, count]) => ({ batch, count }))
        .sort((a, b) => b.count - a.count);
      console.debug('computed batch counts', arr);
      setStats((prev) => ({ ...prev, membersByBatch: arr }));
    } catch (e) {
      console.error('Error fetching members by batch:', e);
    }
  };
  const { isAdmin, isSuperAdmin } = useAdminAuth();

  const actions = [
    { title: 'Create Announcement', icon: Megaphone, href: '/admin/announcements', permission: 'announcement' },
    { title: 'Add Event', icon: Calendar, href: '/admin/events', permission: 'events' },
    { title: 'Upload Past Paper', icon: FileText, href: '/admin/exams', permission: 'exam' },
    { title: 'Verify Submissions', icon: Receipt, href: '/admin/finance/verify', permission: 'finance' },

    // Privileged / management actions
    { title: 'Manage Members', icon: Users, href: '/admin/members', permission: 'member' },
    { title: 'Manage Patrons', icon: Users, href: '/admin/patrons', permission: 'patrons' },
    { title: 'Manage Permissions', icon: Key, href: '/admin/permissions', permission: 'permissions' },
    { title: 'Feedback', icon: Megaphone, href: '/admin/feedback', permission: 'feedback' },
    { title: 'Audit Log', icon: ShieldCheck, href: '/admin/audit', permission: 'audit' },
    { title: 'Settings', icon: Settings, href: '/admin/settings', permission: 'settings' },
  ];

  // While permissions are loading, show the existing actions (fallback). Once loaded,
  // only show actions for which the admin has the required permission.
  const visibleActions = permissionsLoading
    ? actions
    : actions.filter((a) => {
        // Feedback portal should be visible to Admins and Super Admins.
        if (a.permission === 'feedback') return isAdmin || isSuperAdmin || hasPermission(a.permission);
        return hasPermission(a.permission);
      });

  return (
    <div className="min-h-screen">
      <AdminHeader title="Dashboard" breadcrumb="Admin" />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-card/50 backdrop-blur-sm border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                    </div>
                    <div className={`${stat.bgColor} p-3 rounded-xl`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Members by Batch */}
          <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle className="text-lg">Members by Batch</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.membersByBatch.length > 0 ? (
                <ChartContainer config={batchChartConfig} className="w-full h-[320px]">
                  <BarChart data={stats.membersByBatch} margin={{ top: 20, right: 20, left: 0, bottom: 20 }} className="w-full">
                    <XAxis dataKey="batch" tick={{ fill: 'hsl(var(--foreground))' }} />
                    <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No members yet</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {visibleActions.map((action) => (
                  <Button
                    key={action.title}
                    variant="outline"
                    className="w-full justify-start gap-3"
                    onClick={() => navigate(action.href)}
                  >
                    <action.icon className="h-4 w-4" />
                    {action.title}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Finance Overview */}
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Finance Overview - This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-500/10 rounded-xl">
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-green-400">
                  Rs. {stats.monthlyIncome.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-xl">
                <p className="text-sm text-muted-foreground">Total Expense</p>
                <p className="text-2xl font-bold text-red-400">
                  Rs. {stats.monthlyExpense.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-xl">
                <p className="text-sm text-muted-foreground">Net Balance</p>
                <p className="text-2xl font-bold text-primary">
                  Rs. {(stats.monthlyIncome - stats.monthlyExpense).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
