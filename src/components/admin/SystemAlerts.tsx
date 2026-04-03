import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  resolved?: boolean;
}

interface SystemAlertsProps {
  masterAdminsCount: number;
  permissionsCount: number;
  membersCount: number;
  financeBalance: number;
}

export function SystemAlerts({
  masterAdminsCount,
  permissionsCount,
  membersCount,
  financeBalance,
}: SystemAlertsProps) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  useEffect(() => {
    const newAlerts: SystemAlert[] = [];

    // Alert: Low master admins
    if (masterAdminsCount < 2) {
      newAlerts.push({
        id: 'low-admins',
        type: 'warning',
        title: 'Low Master Admin Count',
        message: `Only ${masterAdminsCount} master admin(s) assigned. Consider assigning more for redundancy.`,
        timestamp: new Date(),
      });
    }

    // Alert: Negative balance
    if (financeBalance < 0) {
      newAlerts.push({
        id: 'negative-balance',
        type: 'error',
        title: 'Negative Balance Alert',
        message: `Current balance is Rs. ${financeBalance.toLocaleString()}. Operations may be affected.`,
        timestamp: new Date(),
      });
    } else if (financeBalance < 10000) {
      newAlerts.push({
        id: 'low-balance',
        type: 'warning',
        title: 'Low Fund Balance',
        message: `Current balance is low at Rs. ${financeBalance.toLocaleString()}. Consider adding funds.`,
        timestamp: new Date(),
      });
    }

    // Info: No permissions assigned
    if (permissionsCount === 0) {
      newAlerts.push({
        id: 'no-permissions',
        type: 'info',
        title: 'No Permissions Assigned',
        message: 'No admin permissions have been granted yet.',
        timestamp: new Date(),
      });
    }

    // Success: System healthy
    if (newAlerts.length === 0) {
      newAlerts.push({
        id: 'system-healthy',
        type: 'success',
        title: 'System Status',
        message: 'All systems operating normally. No alerts detected.',
        timestamp: new Date(),
      });
    }

    setAlerts(newAlerts);
  }, [masterAdminsCount, permissionsCount, membersCount, financeBalance]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-400" />;
      default:
        return null;
    }
  };

  const getAlertBgColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'success':
        return 'bg-green-500/10 border-green-500/20';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/20';
      default:
        return 'bg-card/50 border-border';
    }
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <CardTitle className="text-lg">System Alerts</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Real-time system health and critical notifications
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border flex items-start gap-3 ${getAlertBgColor(alert.type)}`}
            >
              <div className="flex-shrink-0 mt-0.5">{getAlertIcon(alert.type)}</div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{alert.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {alert.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
