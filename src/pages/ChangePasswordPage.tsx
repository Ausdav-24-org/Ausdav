import React, { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}

const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  visible,
  autoComplete,
  disabled = false,
  onChange,
  onToggleVisibility,
}) => (
  <div>
    <label htmlFor={id} className="mb-2 block text-sm font-semibold">
      {label}
    </label>

    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        required
        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-12 text-inherit outline-none transition placeholder:text-white/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <button
        type="button"
        onClick={onToggleVisibility}
        disabled={disabled}
        aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-current/65 transition hover:text-current disabled:cursor-not-allowed"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  </div>
);

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const text = {
    title: language === "en" ? "Change Password" : "கடவுச்சொல்லை மாற்றவும்",
    subtitle:
      language === "en"
        ? "Confirm your current password and choose a new one."
        : "உங்கள் தற்போதைய கடவுச்சொல்லை உறுதிப்படுத்தி புதிய கடவுச்சொல்லைத் தேர்ந்தெடுக்கவும்.",
    currentPassword:
      language === "en" ? "Current password" : "தற்போதைய கடவுச்சொல்",
    newPassword: language === "en" ? "New password" : "புதிய கடவுச்சொல்",
    confirmPassword:
      language === "en"
        ? "Confirm new password"
        : "புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்",
    button: language === "en" ? "Change Password" : "கடவுச்சொல்லை மாற்றவும்",
    changing:
      language === "en"
        ? "Changing password..."
        : "கடவுச்சொல் மாற்றப்படுகிறது...",
  };

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !user) {
        toast.error(
          language === "en"
            ? "Please sign in before changing your password."
            : "கடவுச்சொல்லை மாற்றுவதற்கு முன் உள்நுழையவும்.",
        );
        navigate("/login", { replace: true });
        return;
      }

      setCheckingSession(false);
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [language, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentPassword) {
      toast.error(
        language === "en"
          ? "Enter your current password."
          : "உங்கள் தற்போதைய கடவுச்சொல்லை உள்ளிடவும்.",
      );
      return;
    }

    if (newPassword.length < 8) {
      toast.error(
        language === "en"
          ? "The new password must contain at least 8 characters."
          : "புதிய கடவுச்சொல் குறைந்தது 8 எழுத்துகளைக் கொண்டிருக்க வேண்டும்.",
      );
      return;
    }

    if (newPassword === currentPassword) {
      toast.error(
        language === "en"
          ? "The new password must be different from the current password."
          : "புதிய கடவுச்சொல் தற்போதைய கடவுச்சொல்லிலிருந்து வேறுபட்டிருக்க வேண்டும்.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        language === "en"
          ? "The new passwords do not match."
          : "புதிய கடவுச்சொற்கள் பொருந்தவில்லை.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your login session has expired. Please sign in again.",
        );
      }

      if (!user.email) {
        throw new Error("No email address is connected to this account.");
      }

      // Compatible with older supabase-js versions: verify the current password first.
      const { error: verificationError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

      if (verificationError) {
        throw new Error("Your current password is incorrect.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast.success(
        language === "en"
          ? "Your password was changed successfully."
          : "உங்கள் கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது.",
      );

      navigate(-1);
    } catch (error: unknown) {
      console.error("Password change failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : language === "en"
            ? "Unable to change your password."
            : "உங்கள் கடவுச்சொல்லை மாற்ற முடியவில்லை.";

      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className={isDark ? "text-white/70" : "text-muted-foreground"}>
          {language === "en"
            ? "Checking your session..."
            : "உங்கள் அமர்வு சரிபார்க்கப்படுகிறது..."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12 md:py-16">
      <div className="mx-auto w-full max-w-lg">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={cn(
            "mb-6 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition",
            isDark
              ? "text-white/70 hover:text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          {language === "en" ? "Back" : "பின்செல்"}
        </button>

        <section
          className={cn(
            "rounded-2xl border p-6 shadow-xl backdrop-blur-md md:p-8",
            isDark
              ? "border-white/15 bg-white/5 text-white"
              : "border-border/60 bg-white/80 text-foreground",
          )}
        >
          <div className="mb-7 flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
                isDark
                  ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                  : "border-primary/20 bg-primary/10 text-primary",
              )}
            >
              <KeyRound className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold md:text-3xl">{text.title}</h1>
              <p
                className={cn(
                  "mt-1 text-sm leading-6",
                  isDark ? "text-white/65" : "text-muted-foreground",
                )}
              >
                {text.subtitle}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordField
              id="current-password"
              label={text.currentPassword}
              value={currentPassword}
              visible={showCurrentPassword}
              autoComplete="current-password"
              disabled={submitting}
              onChange={setCurrentPassword}
              onToggleVisibility={() =>
                setShowCurrentPassword((value) => !value)
              }
            />

            <PasswordField
              id="new-password"
              label={text.newPassword}
              value={newPassword}
              visible={showNewPassword}
              autoComplete="new-password"
              disabled={submitting}
              onChange={setNewPassword}
              onToggleVisibility={() => setShowNewPassword((value) => !value)}
            />

            <PasswordField
              id="confirm-password"
              label={text.confirmPassword}
              value={confirmPassword}
              visible={showConfirmPassword}
              autoComplete="new-password"
              disabled={submitting}
              onChange={setConfirmPassword}
              onToggleVisibility={() =>
                setShowConfirmPassword((value) => !value)
              }
            />

            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-sm",
                isDark
                  ? "border-white/10 bg-white/5 text-white/70"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                {language === "en"
                  ? "Use at least 8 characters. A longer password with letters, numbers and symbols is recommended."
                  : "குறைந்தது 8 எழுத்துகளைப் பயன்படுத்தவும். எழுத்துகள், எண்கள் மற்றும் குறியீடுகள் கொண்ட நீளமான கடவுச்சொல் பரிந்துரைக்கப்படுகிறது."}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound className="h-5 w-5" />
              {submitting ? text.changing : text.button}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};

export default ChangePasswordPage;