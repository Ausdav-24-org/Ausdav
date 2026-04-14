import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, AlertTriangle, Loader2, Users, GraduationCap, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/integrations/supabase/functions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { z } from 'zod';

interface SignupState {
  allow_signup: boolean;
  updated_at: string | null;
}

const signupSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const SignupPortalPage = () => {
  const [state, setState] = useState<SignupState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setError(null);
      const { data, error } = await supabase
        .from('app_settings')
        .select('allow_signup, updated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        setError('Unable to load signup status. Please try again later.');
      } else if (data) {
        setState({ allow_signup: data.allow_signup ?? false, updated_at: data.updated_at ?? null });
      }

      setLoading(false);
    };

    load();
  }, []);

  const signupOpen = state?.allow_signup === true;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess('');

    if (!signupOpen) {
      setError('Registration is currently closed. Please check back later or contact AUSDAV for more information.');
      return;
    }

    const validation = signupSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setSubmitLoading(true);

    try {
      const { data, error: fnError } = await invokeFunction('controlled-signup', { email, password });

      if (fnError) throw fnError;
      if (!data?.userId) throw new Error('Unable to create your account. Please try again.');

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setSuccess('Welcome to AUSDAV! Your account has been created. Please sign in to continue.');
        return;
      }

      setSuccess('Welcome to AUSDAV! Redirecting you to complete your profile...');
      navigate('/admin/profile-setup');
    } catch (err: any) {
      setError(err.message || 'Unable to create your account. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!signupOpen) return;
    const redirect =
      import.meta.env.VITE_GOOGLE_REDIRECT ||
      window.location.origin + '/admin/profile-setup';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirect },
    });
    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[80vh] flex items-center justify-center py-16">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'var(--gradient-hero)' }} />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 -left-10 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card border border-border/50 rounded-3xl p-10"
        >
          <div className="flex flex-col lg:flex-row gap-10 items-center">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Users className="w-4 h-4" />
                Member Registration
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">Join the AUSDAV Family</h1>
                <p className="text-muted-foreground text-lg">
                  Become a member of the All University Students' Development Association Vavuniya. Join our community of educators, mentors, and changemakers dedicated to empowering students across Sri Lanka.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-background/60 border border-border/60 flex items-start gap-3">
                  <GraduationCap className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Educational Excellence</p>
                    <p className="text-sm text-muted-foreground">Access resources, organize seminars, and contribute to student development programs.</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-background/60 border border-border/60 flex items-start gap-3">
                  <Heart className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Community Impact</p>
                    <p className="text-sm text-muted-foreground">Make a difference in students' lives through mentorship, guidance, and support initiatives.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {loading ? (
                  <Badge className="bg-muted text-muted-foreground">Checking registration status...</Badge>
                ) : signupOpen ? (
                  <Badge className="bg-green-500/15 text-green-500">Registration Open</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">Registration Currently Closed</Badge>
                )}
                {state?.updated_at && (
                  <span className="text-xs text-muted-foreground">Last updated: {new Date(state.updated_at).toLocaleString()}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {/* <Button asChild size="lg" disabled={!signupOpen}>
                  <Link to="/login">
                    {loading ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</span>
                    ) : signupOpen ? (
                      <span className="flex items-center gap-2">Proceed to Sign Up <ArrowRight className="w-4 h-4" /></span>
                    ) : (
                      <span className="flex items-center gap-2">Signups Locked</span>
                    )}
                  </Link>
                </Button> */}
                <Button variant="outline" asChild size="lg">
                  <Link to="/login">Already have an account? Sign in</Link>
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              <div className="rounded-3xl border border-primary/20 bg-background p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-primary">Become a member today</p>
                    <h2 className="text-xl font-semibold text-foreground">Create your AUSDAV account</h2>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold ${signupOpen ? 'bg-green-500/20 text-green-500' : 'bg-border text-muted-foreground'}`}>
                    {signupOpen ? 'Open' : 'Closed'}
                  </div>
                </div>

                <form className="space-y-4" onSubmit={handleSignup}>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <Alert className="border-green-500/40 bg-green-500/10">
                      <AlertDescription className="text-green-500">{success}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      autoComplete="email"
                      disabled={!signupOpen || submitLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      disabled={!signupOpen || submitLoading}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={!signupOpen || submitLoading}>
                    {submitLoading ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Creating your account...</span>
                    ) : (
                      <span className="flex items-center gap-2">Join AUSDAV <ArrowRight className="w-4 h-4" /></span>
                    )}
                  </Button>

                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full flex items-center justify-center gap-2 bg-dark-blue hover:bg-blue-800 text-white"
                      onClick={handleGoogleSignup}
                      disabled={!signupOpen}
                    >
                      <img src="/src/assets/logo/google.png" alt="Google" className="w-5 h-5" />
                      Sign up with Google
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-2">
                    After registration, you'll complete your member profile to join the AUSDAV community.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SignupPortalPage;
