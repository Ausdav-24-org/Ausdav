import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FinanceTransaction } from '@/types/admin';

interface FinanceAnalyticsChartProps {
  transactions: FinanceTransaction[];
}

export function FinanceAnalyticsChart({ transactions }: FinanceAnalyticsChartProps) {
  // Trend data - group by month
  const trendData = useMemo(() => {
    const grouped = transactions.reduce((acc, txn) => {
      const date = new Date(txn.txn_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, income: 0, expense: 0 };
      }
      
      if (txn.exp_type === 'income') {
        acc[monthKey].income += txn.amount;
      } else {
        acc[monthKey].expense += txn.amount;
      }
      
      return acc;
    }, {} as Record<string, { month: string; income: number; expense: number }>);

    return Object.values(grouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months
  }, [transactions]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const grouped = transactions.reduce((acc, txn) => {
      const existing = acc.find((item) => item.name === txn.category);
      if (existing) {
        existing.value += txn.amount;
      } else {
        acc.push({ name: txn.category, value: txn.amount });
      }
      return acc;
    }, [] as { name: string; value: number }[]);

    return grouped.sort((a, b) => b.value - a.value).slice(0, 8);
  }, [transactions]);

  // Daily transaction count
  const dailyData = useMemo(() => {
    const grouped = transactions.reduce((acc, txn) => {
      const date = new Date(txn.txn_date).toLocaleDateString();
      const existing = acc.find((item) => item.date === date);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({ date, count: 1 });
      }
      return acc;
    }, [] as { date: string; count: number }[]);

    return grouped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-30);
  }, [transactions]);

  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#6366f1', '#f97316', '#14b8a6',
  ];

  return (
    <div className="space-y-6">
      {/* Income vs Expense Trend */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Income vs Expense Trend (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `Rs. ${value.toLocaleString()}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Pie Chart */}
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `Rs. ${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Transaction Count */}
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg">Daily Transaction Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
