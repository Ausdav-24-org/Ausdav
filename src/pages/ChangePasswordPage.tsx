import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        navigate('/login', {
          replace: true,
        });

        return;
      }

      setCheckingSession(false);
    };

    void checkUser();
  }, [navigate]);

  const handleChangePassword = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!currentPassword) {
      toast.error('Enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('The new password must contain at least 8 characters.');
      return;
    }

    if (newPassword === currentPassword) {
      toast.error('The new password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('The new passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Your login session has expired. Please sign in again.');
      }

      if (!user.email) {
        throw new Error('No email address is connected to this account.');
      }

       // Step 1: Verify that the current password is correct
        const { error: verificationError } =
        await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

        if (verificationError) {
        throw new Error('Your current password is incorrect.');
        }

        // Step 2: Change the password
        const { error: updateError } =
        await supabase.auth.updateUser({
            password: newPassword,
        });

        if (updateError) {
          throw updateError;
        }

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        toast.success('Your password was changed successfully.');

        navigate('/profile', {
          replace: true,
        });
    } catch (error: unknown) {
      console.error('Password change failed:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to change your password.';

      const normalizedMessage = message.toLowerCase();

      if (
        normalizedMessage.includes('invalid login') ||
        normalizedMessage.includes('current password') ||
        normalizedMessage.includes('password is incorrect')
      ) {
        toast.error('Your current password is incorrect.');
      } else if (
        normalizedMessage.includes('same password') ||
        normalizedMessage.includes('different from the old password')
      ) {
        toast.error('Your new password must be different from the old password.');
      } else if (
        normalizedMessage.includes('weak') ||
        normalizedMessage.includes('password should')
      ) {
        toast.error('Please use a stronger password.');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          Checking your login session...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-16 pt-28">
      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold">
                Change password
              </h1>

              <p className="text-sm text-muted-foreground">
                Update the password used to access your account.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleChangePassword}
            className="space-y-5"
          >
            <PasswordInput
              id="current-password"
              label="Current password"
              value={currentPassword}
              visible={showCurrentPassword}
              autoComplete="current-password"
              onChange={setCurrentPassword}
              onToggleVisibility={() =>
                setShowCurrentPassword((previous) => !previous)
              }
            />

            <PasswordInput
              id="new-password"
              label="New password"
              value={newPassword}
              visible={showNewPassword}
              autoComplete="new-password"
              onChange={setNewPassword}
              onToggleVisibility={() =>
                setShowNewPassword((previous) => !previous)
              }
            />

            <PasswordInput
              id="confirm-password"
              label="Confirm new password"
              value={confirmPassword}
              visible={showConfirmPassword}
              autoComplete="new-password"
              onChange={setConfirmPassword}
              onToggleVisibility={() =>
                setShowConfirmPassword((previous) => !previous)
              }
            />

            <p className="text-xs text-muted-foreground">
              Use at least 8 characters. A longer password containing
              uppercase letters, lowercase letters, numbers and symbols is
              recommended.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Changing password...' : 'Change password'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  autoComplete: string;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  label,
  value,
  visible,
  autoComplete,
  onChange,
  onToggleVisibility,
}) => {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full rounded-lg border border-input bg-background px-3 py-3 pr-11 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChangePasswordPage;