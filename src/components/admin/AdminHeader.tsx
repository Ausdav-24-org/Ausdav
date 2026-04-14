import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LogOut, User, Home, ChevronDown, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import LiveViewerBadge from '@/components/LiveViewerBadge';
import { dispatchAdminRefresh } from '@/hooks/useAdminRefresh';

interface AdminHeaderProps {
  title: string;
  breadcrumb?: string;
}

export function AdminHeader({ title, breadcrumb }: AdminHeaderProps) {
  const { profile, role, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.fullname
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  useEffect(() => {
    const loadSignedAvatar = async () => {
      if (!profile?.profile_path) {
        setAvatarUrl(undefined);
        return;
      }
      const { data, error } = await supabase.storage
        .from('member-profiles')
        .createSignedUrl(profile.profile_path, 60 * 60);
      if (error) {
        setAvatarUrl(undefined);
        return;
      }
      setAvatarUrl(data?.signedUrl);
    };

    loadSignedAvatar();
  }, [profile?.profile_path]);

  return (
    <header className="h-auto sm:h-16 bg-card/80 backdrop-blur-xl border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-0 gap-3 sm:gap-0">
      {/* Page Title */}
      <div className="flex-1 min-w-0">
        {breadcrumb && (
          <p className="text-xs text-muted-foreground mb-0.5 truncate">{breadcrumb}</p>
        )}
        <h1 className="text-lg sm:text-xl font-semibold text-foreground break-words sm:break-normal line-clamp-2 sm:line-clamp-1">{title}</h1>
      </div>

      {/* Live Viewer Badge & Profile Menu */}
      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
        <LiveViewerBadge size="sm" />
        <Button
          variant="ghost"
          title="Refresh admin tables"
          onClick={() => {
            try {
              setRefreshing(true);
              dispatchAdminRefresh();
              // Fallback: stop animation after a short delay if no explicit done event
              const t = setTimeout(() => setRefreshing(false), 1200);
              // Listen once for an optional explicit completion event
              const doneHandler = () => {
                clearTimeout(t);
                setRefreshing(false);
                window.removeEventListener('admin:refresh:done', doneHandler);
              };
              window.addEventListener('admin:refresh:done', doneHandler);
            } catch (e) {
              // fallback to full reload
              window.location.reload();
            }
          }}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 transition-transform ${refreshing ? 'animate-spin' : ''}`} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-3 px-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium">{profile?.fullname || 'User'}</p>
              <p className={cn(
                'text-xs capitalize',
                role === 'super_admin' && 'text-red-400',
                role === 'admin' && 'text-primary',
                role === 'member' && 'text-green-400',
                role === 'honourable' && 'text-yellow-400'
              )}>
                {role?.replace('_', ' ') || 'Loading...'}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate('/admin/profile')}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/')}>
            <Home className="mr-2 h-4 w-4" />
            Home
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}