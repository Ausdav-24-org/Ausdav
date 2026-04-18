import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberDetails } from '@/types/admin';

interface MemberGrowthChartProps {
  members: MemberDetails[];
}

export function MemberGrowthChart({ members }: MemberGrowthChartProps) {
  const growthData = useMemo(() => {
    // Group members by creation date
    const grouped: Record<string, { admin: number; regular: number }> = {};

    // Sort members by creation date
    const sortedMembers = [...members].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let totalAdmin = 0;
    let totalRegular = 0;

    sortedMembers.forEach((member) => {
      const date = new Date(member.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) {
        grouped[monthKey] = { admin: totalAdmin, regular: totalRegular };
      }

      if (member.role === 'admin' || member.role === 'super_admin') {
        totalAdmin++;
      } else {
        totalRegular++;
      }

      grouped[monthKey] = { admin: totalAdmin, regular: totalRegular };
    });

    return Object.entries(grouped)
      .map(([month, data]) => ({
        month,
        admin: data.admin,
        regular: data.regular,
        total: data.admin + data.regular,
      }))
      .slice(-12); // Last 12 months
  }, [members]);

  const roleStats = useMemo(() => {
    const stats = {
      admin: members.filter((m) => m.role === 'admin' || m.role === 'super_admin').length,
      regular: members.filter((m) => m.role !== 'admin' && m.role !== 'super_admin').length,
      total: members.length,
    };
    return stats;
  }, [members]);

  return (
    <div className="space-y-6">
      {/* Growth Chart */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Member Growth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="admin"
                stroke="#ef4444"
                strokeWidth={2}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="regular"
                stroke="#10b981"
                strokeWidth={2}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Statistics Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Members</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{roleStats.total}</p>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Admin Users</p>
            <p className="text-3xl font-bold text-red-400 mt-2">{roleStats.admin}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {roleStats.total > 0 ? ((roleStats.admin / roleStats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Regular Users</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{roleStats.regular}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {roleStats.total > 0 ? ((roleStats.regular / roleStats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
