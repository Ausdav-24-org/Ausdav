import { useMemo } from 'react';
import { Users, Shield, DollarSign, FileText, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { MasterAdmin, MemberDetails, AdminPermission, FinanceTransaction, AuditAction } from '@/types/admin';

interface ActivityEvent {
  id: string;
  type: 'member' | 'admin' | 'permission' | 'finance' | 'audit';
  action: string;
  description: string;
  timestamp: Date;
  actor: string;
  icon: any;
  color: string;
}

interface ActivityFeedProps {
  masterAdmins: MasterAdmin[];
  members: MemberDetails[];
  permissions: AdminPermission[];
  transactions: FinanceTransaction[];
  auditLogs: AuditAction[];
}

export function ActivityFeed({
  masterAdmins,
  members,
  permissions,
  transactions,
  auditLogs,
}: ActivityFeedProps) {
  const activities = useMemo(() => {
    const events: ActivityEvent[] = [];

    // Recent master admin assignments
    masterAdmins.slice(0, 5).forEach((admin) => {
      events.push({
        id: `admin-${admin.mem_id}`,
        type: 'admin',
        action: 'Master Admin Assigned',
        description: `${admin.fullname} was assigned as Master Admin`,
        timestamp: new Date(admin.created_at),
        actor: admin.fullname,
        icon: Shield,
        color: 'text-red-400',
      });
    });

    // Recent member joins
    members.slice(0, 5).forEach((member) => {
      events.push({
        id: `member-${member.mem_id}`,
        type: 'member',
        action: 'Member Joined',
        description: `${member.fullname} joined as ${member.role}`,
        timestamp: new Date(member.created_at),
        actor: member.fullname,
        icon: Users,
        color: 'text-blue-400',
      });
    });

    // Recent permissions
    permissions.slice(0, 5).forEach((perm) => {
      events.push({
        id: `perm-${perm.id}`,
        type: 'permission',
        action: 'Permission Granted',
        description: `${perm.member_name} granted permissions: ${perm.permission_type}`,
        timestamp: new Date(perm.created_at || new Date()),
        actor: perm.granted_by_name,
        icon: Plus,
        color: 'text-purple-400',
      });
    });

    // Recent transactions
    transactions.slice(0, 5).forEach((txn) => {
      events.push({
        id: `txn-${txn.fin_id}`,
        type: 'finance',
        action: txn.exp_type === 'income' ? 'Income Recorded' : 'Expense Recorded',
        description: `${txn.category} - Rs. ${txn.amount.toLocaleString()}`,
        timestamp: new Date(txn.txn_date),
        actor: txn.description,
        icon: DollarSign,
        color: txn.exp_type === 'income' ? 'text-green-400' : 'text-orange-400',
      });
    });

    // Recent audit logs
    auditLogs.slice(0, 5).forEach((log) => {
      events.push({
        id: `audit-${log.id}`,
        type: 'audit',
        action: 'Audit Event',
        description: `Year ${log.year} - File: ${log.batch_name || 'N/A'}`,
        timestamp: new Date(log.created_at),
        actor: 'System',
        icon: FileText,
        color: 'text-cyan-400',
      });
    });

    // Sort by timestamp (newest first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 15);
  }, [masterAdmins, members, permissions, transactions, auditLogs]);

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <CardTitle className="text-lg">Activity Feed</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Latest system activities (last 15 events)</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No recent activities</p>
            </div>
          ) : (
            activities.map((activity, index) => {
              const IconComponent = activity.icon;
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      <div className={`p-2 rounded-lg bg-muted/50`}>
                        <IconComponent className={`h-4 w-4 ${activity.color}`} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{activity.action}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {activity.description}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {getTimeAgo(activity.timestamp)}
                        </span>
                      </div>

                      {/* Actor */}
                      <p className="text-xs text-muted-foreground mt-2">
                        By: <span className="font-medium text-foreground">{activity.actor}</span>
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
