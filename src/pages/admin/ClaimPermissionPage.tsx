import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  CalendarDays,
  GraduationCap,
  BookOpen,
  DollarSign,
  Megaphone,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldQuestion,
  XCircle,
  Bell,
  CheckCheck,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { usePermissionRequests } from '@/hooks/usePermissionRequests';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PermissionItem {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const permissionItems: PermissionItem[] = [
  {
    key: 'member',
    title: 'Member Handling',
    description: 'Manage member profiles, update roles, and handle member data.',
    icon: Users,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    key: 'applicant',
    title: 'Applicant Handling',
    description: 'Review and process new applicant registrations.',
    icon: UserPlus,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    key: 'events',
    title: 'Event Handling',
    description: 'Create, update, and manage organization events and galleries.',
    icon: CalendarDays,
    color: 'from-purple-500 to-pink-500',
  },
  {
    key: 'exam',
    title: 'Exam Handling',
    description: 'Upload and manage past papers and exam resources.',
    icon: GraduationCap,
    color: 'from-orange-500 to-amber-500',
  },
  {
    key: 'seminar',
    title: 'Seminar Handling',
    description: 'Manage seminar materials and answer sheets.',
    icon: BookOpen,
    color: 'from-rose-500 to-red-500',
  },
  {
    key: 'finance',
    title: 'Finance Handling',
    description: 'Verify and approve financial submissions, manage ledger.',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-500',
  },
  {
    key: 'announcement',
    title: 'Announcement Handling',
    description: 'Create and manage public announcements on the website.',
    icon: Megaphone,
    color: 'from-indigo-500 to-violet-500',
  },
  {
    key: 'feedback',
    title: 'Feedback Handling',
    description: 'Classify and manage user feedback submitted via the site footer.',
    icon: Megaphone,
    color: 'from-emerald-500 to-green-500',
  },
  {
    key: 'quiz',
    title: 'Quiz Handling',
    description: 'Manage quiz questions, view results, and control quiz settings.',
    icon: GraduationCap,
    color: 'from-cyan-500 to-blue-500',
  },
];

export default function ClaimPermissionPage() {
  const { role, isSuperAdmin } = useAdminAuth();
  const {
    myRequests,
    notifications,
    unreadCount,
    loading,
    submitRequest,
    markNotificationRead,
    markAllNotificationsRead,
    getMyGrantedPermissions,
  } = usePermissionRequests();

  const [selectedPermission, setSelectedPermission] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch granted permissions
  useEffect(() => {
    const fetchGranted = async () => {
      const granted = await getMyGrantedPermissions();
      setGrantedPermissions(granted);
    };
    fetchGranted();
  }, [getMyGrantedPermissions]);

  // Only admins (not super_admin, not member) should see this
  if (isSuperAdmin) {
    return (
      <div className="p-6">
        <AdminHeader title="Claim Permission" breadcrumb="Admin / Claim Permission" />
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <ShieldQuestion className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Not Applicable</h2>
          <p className="text-muted-foreground">
            Super Admins already have full access to all features.
          </p>
        </div>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="p-6">
        <AdminHeader title="Claim Permission" breadcrumb="Admin / Claim Permission" />
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <ShieldQuestion className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">
            Only Admins can claim additional permissions.
          </p>
        </div>
      </div>
    );
  }

  const getPermissionStatus = (key: string): 'granted' | 'pending' | 'rejected' | 'available' => {
    if (grantedPermissions.includes(key)) return 'granted';
    const request = myRequests.find(r => r.permission_key === key);
    if (request) {
      if (request.status === 'pending') return 'pending';
      if (request.status === 'rejected') return 'rejected';
    }
    return 'available';
  };

  const handleSelectPermission = (key: string) => {
    const status = getPermissionStatus(key);
    if (status === 'granted' || status === 'pending') return;
    setSelectedPermission(selectedPermission === key ? null : key);
    setReason('');
  };

  const handleSubmitClaim = async () => {
    if (!selectedPermission || !reason.trim()) {
      toast.error('Please provide a reason for your request.');
      return;
    }

    setSubmitting(true);

    const result = await submitRequest(selectedPermission, reason.trim());

    if (result.success) {
      toast.success('Permission request submitted! A Super Admin will review your request.');
      setSelectedPermission(null);
      setReason('');
    } else {
      toast.error(result.error || 'Failed to submit request');
    }

    setSubmitting(false);
  };

  const selectedItem = permissionItems.find((p) => p.key === selectedPermission);

  const pendingRequests = myRequests.filter(r => r.status === 'pending');
  const processedRequests = myRequests.filter(r => r.status !== 'pending').slice(0, 10);

  const permissionNotifications = notifications.filter(n => 
    n.type === 'permission_approved' || 
    n.type === 'permission_rejected' || 
    n.type === 'permission_granted' ||
    n.type === 'permission_revoked'
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <AdminHeader title="Claim Permission" breadcrumb="Admin / Claim Permission" />
        
        {/* Notification Bell */}
        <Button
          variant="outline"
          size="icon"
          className="relative"
          onClick={() => setShowNotifications(true)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Notifications Dialog */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Permission Notifications</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllNotificationsRead}
                  className="text-xs"
                >
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              Updates on your permission requests
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {permissionNotifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <div className="space-y-2">
                {permissionNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      'p-3 rounded-lg border transition-colors cursor-pointer',
                      notif.is_read ? 'bg-muted/30' : 'bg-primary/5 border-primary/30'
                    )}
                    onClick={() => markNotificationRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-1.5 rounded-full',
                        notif.type === 'permission_approved' && 'bg-green-500/20',
                        notif.type === 'permission_granted' && 'bg-blue-500/20',
                        notif.type === 'permission_rejected' && 'bg-red-500/20',
                        notif.type === 'permission_revoked' && 'bg-orange-500/20'
                      )}>
                        {(notif.type === 'permission_approved' || notif.type === 'permission_granted') && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {(notif.type === 'permission_rejected' || notif.type === 'permission_revoked') && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{notif.title}</p>
                        <p className="text-sm text-muted-foreground">{notif.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Intro Banner */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="flex items-start gap-4 p-6">
          <div className="p-3 rounded-xl bg-primary/10">
            <ShieldQuestion className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Request Additional Permissions</h3>
            <p className="text-sm text-muted-foreground">
              As an Admin, you can request access to specific features. Select a permission below
              and provide a reason for your request. A Super Admin will review and approve or deny
              your request.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Permission Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {permissionItems.map((item, index) => {
              const status = getPermissionStatus(item.key);
              const isSelected = selectedPermission === item.key;
              const isGranted = status === 'granted';
              const isPending = status === 'pending';
              const isRejected = status === 'rejected';

              return (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={cn(
                      'transition-all duration-300 relative overflow-hidden group',
                      (isGranted || isPending) ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-lg',
                      isSelected && 'ring-2 ring-primary shadow-lg',
                      isGranted && 'border-green-500/50 bg-green-500/5',
                      isPending && 'opacity-70'
                    )}
                    onClick={() => handleSelectPermission(item.key)}
                  >
                    {/* Gradient background on hover */}
                    {!isGranted && !isPending && (
                      <div
                        className={cn(
                          'absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br',
                          item.color
                        )}
                      />
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div
                          className={cn(
                            'p-2.5 rounded-xl bg-gradient-to-br text-white',
                            item.color,
                            isGranted && 'opacity-60'
                          )}
                        >
                          <item.icon className="w-5 h-5" />
                        </div>
                        {isGranted ? (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Granted
                          </Badge>
                        ) : isPending ? (
                          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        ) : isRejected ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            Can re-request
                          </Badge>
                        ) : isSelected ? (
                          <Badge className="bg-primary/20 text-primary border-primary/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Selected
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardTitle className="text-base mb-2">{item.title}</CardTitle>
                      <CardDescription className="text-sm">{item.description}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Request Form */}
          {selectedPermission && selectedItem && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-primary/30">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'p-2.5 rounded-xl bg-gradient-to-br text-white',
                        selectedItem.color
                      )}
                    >
                      <selectedItem.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle>Request: {selectedItem.title}</CardTitle>
                      <CardDescription>
                        Explain why you need access to this feature
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Reason for Request <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Describe why you need access to this permission and how you plan to use it..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      Your request will be reviewed by a Super Admin.
                    </p>
                    <Button
                      onClick={handleSubmitClaim}
                      disabled={submitting || !reason.trim()}
                      className="gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Request
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Pending Requests Summary */}
          {pendingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Pending Requests
                </CardTitle>
                <CardDescription>
                  These permission requests are awaiting Super Admin approval.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {pendingRequests.map((request) => {
                    const item = permissionItems.find((p) => p.key === request.permission_key);
                    if (!item) return null;
                    return (
                      <Badge
                        key={request.id}
                        variant="outline"
                        className="gap-2 py-1.5 px-3 bg-muted/50"
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.title}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Request History */}
          {processedRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Request History
                </CardTitle>
                <CardDescription>
                  Your recent permission request outcomes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {processedRequests.map((request) => {
                    const item = permissionItems.find((p) => p.key === request.permission_key);
                    if (!item) return null;
                    return (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={request.status === 'approved' ? 'default' : 'destructive'}
                            className={request.status === 'approved' ? 'bg-green-500' : ''}
                          >
                            {request.status === 'approved' ? (
                              <><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</>
                            ) : (
                              <><XCircle className="w-3 h-3 mr-1" /> Rejected</>
                            )}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(request.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Your Granted Permissions */}
          {grantedPermissions.length > 0 && (
            <Card className="border-green-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-5 h-5" />
                  Your Granted Permissions
                </CardTitle>
                <CardDescription>
                  Permissions you currently have access to
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {grantedPermissions.map((key) => {
                    const item = permissionItems.find((p) => p.key === key);
                    if (!item) return null;
                    return (
                      <Badge
                        key={key}
                        className="gap-2 py-1.5 px-3 bg-green-500/20 text-green-500 border-green-500/30"
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.title}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
