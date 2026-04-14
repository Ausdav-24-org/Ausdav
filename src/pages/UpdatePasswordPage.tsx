import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import logo from '@/assets/logo/AUSDAV_llogo.png';

const UpdatePasswordPage: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setError(
          language === 'en'
            ? 'Link is invalid or expired.'
            : 'தொடர்பு குறைவு அல்லது காலாவதியாகிவிட்டது.',
        );
      }
    };
    check();
  }, [language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError(language === 'en' ? 'Enter a new password' : 'புதிய கடவுச்சொல்லை உள்ளிடவும்');
      return;
    }
    if (password.length < 8) {
      setError(
        language === 'en'
          ? 'Password must be at least 8 characters'
          : 'கடவுச்சொல் குறைந்தது 8 எழுத்துகளாக இருக்க வேண்டும்',
      );
      return;
    }
    if (password !== confirm) {
      setError(language === 'en' ? "Passwords don't match" : 'கடவுச்சொற்கள் பொருந்தவில்லை');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <div className="glass-card rounded-2xl p-8 border border-border/50 w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full  flex items-center justify-center neon-glow">
            <img src={logo} alt="AUSDAV" />
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {language === 'en' ? 'Set new password' : 'புதிய கடவுச்சொல்லை அமைக்கவும்'}
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          {language === 'en'
            ? 'Update your account with a new password.'
            : 'உங்கள் கணக்கிற்கு புதிய கடவுச்சொல்லை புதுப்பிக்கவும்.'}
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          {language === 'en'
            ? 'Password must be at least 8 characters (same rules as account creation).'
            : 'கணக்கு உருவாக்கிய போது இருந்த விதிகளே - கடவுச்சொல் குறைந்தது 8 எழுத்துகள்.'}
        </p>
        {/* show session/invalid-link errors here */}
        {error && error.includes('Link') && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-foreground w-40">
                {language === 'en' ? 'New password' : 'புதிய கடவுச்சொல்'}
              </label>
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50 w-full"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-foreground w-40">
                {language === 'en' ? 'Confirm password' : 'கடவுச்சொல்லை உறுதிசெய்'}
              </label>
              <div className="relative flex-1">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-background/50 w-full"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          {/* inline error below confirm field */}
          {error && !error.includes('Link') && (
            <p className="text-sm text-red-500 text-center mt-1">{error}</p>
          )}
          <Button type="submit" className="w-full max-w-xs mx-auto" disabled={loading}>
            {language === 'en' ? 'Save password' : 'கடவுச்சொல்லைப் சேமிக்கவும்'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default UpdatePasswordPage;
