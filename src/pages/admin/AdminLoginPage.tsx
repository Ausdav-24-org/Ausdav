import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/integrations/supabase/functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default function AdminLoginPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasExistingUsers, setHasExistingUsers] = useState<boolean | null>(null);
  const [allowSignup, setAllowSignup] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab);
  const { signIn, user, role, profile, loading: authLoading, needsProfileSetup } = useAdminAuth();
  const navigate = useNavigate();

  // Check if any users exist
  useEffect(() => {
    const checkExistingUsers = async () => {
      const { count, error } = await supabase
        .from('members' as any)
        .select('mem_id', { count: 'exact', head: true });

      if (error) {
        console.error('Failed to check existing users', error);
        setHasExistingUsers(true);
        return;
      }

      setHasExistingUsers((count ?? 0) > 0);
    };
    checkExistingUsers();
  }, []);

  useEffect(() => {
    const fetchSignupFlag = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('allow_signup')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.error('Failed to read signup flag', error);
        setAllowSignup(false);
        return;
      }

      setAllowSignup(data?.allow_signup ?? false);
    };

    fetchSignupFlag();
  }, []);

  const signupOpen = allowSignup === true || hasExistingUsers === false;

  useEffect(() => {
    if (signupOpen) {
      setActiveTab('signup');
    } else {
      setActiveTab('login');
    }
  }, [signupOpen]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'inactive') {
      setError('Your account is inactive. Please contact an administrator.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) {
      if (needsProfileSetup) {
        navigate('/admin/profile-setup');
        return;
      }
      if (role === 'admin' || role === 'super_admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/admin/profile');
      }
    }
  }, [user, role, profile, authLoading, needsProfileSetup, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      setError(error.message || 'Invalid credentials');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const result = signupSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    const signupOpen = allowSignup === true || hasExistingUsers === false;

    if (!signupOpen) {
      setError('Sign ups are disabled by an administrator.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: fnError } = await invokeFunction('controlled-signup', { email, password });

      if (fnError) throw fnError;
      if (!data?.userId) throw new Error('Failed to create account');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setSuccess('Account created. Please sign in to continue.');
        return;
      }

      setSuccess('Account created! Redirecting to profile setup...');
      navigate('/admin/profile-setup');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center neon-glow">
            <span className="text-3xl font-bold text-primary">A</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">AUSDAV Admin</h1>
          <p className="text-muted-foreground mt-1">
            {hasExistingUsers === false ? 'Create the first admin account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Login/Signup Card */}
        <div className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-xl">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'login' | 'signup')}
            className="w-full"
          >
            <TabsList className={`grid w-full ${signupOpen ? 'grid-cols-2' : 'grid-cols-1'} mb-6`}>
              <TabsTrigger value="login">Sign In</TabsTrigger>
              {signupOpen && (
                <TabsTrigger value="signup">
                  {hasExistingUsers === false ? 'Setup Admin' : 'Sign Up'}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@ausdav.org"
                    autoComplete="email"
                    className="bg-background/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="bg-background/50 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>

            {signupOpen ? (
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert className="border-green-500/50 bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-green-500">{success}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@ausdav.org"
                      autoComplete="email"
                      className="bg-background/50"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        className="bg-background/50 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  After creating your account, you’ll be prompted to complete your member profile.
                </p>
              </TabsContent>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                Sign ups are currently disabled by a super administrator.
              </div>
            )}
          </Tabs>
        </div>

        {/* Back to public site */}
        <div className="text-center mt-6">
          <Button variant="link" onClick={() => navigate('/')}>
            ← Back to public site
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
