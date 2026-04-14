import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminPermission } from '@/types/admin';

interface PermissionTrendProps {
  permissions: AdminPermission[];
}

export function PermissionTrendChart({ permissions }: PermissionTrendProps) {
  const permissionStats = useMemo(() => {
    // Count by permission type
    const typeCount: Record<string, number> = {};
    const adminCount: Record<string, number> = {};

    permissions.forEach((perm) => {
      const types = (perm.permission_type as string).split(', ');
      types.forEach((type) => {
        typeCount[type] = (typeCount[type] || 0) + 1;
      });

      const adminName = perm.member_name || 'Unknown';
      adminCount[adminName] = (adminCount[adminName] || 0) + types.length;
    });

    return {
      byType: Object.entries(typeCount)
        .map(([permission, count]) => ({ permission, count }))
        .sort((a, b) => b.count - a.count),
      byAdmin: Object.entries(adminCount)
        .map(([admin, count]) => ({ admin, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      totalPermissions: permissions.reduce((sum, p) => sum + (p.permission_type as string).split(', ').length, 0),
    };
  }, [permissions]);

  // Timeline data - group by month
  const timelineData = useMemo(() => {
    const grouped: Record<string, number> = {};

    permissions.forEach((perm) => {
      const date = new Date(perm.created_at || new Date());
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const types = (perm.permission_type as string).split(', ').length;
      grouped[monthKey] = (grouped[monthKey] || 0) + types;
    });

    return Object.entries(grouped)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [permissions]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Admins with Permissions</p>
            <p className="text-3xl font-bold text-purple-400 mt-2">{permissions.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Permissions Granted</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{permissionStats.totalPermissions}</p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Avg Permissions per Admin</p>
            <p className="text-3xl font-bold text-green-400 mt-2">
              {permissions.length > 0 ? (permissionStats.totalPermissions / permissions.length).toFixed(1) : 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Permission Types Distribution */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Permissions by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={permissionStats.byType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="permission" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Admins by Permissions */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Top Admins by Permission Count</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={permissionStats.byAdmin}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="admin" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Permission Grants Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8b5cf6" name="Permissions Granted" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
